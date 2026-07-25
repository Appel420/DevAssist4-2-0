class SovereignStateManager {
  constructor(initial = {}) {
    this.state = {
      owner: "local_user",
      memory_mode: "stateless",
      device_mode: "local_first",
      network_mode: "explicit_permission",
      model_council: "enabled",
      audit_mode: "immutable",
      ...initial,
    }
  }

  snapshot() { return Object.freeze({ ...this.state }) }
  grantMemory() { this.state.memory_mode = "stateful"; return this.snapshot() }
  revokeMemory() { this.state.memory_mode = "stateless"; return this.snapshot() }
  memoryAllowed(request) { return request?.permissions?.memory_access === true && this.state.memory_mode === "stateful" }
  hydrate(request, loader) { return this.memoryAllowed(request) ? loader() : [] }
}

module.exports = { SovereignStateManager }
