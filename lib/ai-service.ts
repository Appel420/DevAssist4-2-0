import { config } from "./config"

type ChatTurn = {
  role: "user" | "assistant"
  content: string
}

class AIService {
  async generateResponse(message: string, context: ChatTurn[] = []) {
    const cleanMessage = message.trim()
    const lowerMessage = cleanMessage.toLowerCase()
    const recentContext = context.slice(-config.chat.maxHistory)
    const hasCodeContext = recentContext.some((turn) => turn.content.includes("```") || turn.content.includes("func "))

    if (!cleanMessage) {
      return "Please enter a message and I will respond locally."
    }

    if (lowerMessage.includes("swiftui") || lowerMessage.includes("swift")) {
      return [
        "Local Swift guidance:",
        "• Keep views small and composable.",
        "• Push business logic into view models.",
        "• Prefer system frameworks and local data stores.",
      ].join("\n")
    }

    if (lowerMessage.includes("test") || lowerMessage.includes("debug")) {
      return "Local debugging tip: reproduce the issue, reduce it to a small case, and verify the result with focused tests."
    }

    if (lowerMessage.includes("code") || hasCodeContext) {
      return `Here is a local-only example you can adapt:\n\n\`\`\`swift\nimport SwiftUI\n\nstruct ExampleView: View {\n    var body: some View {\n        Text(\"Local-only mode\")\n    }\n}\n\`\`\``
    }

    return `Local-only response: ${cleanMessage}\n\nI can help with Swift, SwiftUI, architecture, testing, and debugging without any external services.`
  }
}

export const aiService = new AIService()
