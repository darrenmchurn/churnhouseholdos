import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  if (!date) return NextResponse.json({ error: "date param required" }, { status: 400 })

  const entries = await prisma.foodLog.findMany({
    where: { userId: session.user.id, date },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { date, mealType, name, calories, proteinG, carbsG, fatG, quantity, unit, barcode } = body

  if (!date || !name?.trim()) {
    return NextResponse.json({ error: "date and name are required" }, { status: 400 })
  }

  const validTypes = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]
  if (!validTypes.includes(mealType)) {
    return NextResponse.json({ error: "Invalid mealType" }, { status: 400 })
  }

  const entry = await prisma.foodLog.create({
    data: {
      userId:   session.user.id,
      date,
      mealType: mealType ?? "SNACK",
      name:     name.trim(),
      calories: Number(calories) || 0,
      proteinG: Number(proteinG) || 0,
      carbsG:   Number(carbsG)   || 0,
      fatG:     Number(fatG)     || 0,
      quantity: Number(quantity) || 1,
      unit:     unit ?? "serving",
      barcode:  barcode ?? null,
    },
  })

  return NextResponse.json(entry, { status: 201 })
}
