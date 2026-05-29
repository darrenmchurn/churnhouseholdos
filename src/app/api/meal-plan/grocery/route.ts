import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/meal-plan/grocery
// Body: { week: "YYYY-MM-DD" }  → adds all meal ingredients for that week to the grocery list
// Deduplicates against existing non-completed grocery items (case-insensitive name match)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { week } = body

  if (!week) return NextResponse.json({ error: "week required" }, { status: 400 })

  // Build the 7 dates
  const start = new Date(week + "T00:00:00Z")
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    days.push(d.toISOString().slice(0, 10))
  }

  // Fetch all entries with meal ingredients for the week
  const entries = await prisma.mealPlanEntry.findMany({
    where: { date: { in: days }, mealId: { not: null } },
    include: {
      meal: { include: { ingredients: true } },
    },
  })

  // Collect all ingredients
  type IngCandidate = { name: string; quantity: string | null; category: string | null }
  const candidates: IngCandidate[] = []
  for (const entry of entries) {
    if (!entry.meal) continue
    for (const ing of entry.meal.ingredients) {
      candidates.push({
        name: ing.name,
        quantity: ing.quantity,
        category: ing.category,
      })
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ added: 0, skipped: 0 })
  }

  // Fetch existing non-completed grocery items for dedup
  const existing = await prisma.groceryItem.findMany({
    where: { completed: false },
    select: { name: true },
  })
  const existingNames = new Set(existing.map((i) => i.name.toLowerCase().trim()))

  // Deduplicate candidates by name (keep first occurrence per name)
  const seen = new Set<string>()
  const toAdd: IngCandidate[] = []
  let skipped = 0

  for (const c of candidates) {
    const key = c.name.toLowerCase().trim()
    if (existingNames.has(key) || seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    toAdd.push(c)
  }

  if (toAdd.length > 0) {
    await prisma.groceryItem.createMany({
      data: toAdd.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        category: ing.category,
        addedById: session.user.id,
      })),
    })
  }

  return NextResponse.json({ added: toAdd.length, skipped })
}
