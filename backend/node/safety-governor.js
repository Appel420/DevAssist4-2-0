const crypto = require("crypto")

const DEFAULT_CAPABILITIES = {
  speak_response: { risk: "low", requires: ["valid_request"], audit_required: true },
  read_memory: { risk: "medium", requires: ["scope_match", "audit_event"], audit_required: true },
  write_memory: { risk: "high", requires: ["user_consent", "scope_match", "audit_event"], audit_required: true },
  execute_local_command: { risk: "high", requires: ["explicit_command", "scope_match", "circuit_closed", "audit_event"], audit_required: true },
  external_request: { risk: "blocked", requires: ["administrator_exception"], audit_required: true },
  change_policy: { risk: "critical", requires: ["administrator_consent", "ML-DSA-87 verification", "audit_event"], audit_required: true },
}

class SafetyGovernor {
  constructor({ capabilities = DEFAULT_CAPABILITIES, onDecision = () => {} } = {}) {
    this.capabilities = capabilities
    this.onDecision = onDecision
  }

  evaluate({ capability = "speak_response", consent = false, scopeMatch = true, circuitState = "closed", text = "" } = {}) {
    const policy = this.capabilities[capability]
    let decision = "allow"
    let reasonCode = "AUTHORIZED"
    let explanation = "The requested capability is authorized for this transition."
    let options = ["continue"]

    if (!policy) {
      decision = "deny"
      reasonCode = "UNKNOWN_CAPABILITY"
      explanation = "This capability is not registered and cannot be executed."
      options = ["ask_administrator", "cancel"]
    } else if (capability === "external_request" || /\b(?:disable|bypass|override)\b.*\b(?:guard|policy|safety|audit)\b/i.test(text)) {
      decision = "deny"
      reasonCode = "AUTONOMY_ESCALATION"
      explanation = "The request expands or bypasses system authority."
      options = ["continue_with_limited_permissions", "ask_administrator", "cancel"]
    } else if (/\b(?:secret|hidden|silent)\b.*\b(?:network|telemetry|storage|credential)\b/i.test(text)) {
      decision = "deny"
      reasonCode = "HIDDEN_BEHAVIOR"
      explanation = "Undeclared network, telemetry, storage, or credential behavior is not permitted."
      options = ["explain", "reject"]
    } else if (!scopeMatch) {
      decision = "deny"
      reasonCode = "SCOPE_VIOLATION"
      explanation = "The requested action is outside the authorized scope."
      options = ["request_scope", "cancel"]
    } else if (["write_memory", "change_policy"].includes(capability) && !consent) {
      decision = "needs_user"
      reasonCode = "CONSENT_REQUIRED"
      explanation = "This action changes persistent state and requires explicit user consent."
      options = ["save_temporarily", "save_permanently", "do_not_save"]
    } else if (circuitState !== "closed" && capability === "execute_local_command") {
      decision = "deny"
      reasonCode = "CIRCUIT_NOT_CLOSED"
      explanation = "The local execution circuit is not closed."
      options = ["retry_later", "cancel"]
    }

    const result = {
      decision,
      capability,
      reason_code: reasonCode,
      explanation,
      options,
      audit_required: policy ? policy.audit_required : true,
      network_allowed: false,
      verdict: { algorithm: "ML-DSA-87", signature_status: "unavailable" },
      decision_id: crypto.randomUUID(),
    }
    this.onDecision(result)
    return result
  }
}

module.exports = { DEFAULT_CAPABILITIES, SafetyGovernor }
