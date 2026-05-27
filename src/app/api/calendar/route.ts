import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const timeMin = searchParams.get("timeMin")
  const timeMax = searchParams.get("timeMax")

  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: "timeMin and timeMax required" }, { status: 400 })
  }

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

  // Serialise Dates to ISO strings for the client
  const serialised = events.map((e) => ({
    ...e,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }))

  return NextResponse.json(serialised)
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

  const event = await prisma.event.create({
    data: {
      title,
      description: description || null,
      // All-day events: treat the date string as noon UTC to avoid timezone day-shift
      startDate: allDay ? new Date(startDate + "T12:00:00Z") : new Date(startDate),
      endDate: endDate
        ? allDay
          ? new Date(endDate + "T12:00:00Z")
          : new Date(endDate)
        : null,
      allDay: !!allDay,
      color: color || "#6366f1",
      creatorId: userId,
    },
    include: { creator: { select: { name: true } } },
  })

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
