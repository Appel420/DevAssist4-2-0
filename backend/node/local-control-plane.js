const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const MAX_TEXT_LENGTH = 10000
const REMOTE_URL_PATTERN = /\bhttps?:\/\/(?!127\.0\.0\.1(?::\d+)?(?:\/|$)|localhost(?::\d+)?(?:\/|$))[^\s]+/i

function hash(text) {
  return crypto.createHash("sha3-512").update(text, "utf8").digest("hex")
}

function evidenceFile() {
  return process.env.DEVASSIST_EVIDENCE_PATH || path.join(__dirname, ".devassist-evidence.jsonl")
}

function recordEvidence(event) {
  const target = evidenceFile()
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
  fs.appendFileSync(target, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 })
  return { recorded: true, network_accessed: false }
}

function validateRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Request body must be a JSON object"
  if (typeof body.text !== "string" || !body.text.trim()) return "text must be a non-empty string"
  if (body.text.length > MAX_TEXT_LENGTH) return `text must not exceed ${MAX_TEXT_LENGTH} characters`
  if (REMOTE_URL_PATTERN.test(body.text)) return "remote URLs are blocked by local-only policy"
  return null
}

function createShortcutRoute({ composeResponse, stateStore, logger }) {
  return (req, res) => {
    const validationError = validateRequest(req.body)
    if (validationError) {
      return res.status(400).json({ error: "Validation failed", message: validationError, network_accessed: false })
    }

    const requestId = crypto.randomUUID()
    const text = req.body.text.trim()

    try {
      stateStore.recordUsage()
      const output = composeResponse(text, { runtimeMode: "offline", modelId: stateStore.selectedModel.id })
      const outputHash = hash(output)
      const inputHash = hash(text)
      const evidence = recordEvidence({
        request_id: requestId,
        action: "local_execution",
        input_hash: inputHash,
        output_hash: outputHash,
        timestamp: new Date().toISOString(),
      })

      return res.json({
        request_id: requestId,
        status: "completed",
        final_output: output,
        spoken_text: output,
        routing: {
          mode: "offline",
          primary: stateStore.selectedModel.id,
          model_status: "local-runtime",
          network_accessed: false,
          judge_requested: req.body.routing?.use_judge !== false,
        },
        verdict: {
          action: "pass",
          algorithm: "ML-DSA-87",
          signature_status: "unavailable",
          final_output_hash: outputHash,
        },
        evidence,
      })
    } catch (error) {
      logger.error("Local Shortcut execution failed", { requestId, error: error.message })
      return res.status(503).json({
        request_id: requestId,
        status: "offline",
        error: "Local execution unavailable",
        network_accessed: false,
        verdict: { algorithm: "ML-DSA-87", signature_status: "unavailable" },
      })
    }
  }
}

module.exports = { MAX_TEXT_LENGTH, createShortcutRoute, validateRequest }
