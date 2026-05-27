import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, role } = session.user
  const canSeeAll = role === "ADMIN" || role === "PARENT"

  const tasks = await prisma.task.findMany({
    where: canSeeAll ? {} : { assigneeId: id },
    include: {
      assignee: { select: { id: true, name: true, avatarColor: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  })

  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: creatorId, role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, dueDate, priority, assigneeId } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority ?? "MEDIUM",
      assigneeId: assigneeId || null,
      creatorId,
    },
    include: {
      assignee: { select: { id: true, name: true, avatarColor: true } },
      creator: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(task, { status: 201 })
}
