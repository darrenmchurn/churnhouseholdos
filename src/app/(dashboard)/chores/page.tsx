export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ChoreBoard } from "./ChoreBoard"
import { ChoreForm } from "./ChoreForm"

export default async function ChoresPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const { id: userId, role } = session.user
  const canManage = role === "ADMIN" || role === "PARENT"

  const [chores, users] = await Promise.all([
    prisma.chore.findMany({
      include: {
        assignee:    { select: { id: true, name: true, avatarColor: true } },
        completedBy: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    canManage
      ? prisma.user.findMany({
          where: { role: { not: "KIOSK" } },
          select: { id: true, name: true, avatarColor: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chores</h1>
          <p className="text-slate-500 text-sm mt-0.5">{chores.length} chores</p>
        </div>
        {canManage && <ChoreForm users={users} />}
      </div>

      <ChoreBoard
        chores={chores as Parameters<typeof ChoreBoard>[0]["chores"]}
        users={users}
        userId={userId}
        canManage={canManage}
      />
    </div>
  )
}
