import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// PATCH — with an empty body, bumps lastUsedAt (called when a food is re-logged).
// With a body, edits the saved food: name / macros / unit / favorite flag.
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await props.params
  const item = await prisma.foodItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (item.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Body is optional — the re-log bump sends none
  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (typeof body.unit === "string" && body.unit.trim()) data.unit = body.unit.trim()
  if (typeof body.isFavorite === "boolean") data.isFavorite = body.isFavorite
  for (const k of ["caloriesPer", "proteinGPer", "carbsGPer", "fatGPer"] as const) {
    if (body[k] != null) data[k] = Number(body[k]) || 0
  }

  // No editable fields provided → treat as a "used it again" bump
  if (Object.keys(data).length === 0) data.lastUsedAt = new Date()

  const updated = await prisma.foodItem.update({ where: { id }, data })
  return NextResponse.json(updated)
}

// DELETE — remove a saved food from the library
export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await props.params
  const item = await prisma.foodItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (item.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.foodItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
