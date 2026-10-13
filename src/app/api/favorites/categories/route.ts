import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FAVORITE_GROUPS } from "@/lib/favorites"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const label = String(body.label ?? "").trim().slice(0, 60)
  if (!label) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  const group = FAVORITE_GROUPS.some((g) => g.value === body.group) ? body.group : "BASICS"

  const last = await prisma.favoriteCategory.findFirst({ orderBy: { sortOrder: "desc" } })
  const category = await prisma.favoriteCategory.create({
    data: {
      label,
      emoji: String(body.emoji ?? "").trim() || "⭐",
      group,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })
  return NextResponse.json(category, { status: 201 })
}
