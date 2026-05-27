import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { isConfigured, deleteEvent } from "@/lib/google-calendar"

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  const body = await req.json()
  const { title, description, color, startDate, endDate, allDay } = body

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(color !== undefined && { color }),
      ...(startDate !== undefined && {
        startDate: allDay ? new Date(startDate + "T12:00:00Z") : new Date(startDate),
      }),
      ...(endDate !== undefined && {
        endDate: endDate
          ? allDay ? new Date(endDate + "T12:00:00Z") : new Date(endDate)
          : null,
      }),
      ...(allDay !== undefined && { allDay }),
    },
    include: { creator: { select: { name: true } } },
  })

  await logActivity(userId, "updated", "event", event.title)

  return NextResponse.json({
    ...event,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  })
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params

  // Try to find by Prisma ID first, then by gcalId
  // (When GCal is the source, the event id coming from the UI is the GCal event ID)
  let event = await prisma.event.findUnique({ where: { id } })
  if (!event) {
    event = await prisma.event.findFirst({ where: { gcalId: id } })
  }

  if (event) {
    await prisma.event.delete({ where: { id: event.id } })
    // Also remove from GCal if synced
    if (event.gcalId && isConfigured()) {
      try { await deleteEvent(event.gcalId) } catch (err) {
        console.error("GCal delete sync failed:", err)
      }
    }
    await logActivity(userId, "deleted", "event", event.title)
  } else if (isConfigured()) {
    // Event exists only in GCal (created outside the app) — delete directly
    try {
      await deleteEvent(id)
      await logActivity(userId, "deleted", "event", "calendar event")
    } catch (err) {
      console.error("GCal-only delete failed:", err)
      return NextResponse.json({ error: "Delete failed" }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
