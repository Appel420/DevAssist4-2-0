const { DataProcessor } = require("./data-processor")

class EnhancedChatBot {
  constructor() {
    this.dataProcessor = new DataProcessor()
    this.conversationHistory = []
  }

  async generateResponse(prompt, userId = "anonymous") {
    // Store conversation history
    this.conversationHistory.push({
      userId,
      prompt,
      timestamp: new Date().toISOString(),
    })

    // Check if input contains numerical sequences
    const hasNumbers = /\d{10,}/.test(prompt)

    if (hasNumbers) {
      return this.handleNumericalInput(prompt)
    }

    return this.handleTextInput(prompt)
  }

  handleNumericalInput(prompt) {
    const analysis = this.dataProcessor.generateDataResponse(prompt)

    const numericalResponses = [
      `${analysis} What would you like me to do with this data?`,
      `I've analyzed your numerical sequence. ${analysis} Need any calculations?`,
      `Interesting data pattern! ${analysis} How can I help you work with these numbers?`,
      `${analysis} Would you like me to perform any mathematical operations?`,
    ]

    return numericalResponses[Math.floor(Math.random() * numericalResponses.length)]
  }

  handleTextInput(prompt) {
    const lowerPrompt = prompt.toLowerCase()

    const responses = {
      hello: "Hello! I can help you with text, numbers, and data analysis.",
      data: "I can process and analyze numerical data. Just share your numbers!",
      numbers: "I love working with numbers! Share a sequence and I'll analyze it.",
      calculate: "I can perform calculations on your data. What do you need?",
      analyze: "I can analyze patterns in your numerical data. Try me!",
      help: "I can chat, process numerical data, and perform analysis. What do you need?",
    }

    // Check for keyword matches
    for (const [key, response] of Object.entries(responses)) {
      if (lowerPrompt.includes(key)) {
        return response
      }
    }

    // Default intelligent responses
    const defaultResponses = [
      `I understand you're asking about "${prompt}". How can I assist you?`,
      `That's interesting! Tell me more about "${prompt}".`,
      `I'm here to help with "${prompt}". What specifically do you need?`,
      `Thanks for sharing that. What would you like to know about "${prompt}"?`,
    ]

    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)]
  }

  getConversationStats(userId) {
    const userHistory = this.conversationHistory.filter((h) => h.userId === userId)
    return {
      totalMessages: userHistory.length,
      firstMessage: userHistory[0]?.timestamp,
      lastMessage: userHistory[userHistory.length - 1]?.timestamp,
    }
  }
}

module.exports = { EnhancedChatBot }
