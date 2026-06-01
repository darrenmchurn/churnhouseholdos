import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DEFAULT_TILES = [
  { title: "Scratch",                url: "https://scratch.mit.edu/explore/projects/games/", emoji: "🎨", category: "GAMES",    sortOrder: 0 },
  { title: "Poki Kids",              url: "https://kids.poki.com/",                          emoji: "🎮", category: "GAMES",    sortOrder: 1 },
  { title: "Cool Math Games",        url: "https://www.coolmathgames.com/",                  emoji: "🧮", category: "GAMES",    sortOrder: 2 },
  { title: "Primary Games",          url: "https://www.primarygames.com/",                   emoji: "🎯", category: "GAMES",    sortOrder: 3 },
  { title: "PBS Kids",               url: "https://pbskids.org/",                            emoji: "📺", category: "LEARNING", sortOrder: 4 },
  { title: "Nat Geo Kids",           url: "https://kids.nationalgeographic.com/",            emoji: "🌍", category: "LEARNING", sortOrder: 5 },
  { title: "Khan Academy Kids",      url: "https://www.khanacademy.org/kids",                emoji: "🧪", category: "LEARNING", sortOrder: 6 },
]

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const existing = await prisma.kidsZoneTile.count()
  if (existing > 0) {
    return NextResponse.json({ message: "Tiles already exist", seeded: 0 })
  }

  await prisma.kidsZoneTile.createMany({ data: DEFAULT_TILES })

  const tiles = await prisma.kidsZoneTile.findMany({ orderBy: { sortOrder: "asc" } })
  return NextResponse.json({ seeded: tiles.length, tiles })
}
