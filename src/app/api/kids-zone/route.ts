import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tiles = await prisma.kidsZoneTile.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(tiles)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { title, url, emoji, category, sortOrder } = body

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 })
  if (!url?.trim())   return NextResponse.json({ error: "URL is required" }, { status: 400 })

  // Basic URL validation
  try { new URL(url) } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  const tile = await prisma.kidsZoneTile.create({
    data: {
      title: title.trim(),
      url: url.trim(),
      emoji: emoji?.trim() || "🎮",
      category: category || "GAMES",
      sortOrder: Number(sortOrder) || 0,
    },
  })

  return NextResponse.json(tile, { status: 201 })
}
