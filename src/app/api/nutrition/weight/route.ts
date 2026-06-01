import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/nutrition/weight?limit=30  — recent entries, newest first
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get("limit") ?? "30"), 90)

  const entries = await prisma.weightLog.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    take: limit,
  })

  return NextResponse.json(entries.reverse()) // chronological for chart
}

// POST /api/nutrition/weight  — upsert today's (or any date's) weight
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { date, weightLbs, note } = body

  if (!date || !weightLbs) {
    return NextResponse.json({ error: "date and weightLbs are required" }, { status: 400 })
  }

  const entry = await prisma.weightLog.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    update: { weightLbs: Number(weightLbs), note: note?.trim() || null },
    create: {
      userId: session.user.id,
      date,
      weightLbs: Number(weightLbs),
      note: note?.trim() || null,
    },
  })

  return NextResponse.json(entry, { status: 201 })
}
