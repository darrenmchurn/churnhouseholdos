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

  const chore = await prisma.chore.findUnique({ where: { id } })
  if (!chore) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!canManageAll && chore.assigneeId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const isEditUpdate = canManageAll && "title" in body

  const updated = await prisma.chore.update({
    where: { id },
    data: isEditUpdate
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

  const isCompletion = !isEditUpdate || ("complete" in body && body.complete)
  if (isCompletion) {
    await logActivity(userId, "completed", "chore", chore.title)
    // Award points to whoever completed it (the requester)
    if (chore.pointValue > 0) {
      await prisma.pointTransaction.create({
        data: { userId, points: chore.pointValue, reason: `Chore: ${chore.title}` },
      })
    }
  } else {
    await logActivity(userId, "updated", "chore", chore.title)
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
  const chore = await prisma.chore.findUnique({ where: { id }, select: { title: true } })
  await prisma.chore.delete({ where: { id } })

  if (chore) await logActivity(userId, "deleted", "chore", chore.title)

  return NextResponse.json({ ok: true })
}
