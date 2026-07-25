const assert = require("assert")
const { PolicyEngine, SCAREmitter, MCPPolicyAdapter } = require("./mcp-policy-adapter")
const { CouncilVerifier } = require("./council-verifier")
const { HallucinationGuard } = require("./hallucination-guard")
const { SovereignStateManager } = require("./sovereign-state-manager")

const policy = {
  version: "1.0.0",
  bridgeRequirements: { trustBoundary: "local-only", credentials: "disabled", shell: "disabled", mutation: false },
  workspacePolicy: { requireWorkspaceBoundary: true },
  capabilities: {
    workspace_read: { classification: "evidence", allowedModes: ["offline"], mutation: false, requiresApproval: false },
    restricted_tool: { classification: "restricted", allowedModes: ["offline"], mutation: false, requiresApproval: true, approvalAuthority: "user" },
    authority_tool: { classification: "authority", allowedModes: ["offline"], mutation: false, requiresApproval: false },
  },
}
const attestation = { trustBoundary: "local-only", credentials: "disabled", shell: "disabled", mutation: false }

test("policy engine denies authority tools", () => {
  const decision = new PolicyEngine(policy).decide({ tool: "authority_tool", mode: "offline", attestation, workspace: "/workspace" })
  assert.equal(decision.decision, "DENY")
})

test("policy engine escalates approval-required tools and emits SCAR", () => {
  const scar = new SCAREmitter()
  const decision = new PolicyEngine(policy, { scar }).decide({ tool: "restricted_tool", mode: "offline", attestation, workspace: "/workspace" })
  assert.equal(decision.decision, "ESCALATE")
  assert.equal(scar.events.length, 1)
})

test("council verifier flags disagreement", () => {
  const result = new CouncilVerifier().verify({ responses: [{ text: "A" }, { text: "B" }], candidate: "A" })
  assert.equal(result.status, "UNCERTAIN")
})

test("hallucination guard alerts on unsupported certainty", () => {
  const result = new HallucinationGuard().inspect({ candidate: "This is certainly verified.", council: { status: "SUPPORTED" }, evidence: [] })
  assert.equal(result.status, "HALLUCINATION_ALERT")
})

test("memory hydration requires explicit permission and state", () => {
  const state = new SovereignStateManager()
  assert.deepEqual(state.hydrate({ permissions: { memory_access: true } }, () => ["secret"]), [])
  state.grantMemory()
  assert.deepEqual(state.hydrate({ permissions: { memory_access: true } }, () => ["approved"]), ["approved"])
})

test("adapter invokes bridge only after ALLOW", async () => {
  let invoked = false
  const adapter = new MCPPolicyAdapter({ engine: new PolicyEngine(policy), bridge: { invoke: async () => { invoked = true; return { ok: true } } } })
  const result = await adapter.invoke({ tool: "workspace_read", mode: "offline", attestation, workspace: "/workspace", arguments: {} })
  assert.equal(result.decision.decision, "ALLOW")
  assert.equal(invoked, true)
})
