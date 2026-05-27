export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { TaskList } from "./TaskList"
import { TaskForm } from "./TaskForm"

export default async function TasksPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const { id: userId, role } = session.user
  const canManage = role === "ADMIN" || role === "PARENT"
  const canSeeAll = canManage

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({
      where: canSeeAll ? {} : { assigneeId: userId },
      include: {
        assignee: { select: { id: true, name: true, avatarColor: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
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
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {tasks.filter((t) => !t.completed).length} active
          </p>
        </div>
        {canManage && <TaskForm users={users} />}
      </div>

      <TaskList
        tasks={tasks as Parameters<typeof TaskList>[0]["tasks"]}
        userId={userId}
        canManage={canManage}
      />
    </div>
  )
}
