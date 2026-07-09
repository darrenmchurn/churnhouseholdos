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

    // Chore update + star reversal succeed or fail together
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.chore.update({
        where: { id },
        data:  { lastCompleted: null, completedById: null },
        include: {
          assignee:    { select: { id: true, name: true, avatarColor: true } },
          completedBy: { select: { id: true, name: true, avatarColor: true } },
        },
      })
      if (whoCompleted && chore.pointValue > 0) {
        await tx.pointTransaction.create({
          data: { userId: whoCompleted, points: -chore.pointValue, reason: `Undo: ${chore.title}` },
        })
      }
      return u
    })

    await logActivity(userId, "uncompleted", "chore", chore.title)

    return NextResponse.json({
      ...updated,
      dueBy:         updated.dueBy ? updated.dueBy.toISOString() : null,
      lastCompleted: null,
      completedById: null,
      completedBy:   null,
    })
  }

  // ── Guard: non-manager can only touch their own chore ────────────────────────
  if (!canManageAll && chore.assigneeId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ── Edit fields (admin/parent only) ──────────────────────────────────────────
  const isEditUpdate = canManageAll && "title" in body

  // ── Reassign who completed (admin/parent only) ───────────────────────────────
  // Body contains `completedById` only when the chore was already completed.
  // Handles three cases:
  //   old→new  : deduct from old, award to new, keep lastCompleted
  //   old→null : deduct from old, clear lastCompleted
  //   null→new : award to new, set lastCompleted (shouldn't normally happen via
  //              the edit modal, but guard it anyway)
  if (isEditUpdate && "completedById" in body) {
    const oldCompleter = chore.completedById
    const newCompleter: string | null = body.completedById ?? null

    // Determine lastCompleted for the update
    let newLastCompleted: Date | null
    if (newCompleter === null) {
      newLastCompleted = null                       // clearing the completion
    } else if (chore.lastCompleted) {
      newLastCompleted = chore.lastCompleted        // keep existing timestamp
    } else {
      newLastCompleted = new Date()                 // back-fill
    }

    // Star transfer + chore update succeed or fail together
    const updated = await prisma.$transaction(async (tx) => {
      if (oldCompleter !== newCompleter && chore.pointValue > 0) {
        const txns: { userId: string; points: number; reason: string }[] = []
        if (oldCompleter) {
          txns.push({ userId: oldCompleter, points: -chore.pointValue, reason: `Reassigned: ${chore.title}` })
        }
        if (newCompleter) {
          txns.push({ userId: newCompleter, points: chore.pointValue, reason: `Chore: ${chore.title}` })
        }
        if (txns.length) await tx.pointTransaction.createMany({ data: txns })
      }

      return tx.chore.update({
        where: { id },
        data: {
          ...("title"      in body && { title:      body.title }),
          ...("frequency"  in body && { frequency:  body.frequency }),
          ...("pointValue" in body && { pointValue: body.pointValue }),
          ...("assigneeId" in body && { assigneeId: body.assigneeId || null }),
          ...("dueBy"      in body && { dueBy:      body.dueBy ? new Date(body.dueBy) : null }),
          lastCompleted: newLastCompleted,
          completedById: newCompleter,
        },
        include: {
          assignee:    { select: { id: true, name: true, avatarColor: true } },
          completedBy: { select: { id: true, name: true, avatarColor: true } },
        },
      })
    })

    await logActivity(userId, "updated", "chore", chore.title)

    return NextResponse.json({
      ...updated,
      dueBy:         updated.dueBy         ? updated.dueBy.toISOString()         : null,
      lastCompleted: updated.lastCompleted ? updated.lastCompleted.toISOString() : null,
    })
  }

  const isCompletion = !isEditUpdate || ("complete" in body && body.complete)

  // Guard against double-completion (rapid taps, or two devices at once) so
  // stars are never awarded twice for the same cycle. Mirrors the board's
  // isDue logic: a recurring chore whose cycle has elapsed may be completed
  // again even though completedById is still set from last time.
  const FREQ_DAYS: Record<string, number> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 }
  const dueAgain =
    chore.frequency !== "ONE_TIME" &&
    !!chore.lastCompleted &&
    Date.now() >= chore.lastCompleted.getTime() + (FREQ_DAYS[chore.frequency] ?? 7) * 86_400_000
  if (isCompletion && chore.completedById && !dueAgain) {
    return NextResponse.json({ error: "Chore already completed" }, { status: 409 })
  }

  // Chore update + star award succeed or fail together
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.chore.update({
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

    if (isCompletion && chore.pointValue > 0) {
      await tx.pointTransaction.create({
        data: { userId, points: chore.pointValue, reason: `Chore: ${chore.title}` },
      })
    }
    return u
  })

  await logActivity(userId, isCompletion ? "completed" : "updated", "chore", chore.title)

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
