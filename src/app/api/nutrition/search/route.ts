import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// USDA FoodData Central text search. Free API key — set USDA_FDC_API_KEY in the
// environment (Vercel + .env.local); falls back to the shared, rate-limited
// DEMO_KEY so search works out of the box before a real key is added.
const USDA_KEY = process.env.USDA_FDC_API_KEY || "DEMO_KEY"

type SearchNutrient = { nutrientNumber?: string; value?: number }
type SearchFood = {
  fdcId: number
  description?: string
  brandName?: string
  brandOwner?: string
  dataType?: string
  foodNutrients?: SearchNutrient[]
}

// Nutrient numbers: 208 energy kcal, 203 protein, 205 carbs, 204 fat
function nutrient(list: SearchNutrient[] | undefined, code: string): number {
  return list?.find((n) => n.nutrientNumber === code)?.value ?? 0
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = new URL(req.url).searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}` +
      `&query=${encodeURIComponent(q)}&pageSize=20` +
      `&dataType=${encodeURIComponent("Branded,Survey (FNDDS),SR Legacy,Foundation")}`

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) {
      return NextResponse.json(
        { results: [], error: res.status === 429 ? "rate-limited" : "upstream" },
        { status: 200 },
      )
    }

    const data = (await res.json()) as { foods?: SearchFood[] }
    const results = (data.foods ?? [])
      .map((f) => ({
        fdcId: f.fdcId,
        name:  (f.description ?? "").trim(),
        brand: (f.brandName || f.brandOwner || "").trim() || null,
        per100: {
          calories: Math.round(nutrient(f.foodNutrients, "208")),
          protein:  Math.round(nutrient(f.foodNutrients, "203") * 10) / 10,
          carbs:    Math.round(nutrient(f.foodNutrients, "205") * 10) / 10,
          fat:      Math.round(nutrient(f.foodNutrients, "204") * 10) / 10,
        },
      }))
      .filter((r) => r.name && r.per100.calories > 0)

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [], error: "network" }, { status: 200 })
  }
}
