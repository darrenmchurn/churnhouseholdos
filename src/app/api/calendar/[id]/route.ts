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
  const event = await prisma.event.findUnique({ where: { id } })

  // Delete from Prisma
  await prisma.event.delete({ where: { id } })

  // Fire-and-forget: also delete from Google Calendar if synced
  if (event?.gcalId && isConfigured()) {
    try {
      await deleteEvent(event.gcalId)
    } catch (err) {
      console.error("Google Calendar delete sync failed:", err)
    }
  }

  await logActivity(userId, "deleted", "event", event?.title ?? "calendar event")

  return NextResponse.json({ ok: true })
}
