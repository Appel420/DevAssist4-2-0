const express = require("express")
const router = express.Router()

class DataProcessor {
  constructor() {
    this.processedData = new Map()
  }

  // Process numerical sequences for various use cases
  processNumberSequence(sequence) {
    const numbers = this.parseSequence(sequence)

    return {
      count: numbers.length,
      sum: numbers.reduce((a, b) => a + b, 0),
      average: numbers.reduce((a, b) => a + b, 0) / numbers.length,
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      unique: [...new Set(numbers)].length,
      sequence: numbers,
    }
  }

  parseSequence(input) {
    // Handle various number formats
    const cleanInput = input.toString().replace(/[^\d]/g, "")
    const numbers = []

    // Parse as individual digits
    for (let i = 0; i < cleanInput.length; i++) {
      numbers.push(Number.parseInt(cleanInput[i]))
    }

    return numbers
  }

  // Generate chat responses based on numerical data
  generateDataResponse(sequence) {
    const analysis = this.processNumberSequence(sequence)

    const responses = [
      `I see a sequence of ${analysis.count} numbers with an average of ${analysis.average.toFixed(2)}.`,
      `The sequence ranges from ${analysis.min} to ${analysis.max} with ${analysis.unique} unique values.`,
      `Interesting numerical pattern! The sum is ${analysis.sum}.`,
      `This sequence contains ${analysis.count} digits. Would you like me to analyze it further?`,
    ]

    return responses[Math.floor(Math.random() * responses.length)]
  }
}

// API endpoint for processing numerical data
router.post("/process-data", (req, res) => {
  try {
    const { data } = req.body
    const processor = new DataProcessor()

    if (!data) {
      return res.status(400).json({
        error: "Data is required",
        response: "Please provide numerical data to process.",
      })
    }

    const analysis = processor.processNumberSequence(data)
    const chatResponse = processor.generateDataResponse(data)

    res.json({
      analysis,
      response: chatResponse,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Data processing error:", error)
    res.status(500).json({
      error: "Processing failed",
      response: "Unable to process the numerical data.",
    })
  }
})

module.exports = { DataProcessor, router }
