import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isConfigured } from "@/lib/google-calendar"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: "Google Calendar env vars not set (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID)",
    })
  }

  // Test the actual connection with a lightweight API call
  try {
    const { GoogleAuth } = await import("google-auth-library")
    const gcauth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/calendar"],
    })
    const client = await gcauth.getClient()
    const tokenResult = await client.getAccessToken()
    if (!tokenResult.token) throw new Error("Could not obtain access token")

    // Fetch calendar metadata — very lightweight, just verifies permissions
    const calId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!)
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}`,
      { headers: { Authorization: `Bearer ${tokenResult.token}` } }
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Calendar API ${res.status}: ${text}`)
    }

    const cal = await res.json() as { summary?: string }

    return NextResponse.json({
      configured: true,
      connected: true,
      calendarName: cal.summary ?? "Unknown calendar",
      message: `Connected to "${cal.summary}"`,
    })
  } catch (err) {
    return NextResponse.json({
      configured: true,
      connected: false,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
