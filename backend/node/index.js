const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const { body, validationResult } = require("express-validator")
const winston = require("winston")
const { LocalStateStore } = require("./state-store")
const { createShortcutRoute } = require("./local-control-plane")

const app = express()
const HOST = process.env.HOST || "127.0.0.1"
const PORT = Number(process.env.PORT || process.env.BRIDGE_PORT) || 0
const stateStore = new LocalStateStore()
const rateLimitWindowMs = 15 * 60 * 1000
const rateLimitMax = Number(process.env.DEVASSIST_RATE_LIMIT_MAX || 100)

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], imgSrc: ["'self'", "data:", "https:"] } } }))
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) || true, credentials: true, optionsSuccessStatus: 200 }))
app.use("/api/", rateLimit({ windowMs: rateLimitWindowMs, max: rateLimitMax, standardHeaders: true, legacyHeaders: false, handler: (req, res) => { stateStore.recordUsage({ rateLimited: true }); res.status(429).json({ error: "Rate limit exceeded", retryAfterSeconds: Math.ceil(rateLimitWindowMs / 1000) }) } }))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

const logger = winston.createLogger({ level: "info", format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()), defaultMeta: { service: "devassist-api" }, transports: [new winston.transports.File({ filename: "error.log", level: "error" }), new winston.transports.File({ filename: "combined.log" })] })
if (process.env.NODE_ENV !== "production") logger.add(new winston.transports.Console({ format: winston.format.simple() }))

function composeLiveResponse(message, overrides = {}) {
  const runtimeMode = overrides.runtimeMode || stateStore.state.runtimeMode
  const selectedModel = overrides.modelId ? stateStore.supportedModels.find((model) => model.id === overrides.modelId) || stateStore.selectedModel : stateStore.selectedModel
  const maxTokens = overrides.maxTokens || stateStore.state.maxTokens
  const tokens = Math.min(maxTokens, Math.max(1, Math.ceil(message.length / 4)))
  return [`Live local runtime: ${runtimeMode}.`, `Active model: ${selectedModel.label} (${selectedModel.id}).`, `Token budget: ${tokens}/${maxTokens}.`, `Memory entries: ${stateStore.state.memory.length}.`].join(" ")
}

const validateChatInput = [body("message").isString().trim().isLength({ min: 1, max: 1000 }).escape(), body("deviceId").optional().isUUID(), body("timestamp").optional().isNumeric(), body("maxTokens").optional().isInt({ min: 1, max: 8192 }), body("modelId").optional().isString().trim().isLength({ min: 1, max: 120 }), body("runtimeMode").optional().isIn(["offline", "hybrid", "online"])]
function handleHealthCheck(req, res) { res.json({ status: "healthy", timestamp: new Date().toISOString(), version: "4.2.0", localOnly: HOST === "127.0.0.1" || HOST === "localhost" }) }
function handleSecurityReport(req, res) { res.json(stateStore.getSecurityReport()) }
function handleModels(req, res) { res.json({ active: stateStore.selectedModel, models: stateStore.supportedModels }) }
function handleModelSelection(req, res) { try { res.json({ active: stateStore.selectModel(req.body.modelId) }) } catch (error) { res.status(400).json({ error: error.message }) } }
function handleRuntimeMode(req, res) { try { res.json({ runtimeMode: stateStore.setRuntimeMode(req.body.runtimeMode) }) } catch (error) { res.status(400).json({ error: error.message }) } }
function handleMaxTokens(req, res) { try { res.json({ maxTokens: stateStore.setMaxTokens(req.body.maxTokens) }) } catch (error) { res.status(400).json({ error: error.message }) } }
function handleMemoryList(req, res) { res.json({ memory: stateStore.listMemory() }) }
function handleMemoryCreate(req, res) { try { res.status(201).json({ memory: stateStore.addMemory(req.body) }) } catch (error) { res.status(400).json({ error: error.message }) } }
function handleMemoryDelete(req, res) { try { stateStore.deleteMemory(req.params.id, { confirmDelete: req.header("X-DevAssist-Confirm-Delete") === "true", signature: req.header("X-DevAssist-Delete-Signature") }); res.status(204).end() } catch (error) { res.status(error.statusCode || 400).json({ error: error.message }) } }
function handleChat(req, res) { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: "Validation failed", details: errors.array() }); const { message, maxTokens, modelId, runtimeMode } = req.body; if (runtimeMode) stateStore.setRuntimeMode(runtimeMode); if (maxTokens !== undefined) stateStore.setMaxTokens(maxTokens); stateStore.recordUsage(); res.json({ message: composeLiveResponse(message, { runtimeMode, modelId, maxTokens }), model: modelId || stateStore.selectedModel.id, runtimeMode: runtimeMode || stateStore.state.runtimeMode, maxTokens: maxTokens || stateStore.state.maxTokens, timestamp: Date.now() }) }

app.get(["/api/v1/health", "/api/health"], handleHealthCheck)
app.get(["/api/v1/security/report", "/api/security/report"], handleSecurityReport)
app.get(["/api/v1/models", "/api/models"], handleModels)
app.post(["/api/v1/models/active", "/api/models/active"], handleModelSelection)
app.post(["/api/v1/runtime/mode", "/api/runtime/mode"], handleRuntimeMode)
app.post(["/api/v1/runtime/max-tokens", "/api/runtime/max-tokens"], handleMaxTokens)
app.get(["/api/v1/memory", "/api/memory"], handleMemoryList)
app.post(["/api/v1/memory", "/api/memory"], handleMemoryCreate)
app.delete(["/api/v1/memory/:id", "/api/memory/:id"], handleMemoryDelete)
app.post(["/api/v1/chat", "/api/chat"], validateChatInput, handleChat)
app.post("/api/v1/shortcut/route", createShortcutRoute({ composeResponse: composeLiveResponse, stateStore, logger }))
app.use((error, req, res, _next) => { logger.error("Unhandled error", { error: error.message, stack: error.stack }); res.status(500).json({ error: "Internal server error" }) })
app.use("*", (req, res) => res.status(404).json({ error: "Not found" }))
if (require.main === module) app.listen(PORT, HOST, () => console.log(`DevAssist API server running on ${HOST}:${PORT}`))
module.exports = app
