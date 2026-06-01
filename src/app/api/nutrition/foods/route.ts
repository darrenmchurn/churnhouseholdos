import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/nutrition/foods — user's saved food library, most recently used first
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const foods = await prisma.foodItem.findMany({
    where: { userId: session.user.id },
    orderBy: { lastUsedAt: "desc" },
  })

  return NextResponse.json(foods)
}

// POST /api/nutrition/foods — save or upsert a food item
// - If barcode provided: upsert on userId+barcode (updates nutrition + lastUsedAt)
// - If no barcode: create a new entry
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, barcode, caloriesPer, proteinGPer, carbsGPer, fatGPer, unit } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const data = {
    name:        name.trim(),
    barcode:     barcode?.trim() || null,
    caloriesPer: Number(caloriesPer) || 0,
    proteinGPer: Number(proteinGPer) || 0,
    carbsGPer:   Number(carbsGPer)   || 0,
    fatGPer:     Number(fatGPer)     || 0,
    unit:        unit?.trim() || "serving",
    lastUsedAt:  new Date(),
  }

  let item

  if (data.barcode) {
    // Upsert by barcode for this user
    const existing = await prisma.foodItem.findFirst({
      where: { userId: session.user.id, barcode: data.barcode },
    })
    if (existing) {
      item = await prisma.foodItem.update({
        where: { id: existing.id },
        data,
      })
    } else {
      item = await prisma.foodItem.create({
        data: { ...data, userId: session.user.id },
      })
    }
  } else {
    // Manual entry — always create new
    item = await prisma.foodItem.create({
      data: { ...data, userId: session.user.id },
    })
  }

  return NextResponse.json(item, { status: 201 })
}
