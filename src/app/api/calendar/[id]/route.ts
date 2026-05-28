import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { isConfigured, deleteEvent, updateEvent } from "@/lib/google-calendar"

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

  // Try to find the Prisma record by Prisma id or gcalId
  let prismaEvent = await prisma.event.findUnique({ where: { id } })
  if (!prismaEvent) prismaEvent = await prisma.event.findFirst({ where: { gcalId: id } })

  // Determine which GCal ID to update
  const gcalId = prismaEvent?.gcalId ?? (isConfigured() ? id : null)

  // Sync to GCal if configured
  if (isConfigured() && gcalId) {
    try {
      await updateEvent(gcalId, {
        ...(title && { summary: title }),
        ...(description !== undefined && { description }),
        ...(startDate && { start: startDate, allDay }),
        ...(endDate && { end: endDate, allDay }),
      })
    } catch (err) {
      console.error("GCal update failed:", err)
    }
  }

  // Update Prisma if we have a record
  if (prismaEvent) {
    const updated = await prisma.event.update({
      where: { id: prismaEvent.id },
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
    await logActivity(userId, "updated", "event", updated.title)
    return NextResponse.json({
      ...updated,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  }

  // GCal-only event — just log and return ok
  await logActivity(userId, "updated", "event", title ?? "calendar event")
  return NextResponse.json({ ok: true, gcalOnly: true })
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
