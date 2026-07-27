const { authorizationDecision } = require("./local-control-plane")

test("unknown actor denial is user-visible and audited", () => {
  const result = authorizationDecision({ requestId: "req-unknown", actorType: "untrusted", capability: "speak_response", riskLevel: "low", confirmation: false, override: false, scopeMatch: true, scarEmitter: (event) => { expect(event.authorization.decision).toBe("ACCESS_DENIED") } })
  expect(result.decision).toBe("ACCESS_DENIED")
  expect(result.reason).toBe("unknown_actor")
  expect(result.ui_state).toBe("AccessDENIED")
  expect(result.user_alert).toBe(true)
})

test("model actor cannot authorize or override", () => {
  const result = authorizationDecision({ requestId: "req-model", actorType: "model", capability: "execute_local_command", riskLevel: "high", confirmation: true, override: true, scopeMatch: true })
  expect(result.decision).toBe("ACCESS_DENIED")
  expect(result.override).toBe(false)
})

test("delegated actor is authorized only within delegated capability", () => {
  const allowed = authorizationDecision({ requestId: "req-delegated", actorType: "delegated", capability: "speak_response", riskLevel: "low", confirmation: false, override: false, scopeMatch: true })
  const denied = authorizationDecision({ requestId: "req-delegated-scope", actorType: "delegated", capability: "write_repository", riskLevel: "high", confirmation: true, override: true, scopeMatch: false })
  expect(allowed.decision).toBe("DELEGATED_AUTHORIZED")
  expect(denied.decision).toBe("ACCESS_DENIED")
  expect(denied.reason).toBe("capability_scope_violation")
})

test("owner high-risk action requires confirmation and checkpoint", () => {
  const result = authorizationDecision({ requestId: "req-confirm", actorType: "owner", capability: "execute_local_command", riskLevel: "high", confirmation: false, override: false, scopeMatch: true })
  expect(result.decision).toBe("CONFIRMATION_REQUIRED")
  expect(result.checkpoint_id).toBe("checkpoint-req-confirm")
  expect(result.scar_id).toMatch(/^scar-/)
})

test("owner override is one action, expires at transaction end, and cannot mutate policy", () => {
  const result = authorizationDecision({ requestId: "req-override", actorType: "owner", capability: "execute_local_command", riskLevel: "critical", confirmation: true, override: true, scopeMatch: true })
  expect(result.decision).toBe("OWNER_OVERRIDE")
  expect(result.override_scope).toBe("single_action")
  expect(result.override_lifetime).toBe("transaction_end")
  expect(result.policy_modified).toBe(false)
})

test("delegated high-risk actor cannot self-escalate through confirmation", () => {
  const result = authorizationDecision({ requestId: "req-delegated-high", actorType: "delegated", capability: "execute_local_command", riskLevel: "high", confirmation: true, override: true, scopeMatch: true })
  expect(result.decision).toBe("ACCESS_DENIED")
  expect(result.reason).toBe("owner_confirmation_required")
})
