export const dynamic = "force-dynamic"

import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatDate, chicagoDayRange, relTime } from "@/lib/utils"
import { signOut } from "@/lib/auth"
import { isConfigured, getUpcomingCalEvents } from "@/lib/google-calendar"
import type { CalEvent } from "@/lib/calendar-constants"
import {
  CheckSquare,
  Sparkles,
  CalendarDays,
  ShoppingCart,
  Star,
  Settings,
  History,
} from "lucide-react"
import { avatarTextColor } from "@/lib/utils"
import { KidsZoneSection } from "./KidsZoneSection"
import { AnnouncementCard } from "./AnnouncementCard"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) return null

  const { id: userId, role } = session.user
  // "Today" as the family experiences it (Chicago), not the server's UTC day
  const { start: todayStart, end: todayEnd } = chicagoDayRange()

  const isAdmin  = role === "ADMIN"
  const isParent = role === "PARENT"
  const isKiosk  = role === "KIOSK"
  const isChild  = role === "CHILD"
  const canSeeAll = isAdmin || isParent

  // Read name + avatarColor from DB so profile changes are reflected immediately
  // (the session JWT is only updated on re-login, so session.user.name can be stale)
  const [currentUser, taskCount, choreItems, eventCount, groceryCount, announcements, pointsAgg, kidsZoneTiles, recentActivity] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, avatarColor: true },
      }),
      prisma.task.count({
        where: {
          completed: false,
          ...(canSeeAll ? {} : { assigneeId: userId }),
        },
      }),
      prisma.chore.findMany({
        where: canSeeAll ? {} : { assigneeId: userId },
        select: { frequency: true, lastCompleted: true },
      }),
      prisma.event.count({
        where: { startDate: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.groceryItem.count({
        where: { completed: false },
      }),
      prisma.announcement.findMany({
        where: {
          // Not expired, and addressed to everyone (empty audience) or to this viewer
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
            { OR: [{ visibleToIds: { isEmpty: true } }, { visibleToIds: { has: userId } }] },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.pointTransaction.aggregate({
        where: { userId },
        _sum: { points: true },
      }),
      isChild
        ? prisma.kidsZoneTile.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } })
        : Promise.resolve([]),
      !isKiosk
        ? prisma.activityLog.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true, avatarColor: true } } },
          })
        : Promise.resolve([]),
    ])

  // Count only chores that are currently due (mirrors ChoreBoard.isDue logic)
  const FREQ_DAYS_DASH: Record<string, number> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 }
  const choreCount = choreItems.filter((c) => {
    if (c.frequency === "ONE_TIME") return !c.lastCompleted
    if (!c.lastCompleted) return true
    const days = FREQ_DAYS_DASH[c.frequency] ?? 7
    return Date.now() >= new Date(c.lastCompleted).getTime() + days * 86_400_000
  }).length

  const name        = currentUser?.name        ?? session.user.name ?? ""
  const avatarColor = currentUser?.avatarColor ?? session.user.avatarColor ?? "#6366f1"
  const myPoints    = pointsAgg._sum.points ?? 0

  // Fetch upcoming events — prefer GCal (shows all family events) with a
  // 3-second timeout, falling back to Prisma if GCal is slow or unconfigured
  let upcomingEvents: CalEvent[] = []
  if (isConfigured()) {
    try {
      upcomingEvents = await Promise.race([
        getUpcomingCalEvents(5),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("GCal timeout")), 3000)
        ),
      ])
      // GCal only knows its own colorId system — restore the hex colors we
      // actually stored in Prisma by cross-referencing on gcalId.
      const gcalIds = upcomingEvents.flatMap((e) => (e.gcalId ? [e.gcalId] : []))
      if (gcalIds.length > 0) {
        const stored = await prisma.event.findMany({
          where: { gcalId: { in: gcalIds } },
          select: { gcalId: true, color: true },
        })
        const colorMap: Record<string, string> = {}
        for (const s of stored) { if (s.gcalId) colorMap[s.gcalId] = s.color }
        upcomingEvents = upcomingEvents.map((e) =>
          e.gcalId && colorMap[e.gcalId] ? { ...e, color: colorMap[e.gcalId] } : e
        )
      }
    } catch {
      // GCal failed or timed out — fall back to Prisma
    }
  }

  if (upcomingEvents.length === 0) {
    const prismaEvents = await prisma.event.findMany({
      where: { startDate: { gte: todayStart } },
      orderBy: { startDate: "asc" },
      take: 5,
      include: { creator: { select: { name: true } } },
    })
    upcomingEvents = prismaEvents.map((e) => ({
      id:        e.id,
      gcalId:    e.gcalId ?? undefined,
      title:     e.title,
      description: e.description,
      startDate: e.startDate.toISOString(),
      endDate:   e.endDate?.toISOString() ?? null,
      allDay:    e.allDay,
      color:     e.color,
    }))
  }

  const stats = [
    { label: "Open Tasks",      value: taskCount,   icon: CheckSquare,  color: "bg-blue-100 text-blue-600",   href: "/tasks" },
    { label: "Chores Due",      value: choreCount,  icon: Sparkles,     color: "bg-amber-100 text-amber-600", href: "/chores" },
    { label: "Events Today",    value: eventCount,  icon: CalendarDays, color: "bg-emerald-100 text-emerald-600", href: "/calendar" },
    ...(canSeeAll ? [{ label: "Grocery Items", value: groceryCount, icon: ShoppingCart, color: "bg-rose-100 text-rose-600", href: "/grocery" }] : []),
  ]

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto space-y-6">
      {/* Header — gradient personality zone */}
      <div className="bg-gradient-to-br from-white to-indigo-50/50 rounded-3xl px-4 py-4 shadow-card-md flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-indigo-500">{formatDate(new Date())}</p>
          <h1 className="text-[1.6rem] font-bold text-slate-900 mt-1 leading-tight break-words">
            {isKiosk ? "Churn Household OS" : `Hey, ${name}! 👋`}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isKiosk && (
            <Link
              href="/prizes"
              className="flex items-center gap-1.5 bg-gradient-to-br from-amber-50 to-amber-100/70 rounded-2xl px-3 py-2 active:scale-95 transition-all shadow-card hover:shadow-card-md"
              title="View prizes"
            >
              <Star size={14} className="text-amber-500" fill="currentColor" />
              <span className="font-bold text-amber-700 text-sm leading-none">{myPoints}</span>
            </Link>
          )}
          {canSeeAll && (
            <Link
              href="/admin"
              className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 hover:shadow-card transition-all active:scale-90"
              title="Admin settings"
              aria-label="Admin settings"
            >
              <Settings size={17} />
            </Link>
          )}
          <Link
            href="/profile"
            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base shadow-card hover:shadow-card-md active:scale-90 transition-all ${avatarTextColor(avatarColor)}${avatarColor === "#ffffff" ? " ring-1 ring-slate-200" : ""}`}
            style={{ backgroundColor: avatarColor }}
            title="Profile & settings"
            aria-label="Profile & settings"
          >
            {(name[0] ?? "?").toUpperCase()}
          </Link>
        </div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map((a: { id: string; title: string; body: string; expiresAt: Date | null }) => (
            <AnnouncementCard
              key={a.id}
              announcement={{
                id: a.id,
                title: a.title,
                body: a.body,
                expiresLabel: a.expiresAt
                  ? `${a.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })} at ${a.expiresAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}`
                  : null,
              }}
            />
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-2xl p-5 shadow-card-md flex items-center gap-3 active:scale-95 transition-transform"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                <Icon size={21} />
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900 leading-none">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Kids Zone — Games & Learning (CHILD only) */}
      {isChild && <KidsZoneSection tiles={kidsZoneTiles} />}

      {/* Upcoming events */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3">Upcoming Events</h2>
        {upcomingEvents.length === 0 ? (
          <div className="bg-white rounded-2xl p-4 text-center shadow-card">
            <CalendarDays size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No upcoming events</p>
            {canSeeAll && (
              <Link href="/calendar" className="text-sm text-indigo-600 font-medium mt-1 inline-block">
                Add one →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-card">
                <div
                  className="w-1.5 self-stretch rounded-full flex-shrink-0 opacity-90"
                  style={{ backgroundColor: event.color }}
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{event.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(event.startDate).toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                      timeZone: "America/Chicago",
                    })}
                    {!event.allDay && (
                      <> · {new Date(event.startDate).toLocaleTimeString("en-US", {
                        hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
                      })}</>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity — replaces the dedicated /activity nav item */}
      {recentActivity.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <History size={16} className="text-slate-400" />
              Recent Activity
            </h2>
            <Link href="/activity" className="text-xs text-indigo-600 font-medium">
              See all →
            </Link>
          </div>
          <div className="bg-white rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-card-md">
            {recentActivity.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: log.user.avatarColor }}
                  aria-hidden="true"
                >
                  {log.user.name[0]}
                </div>
                <p className="text-sm text-slate-700 flex-1 min-w-0 truncate">
                  <span className="font-medium">{log.user.name}</span>{" "}
                  <span className="text-slate-500">{log.action}</span>{" "}
                  <span className="text-slate-600 italic">{log.entityTitle}</span>
                </p>
                <span className="text-xs text-slate-400 flex-shrink-0">{relTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kiosk: family login button — must sign the kiosk session out first,
          otherwise the proxy bounces /login straight back to /dashboard */}
      {isKiosk && (
        <div className="fixed bottom-6 right-4">
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-2 h-11 px-4 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 text-sm font-medium"
            >
              Family Login
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
