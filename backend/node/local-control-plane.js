const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const { SafetyGovernor } = require("./safety-governor")

const MAX_TEXT_LENGTH = 10000
const REMOTE_URL_PATTERN = /\bhttps?:\/\/(?!127\.0\.0\.1(?::\d+)?(?:\/|$)|localhost(?::\d+)?(?:\/|$))[^\s]+/i
const ACTOR_TYPES = new Set(["owner", "delegated", "model", "tool", "plugin"])

class LocalCircuit {
  constructor({ failureThreshold = 3, cooldownMs = 10000 } = {}) { this.failureThreshold = failureThreshold; this.cooldownMs = cooldownMs; this.failures = 0; this.openedAt = 0 }
  get state() { if (this.openedAt && Date.now() - this.openedAt < this.cooldownMs) return "open"; if (this.openedAt) return "half-open"; return "closed" }
  async run(operation) {
    if (this.state === "open") { const error = new Error("Local execution circuit is open"); error.code = "LOCAL_CIRCUIT_OPEN"; throw error }
    try { const result = await operation(); this.failures = 0; this.openedAt = 0; return result } catch (error) { this.failures += 1; if (this.failures >= this.failureThreshold) this.openedAt = Date.now(); throw error }
  }
}

function hash(text) { return crypto.createHash("sha3-512").update(text, "utf8").digest("hex") }
function evidenceFile() { return process.env.DEVASSIST_EVIDENCE_PATH || path.join(__dirname, ".devassist-evidence.jsonl") }
function recordEvidence(event) { const target = evidenceFile(); fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 }); fs.appendFileSync(target, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 }); return { recorded: true, network_accessed: false } }
function validateRequest(body) { if (!body || typeof body !== "object" || Array.isArray(body)) return "Request body must be a JSON object"; if (typeof body.text !== "string" || !body.text.trim()) return "text must be a non-empty string"; if (body.text.length > MAX_TEXT_LENGTH) return `text must not exceed ${MAX_TEXT_LENGTH} characters`; if (REMOTE_URL_PATTERN.test(body.text)) return "remote URLs are blocked by local-only policy"; return null }

function authorizationDecision({ requestId, actorType, capability, riskLevel, confirmation, override, scopeMatch }) {
  const actor = ACTOR_TYPES.has(actorType) ? actorType : "unknown"
  let decision = actor === "owner" ? "OWNER_AUTHORIZED" : "DELEGATED_AUTHORIZED"
  let reason = "capability_allowed"
  let uiState = "Authorization"
  let checkpointId = null
  let overrideScope = null
  let overrideLifetime = null

  if (actor === "model" || actor === "tool" || actor === "plugin") {
    decision = "ACCESS_DENIED"; reason = "delegated_actor_cannot_authorize"; uiState = "AccessDENIED"
  } else if (!scopeMatch) {
    decision = "ACCESS_DENIED"; reason = "capability_scope_violation"; uiState = "AccessDENIED"
  } else if ((riskLevel === "high" || riskLevel === "critical") && !confirmation) {
    decision = "CONFIRMATION_REQUIRED"; reason = "owner_confirmation_required"; uiState = "AccessDENIED"; checkpointId = `checkpoint-${crypto.randomUUID()}`
  } else if ((riskLevel === "high" || riskLevel === "critical") && confirmation && override) {
    decision = "OWNER_OVERRIDE"; reason = "owner_confirmed_override"; checkpointId = `checkpoint-${crypto.randomUUID()}`; overrideScope = "single_action"; overrideLifetime = "transaction_end"
  }

  const scarId = `scar-${crypto.randomUUID()}`
  return {
    request_id: requestId,
    requested_action: capability,
    decision,
    reason,
    ui_state: uiState,
    actor_type: actor,
    confirmation: confirmation === true,
    checkpoint_id: checkpointId,
    override: decision === "OWNER_OVERRIDE",
    override_scope: overrideScope,
    override_lifetime: overrideLifetime,
    policy_modified: false,
    user_alert: decision !== "OWNER_AUTHORIZED" && decision !== "DELEGATED_AUTHORIZED",
    options: decision === "CONFIRMATION_REQUIRED" ? ["approve", "review_checkpoint", "cancel"] : decision === "ACCESS_DENIED" ? ["request_owner_approval", "more_details", "cancel"] : ["continue"],
    scar_id: scarId,
    network_accessed: false,
    verdict: { algorithm: "ML-DSA-87", signature_status: "unavailable" },
  }
}

function createShortcutRoute({ composeResponse, stateStore, logger, circuit = new LocalCircuit(), governor = new SafetyGovernor() }) {
  return async (req, res) => {
    const validationError = validateRequest(req.body)
    if (validationError) return res.status(400).json({ error: "Validation failed", message: validationError, network_accessed: false })
    const requestId = crypto.randomUUID()
    const text = req.body.text.trim()
    const actorType = req.body.actor_type || "owner"
    const capability = req.body.capability || "speak_response"
    const riskLevel = req.body.risk_level || (capability === "speak_response" ? "low" : "high")
    const confirmation = req.body.confirmation === true || req.body.consent === true
    const override = req.body.override === true
    const scopeMatch = req.body.scope_match !== false
    const authorization = authorizationDecision({ requestId, actorType, capability, riskLevel, confirmation, override, scopeMatch })
    const safety = governor.evaluate({ capability, consent: confirmation, scopeMatch, circuitState: circuit.state, text })
    recordEvidence({ request_id: requestId, type: "authorization_decision", authorization, safety, timestamp: new Date().toISOString(), network_accessed: false })

    if (authorization.decision === "ACCESS_DENIED" || authorization.decision === "CONFIRMATION_REQUIRED") {
      return res.status(authorization.decision === "CONFIRMATION_REQUIRED" ? 409 : 403).json({ request_id: requestId, status: authorization.decision === "CONFIRMATION_REQUIRED" ? "confirmation_required" : "blocked", authorization, safety, user_alert: true, network_accessed: false })
    }
    if (safety.decision !== "allow") return res.status(403).json({ request_id: requestId, status: "blocked", authorization, safety, user_alert: true, network_accessed: false })

    try {
      const response = await circuit.run(async () => {
        stateStore.recordUsage()
        const output = composeResponse(text, { runtimeMode: "offline", modelId: stateStore.selectedModel.id })
        const outputHash = hash(output)
        const evidence = recordEvidence({ request_id: requestId, type: "local_execution", input_hash: hash(text), output_hash: outputHash, timestamp: new Date().toISOString(), network_accessed: false })
        return { request_id: requestId, status: "completed", final_output: output, spoken_text: output, routing: { mode: "offline", primary: stateStore.selectedModel.id, model_status: "local-runtime", network_accessed: false, council: stateStore.supportedModels }, circuit: { state: circuit.state }, authorization, safety, verdict: { action: "pass", algorithm: "ML-DSA-87", signature_status: "unavailable", final_output_hash: outputHash }, evidence }
      })
      return res.json(response)
    } catch (error) {
      logger.error("Local Shortcut execution failed", { requestId, error: error.message })
      return res.status(503).json({ request_id: requestId, status: "offline", error: "Local execution unavailable", network_accessed: false, circuit: { state: circuit.state }, authorization, verdict: { algorithm: "ML-DSA-87", signature_status: "unavailable" } })
    }
  }
}

module.exports = { MAX_TEXT_LENGTH, LocalCircuit, authorizationDecision, createShortcutRoute, validateRequest }
