import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditFavoritesOf } from "@/lib/favorites"

async function loadEditable(id: string) {
  const session = await auth()
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const fav = await prisma.favorite.findUnique({
    where: { id },
    include: { user: { select: { id: true, role: true } } },
  })
  if (!fav) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  if (!canEditFavoritesOf(session.user, fav.user)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session, fav }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const r = await loadEditable(id)
  if (r.error) return r.error
  const body = await req.json()

  const data: Record<string, string | null> = { updatedById: r.session.user.id }
  if ("value" in body) {
    const value = String(body.value).trim().slice(0, 200)
    if (!value) return NextResponse.json({ error: "Answer is required" }, { status: 400 })
    data.value = value
  }
  if ("note" in body) data.note = String(body.note ?? "").trim().slice(0, 300) || null
  // Only custom answers can be renamed
  if (!r.fav.categoryId) {
    if ("customLabel" in body) {
      const label = String(body.customLabel).trim().slice(0, 60)
      if (!label) return NextResponse.json({ error: "Category name is required" }, { status: 400 })
      data.customLabel = label
    }
    if ("customEmoji" in body) data.customEmoji = String(body.customEmoji).trim() || "⭐"
  }

  const updated = await prisma.favorite.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const r = await loadEditable(id)
  if (r.error) return r.error
  await prisma.favorite.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
