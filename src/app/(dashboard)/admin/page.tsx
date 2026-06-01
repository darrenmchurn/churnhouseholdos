export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AnnouncementManager } from "./AnnouncementManager"
import { UserList } from "./UserList"
import { KidsZoneTileManager } from "./KidsZoneTileManager"

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const role = session.user.role
  if (role !== "ADMIN" && role !== "PARENT") redirect("/dashboard")

  const isAdmin = role === "ADMIN"

  const [users, announcements, kidsZoneTiles] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, role: true, avatarColor: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { name: true, avatarColor: true } } },
    }),
    prisma.kidsZoneTile.findMany({ orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your household</p>
      </div>

      {/* Announcements */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3">Announcements</h2>
        <AnnouncementManager
          announcements={announcements.map((a) => ({
            ...a,
            expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      </section>

      {/* Family Members */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3">Family Members</h2>
        <UserList
          users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
          currentUserId={session.user.id}
          isAdmin={isAdmin}
        />
      </section>

      {/* Kids Zone Tiles */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3">🎮 Kids Zone Tiles</h2>
        <KidsZoneTileManager initialTiles={kidsZoneTiles} />
      </section>

      {/* How everything works — collapsed by default to reduce page length */}
      <section>
        <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <summary className="px-4 py-3.5 flex items-center justify-between cursor-pointer select-none list-none text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            How It Works
            <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-4 pb-4 pt-2 space-y-4 text-sm text-slate-700 border-t border-slate-100">

          <div>
            <p className="font-semibold text-slate-900 mb-1.5">👥 Roles</p>
            <ul className="space-y-1 pl-1">
              <li><span className="font-medium">Admin</span> — Full access: manage users, roles, chores, tasks, prizes, announcements, grocery list, and calendar.</li>
              <li><span className="font-medium">Parent</span> — Same as Admin except cannot change user roles or passwords.</li>
              <li><span className="font-medium">Child</span> — Can view and complete their own assigned chores and tasks. Can see the leaderboard and redeem prizes. Cannot manage others.</li>
              <li><span className="font-medium">Kiosk</span> — Display-only dashboard (no login required after setup). Shows family events and announcements. Hides all management features.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-900 mb-1.5">✅ Tasks</p>
            <ul className="space-y-1 pl-1">
              <li>One-off to-do items with optional due dates, priorities, and assignees.</li>
              <li>Admins/Parents can see all tasks; Children only see tasks assigned to them.</li>
              <li>Completing a task does not award points — use Chores for point-earning work.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-900 mb-1.5">🧹 Chores</p>
            <ul className="space-y-1 pl-1">
              <li>Can be <span className="font-medium">One-time</span> (single task, clears when done) or recurring: Daily, Weekly, Every 2 weeks, Monthly.</li>
              <li>Each chore has a <span className="font-medium">point value</span> — points are awarded to whoever marks it done.</li>
              <li>The home screen "Chores" count shows only chores that are currently due.</li>
              <li>Recurring chores reset automatically after their interval and show as due again.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-900 mb-1.5">🏆 Points &amp; Prizes</p>
            <ul className="space-y-1 pl-1">
              <li>Points are earned by completing chores.</li>
              <li>The Prizes page shows a catalogue of rewards; each prize has a point cost.</li>
              <li>Children can redeem prizes from their accumulated points balance.</li>
              <li>Admins/Parents create prizes and can see the full leaderboard.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-900 mb-1.5">📅 Calendar</p>
            <ul className="space-y-1 pl-1">
              <li>Family events stored in-app. Optionally syncs with a Google Calendar via a service account.</li>
              <li>Event colors match the family's avatar colors for quick visual identification.</li>
              <li>Admins/Parents can add, edit, and delete events; Children can view only.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-900 mb-1.5">📣 Announcements</p>
            <ul className="space-y-1 pl-1">
              <li>Pinned messages shown at the top of every family member's home screen.</li>
              <li>Optional expiry date/time (CST). Expired announcements auto-hide from the home screen but remain visible here until deleted.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-900 mb-1.5">🛒 Grocery List</p>
            <ul className="space-y-1 pl-1">
              <li>Shared shopping list visible to Admins and Parents.</li>
              <li>Items can be checked off when purchased; checked items can be cleared in bulk.</li>
            </ul>
          </div>

          </div>
        </details>
      </section>
    </div>
  )
}
