import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/meal-plan?week=YYYY-MM-DD  (Monday of the target week)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const week = searchParams.get("week") // YYYY-MM-DD (Monday)

  if (!week) return NextResponse.json({ error: "week param required" }, { status: 400 })

  // Build date range for the 7 days of that week
  const start = new Date(week + "T00:00:00Z")
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    days.push(d.toISOString().slice(0, 10))
  }

  const entries = await prisma.mealPlanEntry.findMany({
    where: { date: { in: days } },
    include: {
      meal: {
        include: {
          ingredients: { orderBy: { name: "asc" } },
        },
      },
      user: { select: { name: true, avatarColor: true } },
    },
    orderBy: [{ date: "asc" }, { mealType: "asc" }],
  })

  return NextResponse.json(entries)
}

// POST /api/meal-plan  — upsert a slot (date + mealType is unique)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { date, mealType, mealId, note } = body

  if (!date || !mealType) {
    return NextResponse.json({ error: "date and mealType required" }, { status: 400 })
  }

  const validTypes = ["BREAKFAST", "LUNCH", "DINNER"]
  if (!validTypes.includes(mealType)) {
    return NextResponse.json({ error: "Invalid mealType" }, { status: 400 })
  }

  const entry = await prisma.mealPlanEntry.upsert({
    where: { date_mealType: { date, mealType } },
    update: {
      mealId: mealId ?? null,
      note: note?.trim() || null,
      userId: session.user.id,
    },
    create: {
      date,
      mealType,
      mealId: mealId ?? null,
      note: note?.trim() || null,
      userId: session.user.id,
    },
    include: {
      meal: {
        include: { ingredients: { orderBy: { name: "asc" } } },
      },
      user: { select: { name: true, avatarColor: true } },
    },
  })

  return NextResponse.json(entry, { status: 201 })
}
