const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const { body, validationResult } = require("express-validator")
const winston = require("winston")

const app = express()
const DEFAULT_PORT = 3000

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
)

// CORS configuration
app.use(
  cors({
    origin:
      process.env.ALLOWED_ORIGINS?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean) || ["http://localhost:3000"],
    credentials: true,
    optionsSuccessStatus: 200,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
})

app.use("/api/", limiter)

// Body parsing
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "devassist-api" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
})

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  )
}

// Input validation middleware
const validateChatInput = [
  body("message")
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .escape()
    .withMessage("Message must be between 1 and 1000 characters"),
  body("deviceId").optional().isUUID().withMessage("Device ID must be a valid UUID"),
  body("timestamp").optional().isNumeric().withMessage("Timestamp must be numeric"),
]

// Health check endpoint
function handleHealthCheck(req, res) {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "4.2.0",
  })
}

app.get(["/api/v1/health", "/api/health"], handleHealthCheck)

// Chat endpoint
async function handleChat(req, res) {
  try {
    // Check validation results
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      })
    }

    const { message, deviceId, timestamp } = req.body

    // Log request (without sensitive data)
    logger.info("Chat request received", {
      messageLength: message.length,
      deviceId: deviceId ? "present" : "absent",
      timestamp,
    })

    // Process the message (replace with your AI logic)
    const response = await processMessage(message)

    // Send response
    res.json({
      message: response,
      timestamp: Date.now(),
    })

    logger.info("Chat response sent successfully")
  } catch (error) {
    logger.error("Chat endpoint error", { error: error.message, stack: error.stack })

    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred while processing your request.",
    })
  }
}

app.post(["/api/v1/chat", "/api/chat"], validateChatInput, handleChat)

// Message processing function
async function processMessage(message) {
  // Implement your AI/chatbot logic here
  // This is a simple example - replace with your actual implementation

  const responses = {
    hello: "Hello! How can I help you with your development questions today?",
    help: "I can assist you with coding questions, debugging, and development best practices.",
    api: "I can help you with API design, implementation, and troubleshooting.",
    security: "Security is crucial! I can help you implement secure coding practices.",
    ios: "I can help you with iOS development using Swift and SwiftUI.",
    javascript: "JavaScript is great! I can help with both frontend and backend JS development.",
  }

  const lowerMessage = message.toLowerCase()

  // Check for keyword matches
  for (const [keyword, response] of Object.entries(responses)) {
    if (lowerMessage.includes(keyword)) {
      return response
    }
  }

  // Default responses
  const defaultResponses = [
    `I understand you're asking about "${message}". Could you provide more specific details?`,
    `That's an interesting question about "${message}". What specific aspect would you like to explore?`,
    `I'd be happy to help with "${message}". Can you give me more context about what you're trying to achieve?`,
  ]

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)]
}

// Error handling middleware
app.use((error, req, res, _next) => {
  logger.error("Unhandled error", { error: error.message, stack: error.stack })

  res.status(500).json({
    error: "Internal server error",
    message: "An unexpected error occurred.",
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested endpoint does not exist.",
  })
})

const PORT = Number(process.env.PORT) || DEFAULT_PORT

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`)
    console.log(`🚀 DevAssist API server running on port ${PORT}`)
  })
}

module.exports = app
