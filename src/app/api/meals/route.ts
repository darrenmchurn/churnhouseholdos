import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const meals = await prisma.meal.findMany({
    orderBy: { title: "asc" },
    include: {
      ingredients: { orderBy: { name: "asc" } },
      createdBy: { select: { name: true, avatarColor: true } },
    },
  })

  return NextResponse.json(meals)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { title, description, servings, prepMins, cookMins, ingredients } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const meal = await prisma.meal.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      servings: Number(servings) || 4,
      prepMins: Number(prepMins) || 0,
      cookMins: Number(cookMins) || 0,
      createdById: session.user.id,
      ingredients: {
        create: (ingredients ?? [])
          .filter((ing: { name?: string }) => ing.name?.trim())
          .map((ing: { name: string; quantity?: string; category?: string }) => ({
            name: ing.name.trim(),
            quantity: ing.quantity?.trim() || null,
            category: ing.category?.trim() || null,
          })),
      },
    },
    include: {
      ingredients: { orderBy: { name: "asc" } },
      createdBy: { select: { name: true, avatarColor: true } },
    },
  })

  return NextResponse.json(meal, { status: 201 })
}
