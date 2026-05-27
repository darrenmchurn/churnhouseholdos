import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { updateEvent, deleteEvent, isConfigured } from "@/lib/google-calendar"

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 })

  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  const body = await req.json()
  const event = await updateEvent(id, body)
  return NextResponse.json(event)
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 })

  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  await deleteEvent(id)
  return NextResponse.json({ ok: true })
}
