import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { isConfigured, createEvent, getMonthCalEvents } from "@/lib/google-calendar"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const timeMin = searchParams.get("timeMin")
  const timeMax = searchParams.get("timeMax")

  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: "timeMin and timeMax required" }, { status: 400 })
  }

  // When GCal is configured, read events from there so existing GCal events are visible
  if (isConfigured()) {
    try {
      const events = await getMonthCalEvents(new Date(timeMin), new Date(timeMax))
      return NextResponse.json(events)
    } catch (err) {
      console.error("GCal GET failed, falling back to Prisma:", err)
    }
  }

  // Fallback: read from Prisma
  const events = await prisma.event.findMany({
    where: {
      startDate: {
        gte: new Date(timeMin),
        lte: new Date(timeMax),
      },
    },
    orderBy: { startDate: "asc" },
    include: { creator: { select: { name: true } } },
  })

  return NextResponse.json(events.map((e) => ({
    id:        e.id,
    gcalId:    e.gcalId ?? undefined,
    title:     e.title,
    description: e.description,
    startDate: e.startDate.toISOString(),
    endDate:   e.endDate?.toISOString() ?? null,
    allDay:    e.allDay,
    color:     e.color,
    creatorId: e.creatorId,
  })))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, color, startDate, endDate, allDay } = body

  // 1. Always save to Prisma first
  const event = await prisma.event.create({
    data: {
      title,
      description: description || null,
      startDate: allDay ? new Date(startDate + "T12:00:00Z") : new Date(startDate),
      endDate: endDate
        ? allDay ? new Date(endDate + "T12:00:00Z") : new Date(endDate)
        : null,
      allDay: !!allDay,
      color: color || "#6366f1",
      creatorId: userId,
    },
    include: { creator: { select: { name: true } } },
  })

  // 2. Fire-and-forget sync to Google Calendar if configured
  if (isConfigured()) {
    try {
      const gcalEvent = await createEvent({
        summary: title,
        description: description || undefined,
        start: allDay ? startDate : `${startDate}`,
        end: allDay ? (endDate || startDate) : `${endDate || startDate}`,
        allDay,
      })
      // Store the GCal ID so we can delete it later
      await prisma.event.update({
        where: { id: event.id },
        data: { gcalId: gcalEvent.id },
      })
    } catch (err) {
      // Non-fatal — event is already saved to Prisma
      console.error("Google Calendar sync failed:", err)
    }
  }

  await logActivity(userId, "created", "event", title ?? "Untitled event")

  return NextResponse.json(
    {
      ...event,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    },
    { status: 201 }
  )
}
