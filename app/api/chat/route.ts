import { type NextRequest, NextResponse } from "next/server"
import { aiService } from "@/lib/ai-service"

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0] : "127.0.0.1"
  return ip
}

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxRequests = 50 // 50 requests per window

  const current = rateLimitStore.get(key)

  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request)
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 })
    }

    const body = await request.json()
    const { message, context = [] } = body

    // Input validation
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required and must be a string" }, { status: 400 })
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: "Message too long. Maximum 1000 characters." }, { status: 400 })
    }

    // Sanitize input
    const sanitizedMessage = message.trim().replace(/[<>]/g, "")

    // Build conversation context
    const systemPrompt = `You are DevAssist 4.2.0, an expert iOS development assistant. You specialize in:

- Swift programming language and best practices
- SwiftUI and UIKit development
- iOS app architecture (MVVM, MVC, Clean Architecture)
- Xcode debugging and optimization
- App Store guidelines and submission process
- Security best practices for iOS apps
- Performance optimization
- Core Data and local data persistence
- Networking and API integration
- Testing (Unit tests, UI tests)

Always provide:
- Accurate, up-to-date information
- Code examples when helpful
- Security considerations
- Best practices and Apple guidelines
- Clear, actionable advice

Format code blocks with proper syntax highlighting using triple backticks and language specification.`

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...context.slice(-10),
      { role: "user" as const, content: sanitizedMessage },
    ]

    const response = await aiService.generateResponse(sanitizedMessage, messages.slice(1))

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
      provider: "local",
      authenticated: true,
      developerMode: true,
    })
  } catch (error: any) {
    console.error("Chat API Error:", error)

    return NextResponse.json(
      {
        error: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 },
    )
  }
}
