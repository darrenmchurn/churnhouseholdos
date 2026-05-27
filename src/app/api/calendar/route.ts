import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getEvents, createEvent, isConfigured } from "@/lib/google-calendar"
import { logActivity } from "@/lib/activity"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const timeMin = searchParams.get("timeMin")
  const timeMax = searchParams.get("timeMax")

  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: "timeMin and timeMax required" }, { status: 400 })
  }

  const events = await getEvents(new Date(timeMin), new Date(timeMax))
  return NextResponse.json(events)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 })

  const { id: userId, role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const event = await createEvent(body)

  await logActivity(userId, "created", "event", body.summary ?? "Untitled event")

  return NextResponse.json(event, { status: 201 })
}
