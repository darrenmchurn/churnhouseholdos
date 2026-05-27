export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isConfigured, getMonthCalEvents } from "@/lib/google-calendar"
import { CalendarView } from "./CalendarView"
import { GcalStatusBanner } from "./GcalStatusBanner"
import type { CalEvent } from "@/lib/calendar-constants"

export default async function CalendarPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const canManage = session.user.role === "ADMIN" || session.user.role === "PARENT"

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const timeMin = new Date(year, month, 1)
  const timeMax = new Date(year, month + 1, 0, 23, 59, 59)

  let events: CalEvent[] = []

  if (isConfigured()) {
    // GCal is the source of truth — read all events from there
    try {
      events = await getMonthCalEvents(timeMin, timeMax)
    } catch (err) {
      console.error("GCal fetch failed, falling back to Prisma:", err)
      // Fall through to Prisma fallback below
    }
  }

  if (!isConfigured() || events.length === 0) {
    // No GCal or GCal returned nothing / errored — read from Prisma
    const prismaEvents = await prisma.event.findMany({
      where: { startDate: { gte: timeMin, lte: timeMax } },
      orderBy: { startDate: "asc" },
      include: { creator: { select: { name: true } } },
    })
    events = prismaEvents.map((e) => ({
      id:        e.id,
      gcalId:    e.gcalId ?? undefined,
      title:     e.title,
      description: e.description,
      startDate: e.startDate.toISOString(),
      endDate:   e.endDate?.toISOString() ?? null,
      allDay:    e.allDay,
      color:     e.color,
      creatorId: e.creatorId,
      creator:   e.creator,
    }))
  }

  const gcalConfigured = isConfigured()

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
      </div>

      {canManage && <GcalStatusBanner configured={gcalConfigured} />}

      <CalendarView
        initialEvents={events}
        initialYear={year}
        initialMonth={month}
        today={now.toISOString().slice(0, 10)}
        canManage={canManage}
      />
    </div>
  )
}
