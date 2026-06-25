import { type NextRequest, NextResponse } from "next/server"

// In-memory session store (in production, use a database)
const sessions = new Map<
  string,
  {
    id: string
    title: string
    created_at: string
    messages: Array<{ role: string; content: string; timestamp: string }>
  }
>()

export async function POST(request: NextRequest) {
  try {
    const { title = "DevAssist Session" } = await request.json()

    const sessionId = crypto.randomUUID()
    const session = {
      id: sessionId,
      title,
      created_at: new Date().toISOString(),
      messages: [],
    }

    sessions.set(sessionId, session)

    return NextResponse.json(session)
  } catch (error) {
    console.error("Session creation error:", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("id")

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 })
  }

  const session = sessions.get(sessionId)

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  return NextResponse.json(session)
}
