const crypto = require("crypto")

const DECISION_STATES = new Set(["ALLOW", "DENY", "ESCALATE"])

class PolicyDecision {
  constructor({ requestId, tool, decision, policyVersion, mode, trustBoundary, mutation, reason, timestamp }) {
    if (!DECISION_STATES.has(decision)) throw new Error(`Invalid decision state: ${decision}`)
    this.requestId = requestId
    this.tool = tool
    this.decision = decision
    this.policyVersion = policyVersion
    this.mode = mode
    this.trustBoundary = trustBoundary
    this.mutation = mutation
    this.reason = reason
    this.timestamp = timestamp
    Object.freeze(this)
  }
}

class SCAREmitter {
  constructor() { this._events = [] }
  emit(payload) {
    const event = Object.freeze({
      id: crypto.randomUUID(),
      payload: Object.freeze({ ...payload }),
    })
    this._events = this._events.concat(event)
    return event
  }
  get events() { return this._events.slice() }
}

class CapabilityRegistry {
  constructor(policy) { this.policy = policy || {} }
  get(tool) {
    const capability = this.policy.capabilities && this.policy.capabilities[tool]
    if (!capability || typeof capability !== "object") return null
    const required = ["classification", "allowedModes", "mutation", "requiresApproval"]
    if (!required.every((field) => Object.prototype.hasOwnProperty.call(capability, field))) return null
    return capability
  }
}

class PolicyEngine {
  constructor(policy, { scar = new SCAREmitter() } = {}) {
    this.policy = policy
    this.registry = new CapabilityRegistry(policy)
    this.scar = scar
  }

  attest(attestation) {
    const required = this.policy.bridgeRequirements || {}
    return attestation && attestation.trustBoundary === required.trustBoundary &&
      attestation.credentials === required.credentials &&
      attestation.shell === required.shell &&
      attestation.mutation === required.mutation
  }

  decide({ requestId = crypto.randomUUID(), tool, mode = "offline", attestation, workspace = "", timestamp = new Date().toISOString() }) {
    const capability = this.registry.get(tool)
    let decision = "ALLOW"
    let reason = "tool permitted by read-only policy"
    let mutation = Boolean(capability && capability.mutation)

    if (!capability) { decision = "DENY"; reason = "unknown or malformed tool" }
    else if (capability.classification === "authority") { decision = "DENY"; reason = "authority capability prohibited" }
    else if (!this.attest(attestation)) { decision = "DENY"; reason = "bridge attestation mismatch" }
    else if (!Array.isArray(capability.allowedModes) || !capability.allowedModes.includes(mode)) { decision = "DENY"; reason = "mode not allowed" }
    else if (mutation || capability.network || capability.credentials) { decision = "DENY"; reason = "mutation, network, or credentials disabled" }
    else if (capability.requiresApproval) { decision = "ESCALATE"; reason = `approvalAuthority:${capability.approvalAuthority || "user"} required` }
    else if (this.policy.workspacePolicy?.requireWorkspaceBoundary && !workspace) { decision = "DENY"; reason = "workspace boundary required" }

    const result = new PolicyDecision({ requestId, tool, decision, policyVersion: this.policy.version || this.policy.schemaVersion || "unknown", mode, trustBoundary: attestation?.trustBoundary || "unknown", mutation, reason, timestamp })
    this.scar.emit({ event: "CAPABILITY_EXECUTION", provider: "sovereignty-local-mcp", tool, mode, permission: "local-read", decision, requestId, workspace, mutation, trustBoundary: result.trustBoundary, policyVersion: result.policyVersion, timestamp })
    return result
  }
}

class MCPPolicyAdapter {
  constructor({ engine, bridge }) { this.engine = engine; this.bridge = bridge }
  async invoke(request) {
    const decision = this.engine.decide(request)
    if (decision.decision !== "ALLOW") return { decision, evidence: null }
    const evidence = await this.bridge.invoke(request.tool, request.arguments || {})
    return { decision, evidence: { source: "sovereignty-local-mcp", authority: false, verified: true, result: evidence } }
  }
}

module.exports = { DECISION_STATES, PolicyDecision, SCAREmitter, CapabilityRegistry, PolicyEngine, MCPPolicyAdapter }
