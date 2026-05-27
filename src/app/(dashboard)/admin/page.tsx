export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/utils"

export default async function AdminPage() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard")

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, avatarColor: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your family hub</p>
      </div>

      <div>
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
      </div>

      <div className="bg-slate-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-1">More admin features coming in Phase 2</p>
        <p className="text-xs text-slate-500">Password changes, chore points, notifications, and more.</p>
      </div>
    </div>
  )
}
