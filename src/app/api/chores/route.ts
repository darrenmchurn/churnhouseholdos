import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const chores = await prisma.chore.findMany({
    include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(chores)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { title, frequency, pointValue, assigneeId } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const chore = await prisma.chore.create({
    data: {
      title: title.trim(),
      frequency: frequency ?? "WEEKLY",
      pointValue: pointValue ?? 1,
      assigneeId: assigneeId || null,
    },
    include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
  })

  await logActivity(userId, "created", "chore", chore.title)

  return NextResponse.json(chore, { status: 201 })
}
