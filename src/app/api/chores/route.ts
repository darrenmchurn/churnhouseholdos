import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const chores = await prisma.chore.findMany({
    include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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

  // Place new chores at the end of the list
  const agg = await prisma.chore.aggregate({ _max: { sortOrder: true } })
  const sortOrder = (agg._max.sortOrder ?? -1) + 1

  const chore = await prisma.chore.create({
    data: {
      title: title.trim(),
      frequency: frequency ?? "ONE_TIME",
      pointValue: pointValue ?? 1,
      sortOrder,
      assigneeId: assigneeId || null,
    },
    include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
  })

  await logActivity(userId, "created", "chore", chore.title)

  return NextResponse.json(chore, { status: 201 })
}

/** Reorder chores: body = { order: string[] } — assigns sortOrder by array index */
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { order } = await req.json()
  if (!Array.isArray(order)) {
    return NextResponse.json({ error: "order must be an array of ids" }, { status: 400 })
  }

  await prisma.$transaction(
    (order as string[]).map((id, index) =>
      prisma.chore.update({ where: { id }, data: { sortOrder: index } })
    )
  )

  return NextResponse.json({ ok: true })
}
