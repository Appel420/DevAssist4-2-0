import { NextResponse } from "next/server"

export async function GET() {
  try {
    return NextResponse.json({
      status: "healthy",
      services: {
        runtime: "local",
        chat: "in-memory",
        api: "operational",
      },
      version: "4.2.0",
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Health check failed:", error)

    return NextResponse.json(
      {
        status: "unhealthy",
        error: error.message || "Service unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}
