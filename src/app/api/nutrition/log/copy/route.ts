import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const VALID_MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]

// POST /api/nutrition/log/copy
// Copies a previous day's entries into a target day in one shot — the backbone
// of the "repeat a meal / repeat yesterday" feature.
//
// Body:
//   sourceDate      "YYYY-MM-DD"           (required)
//   targetDate      "YYYY-MM-DD"           (required)
//   mealType?       BREAKFAST|LUNCH|...    copy only this meal; omit for whole day
//   targetMealType? BREAKFAST|LUNCH|...    place copies here; defaults to each
//                                          entry's own mealType (or `mealType`)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { sourceDate, targetDate, mealType, targetMealType } = body

  if (!sourceDate || !targetDate) {
    return NextResponse.json({ error: "sourceDate and targetDate are required" }, { status: 400 })
  }
  if (mealType && !VALID_MEAL_TYPES.includes(mealType)) {
    return NextResponse.json({ error: "Invalid mealType" }, { status: 400 })
  }
  if (targetMealType && !VALID_MEAL_TYPES.includes(targetMealType)) {
    return NextResponse.json({ error: "Invalid targetMealType" }, { status: 400 })
  }

  const source = await prisma.foodLog.findMany({
    where: {
      userId: session.user.id,
      date:   sourceDate,
      ...(mealType ? { mealType } : {}),
    },
    orderBy: { createdAt: "asc" },
  })

  if (source.length === 0) {
    return NextResponse.json({ error: "Nothing to copy" }, { status: 404 })
  }

  const created = await prisma.foodLog.createManyAndReturn({
    data: source.map((e) => ({
      userId:   session.user.id,
      date:     targetDate,
      mealType: targetMealType ?? e.mealType,
      name:     e.name,
      calories: e.calories,
      proteinG: e.proteinG,
      carbsG:   e.carbsG,
      fatG:     e.fatG,
      quantity: e.quantity,
      unit:     e.unit,
      barcode:  e.barcode,
    })),
  })

  return NextResponse.json(created, { status: 201 })
}
