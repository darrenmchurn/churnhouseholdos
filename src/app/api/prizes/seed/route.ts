import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DEFAULTS = [
  {
    title:       "Choose a TV Episode",
    description: "Pick one show or episode for the evening",
    pointCost:   25,
    emoji:       "📺",
  },
  {
    title:       "Extra Screen Time",
    description: "15 extra minutes of screen time today",
    pointCost:   25,
    emoji:       "⏱️",
  },
  {
    title:       "Late Night Pass",
    description: "Stay up 30 extra minutes on a weekend night",
    pointCost:   75,
    emoji:       "🌙",
  },
  {
    title:       "Pick Dinner Night",
    description: "Choose what the family has for dinner one night",
    pointCost:   75,
    emoji:       "🍽️",
  },
  {
    title:       "Movie Night",
    description: "You pick the movie for family movie night",
    pointCost:   200,
    emoji:       "🎬",
  },
  {
    title:       "Eat Out",
    description: "Choose the restaurant for a family dinner out",
    pointCost:   200,
    emoji:       "🍕",
  },
]

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  // Only seed if no prizes exist yet
  const existing = await prisma.prize.count({ where: { active: true } })
  if (existing > 0) {
    return NextResponse.json({ skipped: true, message: "Prizes already exist" })
  }

  const created = await prisma.$transaction(
    DEFAULTS.map((d) =>
      prisma.prize.create({
        data: { ...d, createdById: session.user.id },
      })
    )
  )

  return NextResponse.json(created, { status: 201 })
}
