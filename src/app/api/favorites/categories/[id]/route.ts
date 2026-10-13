import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FAVORITE_GROUPS } from "@/lib/favorites"

async function requireManager() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const denied = await requireManager()
  if (denied) return denied

  const { id } = await props.params
  const body = await req.json()
  const existing = await prisma.favoriteCategory.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if ("label" in body && !String(body.label).trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const updated = await prisma.favoriteCategory.update({
    where: { id },
    data: {
      ...("label"     in body && { label: String(body.label).trim().slice(0, 60) }),
      ...("emoji"     in body && { emoji: String(body.emoji).trim() || "⭐" }),
      ...("group"     in body && FAVORITE_GROUPS.some((g) => g.value === body.group) && { group: body.group }),
      ...("active"    in body && { active: Boolean(body.active) }),
      ...("sortOrder" in body && { sortOrder: Number(body.sortOrder) }),
    },
  })
  return NextResponse.json(updated)
}

// Deleting a category also deletes everyone's answers for it (cascade).
// The admin UI steers toward hiding instead.
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const denied = await requireManager()
  if (denied) return denied

  const { id } = await props.params
  const existing = await prisma.favoriteCategory.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.favoriteCategory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
