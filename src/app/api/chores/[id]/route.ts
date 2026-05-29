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

  const body = await req.json()

  // ── Undo completion ──────────────────────────────────────────────────────────
  if ("undo" in body && body.undo) {
    // Admins/parents can undo any chore; kids can only undo their own
    if (!canManageAll && chore.completedById !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const whoCompleted = chore.completedById

    const updated = await prisma.chore.update({
      where: { id },
      data:  { lastCompleted: null, completedById: null },
      include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
    })

    // Reverse the points that were awarded
    if (whoCompleted && chore.pointValue > 0) {
      await prisma.pointTransaction.create({
        data: { userId: whoCompleted, points: -chore.pointValue, reason: `Undo: ${chore.title}` },
      })
    }

    await logActivity(userId, "uncompleted", "chore", chore.title)

    return NextResponse.json({
      ...updated,
      dueBy:         updated.dueBy         ? updated.dueBy.toISOString()         : null,
      lastCompleted: null,
      completedById: null,
    })
  }

  // ── Guard: non-manager can only touch their own chore ────────────────────────
  if (!canManageAll && chore.assigneeId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ── Edit fields (admin/parent only) ──────────────────────────────────────────
  const isEditUpdate = canManageAll && "title" in body

  const updated = await prisma.chore.update({
    where: { id },
    data: isEditUpdate
      ? {
          ...("title"      in body && { title:      body.title }),
          ...("frequency"  in body && { frequency:  body.frequency }),
          ...("pointValue" in body && { pointValue: body.pointValue }),
          ...("assigneeId" in body && { assigneeId: body.assigneeId || null }),
          ...("dueBy"      in body && { dueBy:      body.dueBy ? new Date(body.dueBy) : null }),
          ...("complete"   in body && body.complete && {
            lastCompleted: new Date(),
            completedById: userId,
          }),
        }
      : {
          // Plain completion (child marking their own chore done)
          lastCompleted: new Date(),
          completedById: userId,
        },
    include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
  })

  const isCompletion = !isEditUpdate || ("complete" in body && body.complete)
  if (isCompletion) {
    await logActivity(userId, "completed", "chore", chore.title)
    if (chore.pointValue > 0) {
      await prisma.pointTransaction.create({
        data: { userId, points: chore.pointValue, reason: `Chore: ${chore.title}` },
      })
    }
  } else {
    await logActivity(userId, "updated", "chore", chore.title)
  }

  return NextResponse.json({
    ...updated,
    dueBy:         updated.dueBy         ? updated.dueBy.toISOString()         : null,
    lastCompleted: updated.lastCompleted ? updated.lastCompleted.toISOString() : null,
  })
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
