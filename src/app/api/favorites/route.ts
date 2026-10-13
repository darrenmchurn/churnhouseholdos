import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditFavoritesOf } from "@/lib/favorites"

const MAX_VALUE = 200
const MAX_NOTE  = 300

// Create or update an answer. Preset answers upsert on (userId, categoryId);
// custom answers (no categoryId) always create a new row.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const userId = String(body.userId ?? session.user.id)
  const value  = String(body.value ?? "").trim().slice(0, MAX_VALUE)
  const note   = String(body.note ?? "").trim().slice(0, MAX_NOTE) || null
  if (!value) return NextResponse.json({ error: "Answer is required" }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canEditFavoritesOf(session.user, target)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (body.categoryId) {
    const category = await prisma.favoriteCategory.findUnique({ where: { id: String(body.categoryId) } })
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 })
    const fav = await prisma.favorite.upsert({
      where: { userId_categoryId: { userId, categoryId: category.id } },
      create: { userId, categoryId: category.id, value, note, updatedById: session.user.id },
      update: { value, note, updatedById: session.user.id },
    })
    return NextResponse.json(fav)
  }

  const customLabel = String(body.customLabel ?? "").trim().slice(0, 60)
  if (!customLabel) return NextResponse.json({ error: "Category name is required" }, { status: 400 })
  const fav = await prisma.favorite.create({
    data: {
      userId, value, note, customLabel,
      customEmoji: String(body.customEmoji ?? "").trim() || "⭐",
      updatedById: session.user.id,
    },
  })
  return NextResponse.json(fav, { status: 201 })
}
