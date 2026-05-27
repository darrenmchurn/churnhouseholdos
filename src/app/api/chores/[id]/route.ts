import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  const { id } = await props.params
  const canManageAll = role === "ADMIN" || role === "PARENT"

  const chore = await prisma.chore.findUnique({ where: { id } })
  if (!chore) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!canManageAll && chore.assigneeId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()

  const updated = await prisma.chore.update({
    where: { id },
    data: canManageAll && "title" in body
      ? {
          ...("title" in body && { title: body.title }),
          ...("frequency" in body && { frequency: body.frequency }),
          ...("pointValue" in body && { pointValue: body.pointValue }),
          ...("assigneeId" in body && { assigneeId: body.assigneeId }),
          ...("complete" in body && body.complete && { lastCompleted: new Date() }),
        }
      : { lastCompleted: new Date() },
    include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  await prisma.chore.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
