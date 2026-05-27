export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatDate } from "@/lib/utils"
import { signOut } from "@/lib/auth"
import {
  CheckSquare,
  Sparkles,
  CalendarDays,
  ShoppingCart,
  LogOut,
} from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) return null

  const { id: userId, name, role, avatarColor } = session.user
  const today = new Date()
  const todayStart = new Date(today.setHours(0, 0, 0, 0))
  const todayEnd = new Date(today.setHours(23, 59, 59, 999))

  const isAdmin = role === "ADMIN"
  const isParent = role === "PARENT"
  const isKiosk = role === "KIOSK"
  const canSeeAll = isAdmin || isParent

  const [taskCount, choreCount, eventCount, groceryCount, announcements, upcomingEvents] =
    await Promise.all([
      prisma.task.count({
        where: {
          completed: false,
          ...(canSeeAll ? {} : { assigneeId: userId }),
        },
      }),
      prisma.chore.count({
        where: canSeeAll ? {} : { assigneeId: userId },
      }),
      prisma.event.count({
        where: {
          startDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.groceryItem.count({
        where: { completed: false },
      }),
      prisma.announcement.findMany({
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.event.findMany({
        where: { startDate: { gte: new Date() } },
        orderBy: { startDate: "asc" },
        take: 5,
        include: { creator: { select: { name: true } } },
      }),
    ])

  const stats = [
    { label: "Open Tasks", value: taskCount, icon: CheckSquare, color: "bg-blue-50 text-blue-600", href: "/tasks" },
    { label: "Chores", value: choreCount, icon: Sparkles, color: "bg-yellow-50 text-yellow-600", href: "/chores" },
    { label: "Events Today", value: eventCount, icon: CalendarDays, color: "bg-green-50 text-green-600", href: "/calendar" },
    ...(canSeeAll ? [{ label: "Grocery Items", value: groceryCount, icon: ShoppingCart, color: "bg-pink-50 text-pink-600", href: "/grocery" }] : []),
  ]

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{formatDate(new Date())}</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
            {isKiosk ? "Churn Household OS" : `Hey, ${name}!`}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {name[0].toUpperCase()}
          </div>
          {!isKiosk && (
            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/login" })
              }}
            >
              <button
                type="submit"
                className="w-11 h-11 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map((a: { id: string; title: string; body: string }) => (
            <div key={a.id} className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <p className="font-semibold text-indigo-900 text-sm">{a.title}</p>
              <p className="text-indigo-700 text-sm mt-0.5">{a.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <a
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-3 active:scale-95 transition-transform"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 leading-none">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            </a>
          )
        })}
      </div>

      {/* Upcoming events */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3">Upcoming Events</h2>
        {upcomingEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <CalendarDays size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No upcoming events</p>
            {canSeeAll && (
              <a href="/calendar" className="text-sm text-indigo-600 font-medium mt-1 inline-block">
                Add one →
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event: { id: string; title: string; startDate: Date; allDay: boolean; color: string }) => (
              <div key={event.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
                <div
                  className="w-2 self-stretch rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.color }}
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{event.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(event.startDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {!event.allDay && (
                      <> · {new Date(event.startDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kiosk: family login button */}
      {isKiosk && (
        <div className="fixed bottom-6 right-4">
          <a
            href="/login"
            className="flex items-center gap-2 h-11 px-4 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 text-sm font-medium"
          >
            Family Login
          </a>
        </div>
      )}
    </div>
  )
}
