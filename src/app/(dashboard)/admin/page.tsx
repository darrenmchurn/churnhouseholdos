export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/utils"
import { AnnouncementManager } from "./AnnouncementManager"

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const role = session.user.role
  if (role !== "ADMIN" && role !== "PARENT") redirect("/dashboard")

  const [users, announcements] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, role: true, avatarColor: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { name: true, avatarColor: true } } },
    }),
  ])

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your household</p>
      </div>

      {/* Family Members */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3">Family Members</h2>
        <div className="space-y-2">
          {users.map((user: { id: string; name: string; role: string; avatarColor: string; createdAt: Date }) => (
            <div key={user.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </section>

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
    </div>
  )
}
