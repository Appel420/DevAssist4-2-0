const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const DEFAULT_MODELS = [
  { id: "local-text", label: "Local Text Model", type: "llm", supportsVision: false },
  { id: "local-vision", label: "Local Vision Model", type: "vlm", supportsVision: true },
  { id: "hybrid-local", label: "Hybrid Local Model", type: "llm", supportsVision: true },
]

class LocalStateStore {
  constructor(filePath = process.env.DEVASSIST_STATE_PATH || path.join(__dirname, ".devassist-state.json")) {
    this.filePath = filePath
    this.secret = process.env.DEVASSIST_STATE_SECRET || "devassist-local-secret"
    this.state = this.load()
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return this.defaultState()
    }

    try {
      const contents = fs.readFileSync(this.filePath, "utf8")
      return { ...this.defaultState(), ...JSON.parse(contents) }
    } catch {
      return this.defaultState()
    }
  }

  defaultState() {
    return {
      runtimeMode: "offline",
      selectedModelId: DEFAULT_MODELS[0].id,
      maxTokens: 2048,
      memory: [],
      usage: {
        requests: 0,
        rateLimitedResponses: 0,
        lastRequestAt: null,
      },
    }
  }

  persist() {
    const directory = path.dirname(this.filePath)
    fs.mkdirSync(directory, { recursive: true })
    const tempFile = `${this.filePath}.tmp`
    fs.writeFileSync(tempFile, JSON.stringify(this.state, null, 2))
    fs.renameSync(tempFile, this.filePath)
  }

  get supportedModels() {
    return DEFAULT_MODELS
  }

  get selectedModel() {
    return this.supportedModels.find((model) => model.id === this.state.selectedModelId) || this.supportedModels[0]
  }

  setRuntimeMode(runtimeMode) {
    if (!["offline", "hybrid", "online"].includes(runtimeMode)) {
      throw new Error("Unsupported runtime mode")
    }

    this.state.runtimeMode = runtimeMode
    this.persist()
    return this.state.runtimeMode
  }

  selectModel(modelId) {
    const model = this.supportedModels.find((entry) => entry.id === modelId)
    if (!model) {
      throw new Error("Unsupported model")
    }

    this.state.selectedModelId = model.id
    this.persist()
    return model
  }

  setMaxTokens(maxTokens) {
    const parsed = Number(maxTokens)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8192) {
      throw new Error("Max tokens must be between 1 and 8192")
    }

    this.state.maxTokens = parsed
    this.persist()
    return parsed
  }

  addMemory({ content, kind = "text", author = "owner", signature }) {
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Memory content is required")
    }

    const trimmed = content.trim()
    const entry = {
      id: crypto.randomUUID(),
      content: trimmed,
      kind,
      author,
      createdAt: new Date().toISOString(),
      signature: signature || this.sign(trimmed),
    }

    this.state.memory.unshift(entry)
    this.persist()
    return entry
  }

  deleteMemory(id, { confirmDelete, signature }) {
    if (confirmDelete !== true) {
      const error = new Error("Deletion requires explicit confirmation")
      error.statusCode = 403
      throw error
    }

    const entry = this.state.memory.find((memory) => memory.id === id)

    if (!entry) {
      const error = new Error("Memory entry not found")
      error.statusCode = 404
      throw error
    }

    if (signature !== entry.signature) {
      const error = new Error("Deletion signature is invalid")
      error.statusCode = 403
      throw error
    }

    this.state.memory = this.state.memory.filter((entry) => entry.id !== id)

    this.persist()
    return true
  }

  recordUsage({ rateLimited = false } = {}) {
    this.state.usage.requests += 1
    this.state.usage.lastRequestAt = new Date().toISOString()

    if (rateLimited) {
      this.state.usage.rateLimitedResponses += 1
    }

    this.persist()
  }

  sign(value) {
    return crypto.createHmac("sha256", this.secret).update(String(value)).digest("hex")
  }

  getSecurityReport() {
    const usage = this.state.usage
    const alerts = []

    if (usage.rateLimitedResponses > 0) {
      alerts.push("Rate limiting has been triggered at least once.")
    }

    if (this.state.memory.length > 0) {
      alerts.push("Persistent memory is active and deletions are gated by signature.")
    }

    return {
      runtimeMode: this.state.runtimeMode,
      localOnly: true,
      selectedModel: this.selectedModel,
      supportedModels: this.supportedModels,
      maxTokens: this.state.maxTokens,
      memory: {
        count: this.state.memory.length,
        deleteGateEnabled: true,
        signedEntries: this.state.memory.filter((entry) => Boolean(entry.signature)).length,
      },
      usage: {
        requests: usage.requests,
        rateLimitedResponses: usage.rateLimitedResponses,
        lastRequestAt: usage.lastRequestAt,
        alerts,
      },
      signature: {
        algorithm: "HMAC-SHA256",
        memoryDeleteSignature: "required",
      },
    }
  }

  listMemory() {
    return [...this.state.memory]
  }
}

module.exports = { LocalStateStore }
