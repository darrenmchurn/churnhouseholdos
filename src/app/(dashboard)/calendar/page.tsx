export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isConfigured } from "@/lib/google-calendar"
import { CalendarView } from "./CalendarView"
import { GcalStatusBanner } from "./GcalStatusBanner"

export default async function CalendarPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const canManage = session.user.role === "ADMIN" || session.user.role === "PARENT"

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const timeMin = new Date(year, month, 1)
  const timeMax = new Date(year, month + 1, 0, 23, 59, 59)

  const events = await prisma.event.findMany({
    where: { startDate: { gte: timeMin, lte: timeMax } },
    orderBy: { startDate: "asc" },
    include: { creator: { select: { name: true } } },
  })

  const serialised = events.map((e) => ({
    ...e,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }))

  const gcalConfigured = isConfigured()

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
      </div>

      {/* Google Calendar connection status — shown to admins/parents only */}
      {canManage && <GcalStatusBanner configured={gcalConfigured} />}

      <CalendarView
        initialEvents={serialised}
        initialYear={year}
        initialMonth={month}
        today={now.toISOString().slice(0, 10)}
        canManage={canManage}
      />
    </div>
  )
}
