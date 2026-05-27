export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AnnouncementManager } from "./AnnouncementManager"
import { UserList } from "./UserList"

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const role = session.user.role
  if (role !== "ADMIN" && role !== "PARENT") redirect("/dashboard")

  const isAdmin = role === "ADMIN"

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
        <UserList
          users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
          currentUserId={session.user.id}
          isAdmin={isAdmin}
        />
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
