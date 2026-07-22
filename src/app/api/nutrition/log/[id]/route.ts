import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const VALID_MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]

// PATCH — edit a logged entry (change meal, rename, or adjust quantity).
// When only `quantity` changes, macros scale proportionally from the stored
// totals so the caller doesn't need per-unit values. Explicit macro fields win.
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await props.params
  const entry = await prisma.foodLog.findUnique({ where: { id } })
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const canEdit =
    entry.userId === session.user.id ||
    session.user.role === "ADMIN" ||
    session.user.role === "PARENT"
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const data: Record<string, unknown> = {}

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (body.mealType && VALID_MEAL_TYPES.includes(body.mealType)) data.mealType = body.mealType

  if (body.quantity != null) {
    const newQty = Number(body.quantity) || entry.quantity
    const ratio  = newQty / (entry.quantity || 1)
    data.quantity = newQty
    if (body.calories == null) data.calories = entry.calories * ratio
    if (body.proteinG == null) data.proteinG = entry.proteinG * ratio
    if (body.carbsG   == null) data.carbsG   = entry.carbsG   * ratio
    if (body.fatG     == null) data.fatG     = entry.fatG     * ratio
  }

  // Explicit macro overrides take precedence over proportional scaling
  for (const k of ["calories", "proteinG", "carbsG", "fatG"] as const) {
    if (body[k] != null) data[k] = Number(body[k]) || 0
  }

  const updated = await prisma.foodLog.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await props.params
  const entry = await prisma.foodLog.findUnique({ where: { id } })
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Users can only delete their own entries; admins can delete anyone's
  const canDelete =
    entry.userId === session.user.id ||
    session.user.role === "ADMIN" ||
    session.user.role === "PARENT"

  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.foodLog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
