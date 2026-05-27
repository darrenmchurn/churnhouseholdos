import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  const { id } = await props.params
  const canManageAll = role === "ADMIN" || role === "PARENT"

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Children can only toggle completion on their own tasks
  if (!canManageAll && task.assigneeId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()

  const updated = await prisma.task.update({
    where: { id },
    data: canManageAll
      ? {
          ...("title" in body && { title: body.title }),
          ...("description" in body && { description: body.description }),
          ...("dueDate" in body && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
          ...("priority" in body && { priority: body.priority }),
          ...("assigneeId" in body && { assigneeId: body.assigneeId }),
          ...("completed" in body && {
            completed: body.completed,
            completedAt: body.completed ? new Date() : null,
          }),
        }
      : {
          completed: body.completed,
          completedAt: body.completed ? new Date() : null,
        },
    include: {
      assignee: { select: { id: true, name: true, avatarColor: true } },
      creator: { select: { id: true, name: true } },
    },
  })

  if ("completed" in body) {
    await logActivity(
      userId,
      body.completed ? "completed" : "unchecked",
      "task",
      task.title,
    )
  } else if (canManageAll) {
    await logActivity(userId, "updated", "task", task.title)
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  const task = await prisma.task.findUnique({ where: { id }, select: { title: true } })
  await prisma.task.delete({ where: { id } })

  if (task) await logActivity(userId, "deleted", "task", task.title)

  return NextResponse.json({ ok: true })
}
