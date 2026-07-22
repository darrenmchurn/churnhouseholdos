import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// USDA detail lookup for one food. Returns the food normalized into a set of
// serving options (real household portions like "1 Big Mac", plus 100 g), each
// with per-serving macros — so a per-100g database entry becomes loggable as a
// whole item.
const USDA_KEY = (process.env.USDA_FDC_API_KEY || "DEMO_KEY").trim()

type DetailNutrient = { nutrient?: { number?: string }; amount?: number }
type FoodPortion = { gramWeight?: number; portionDescription?: string; modifier?: string }
type LabelValue = { value?: number }
type FoodDetail = {
  description?: string
  brandName?: string
  brandOwner?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: DetailNutrient[]
  foodPortions?: FoodPortion[]
  labelNutrients?: {
    calories?: LabelValue
    protein?: LabelValue
    carbohydrates?: LabelValue
    fat?: LabelValue
  }
}

type Serving = {
  label: string
  unit: string
  caloriesPer: number
  proteinGPer: number
  carbsGPer: number
  fatGPer: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

// Detail nutrients are nested: { nutrient: { number }, amount } — per 100 g
function per100(list: DetailNutrient[] | undefined, code: string): number {
  return list?.find((n) => n.nutrient?.number === code)?.amount ?? 0
}

// "1 McDonald's Big Mac" → unit "McDonald's Big Mac"; keep other text as-is
function toUnit(desc: string): string {
  return desc.replace(/^1\s+/, "").trim() || "serving"
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const fdcId = new URL(req.url).searchParams.get("fdcId")?.trim()
  if (!fdcId) return NextResponse.json({ error: "fdcId required" }, { status: 400 })

  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(fdcId)}?api_key=${USDA_KEY}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) {
      console.error(`[nutrition/search/detail] USDA ${res.status}`)
      return NextResponse.json({ error: "upstream", status: res.status }, { status: 200 })
    }

    const d = (await res.json()) as FoodDetail
    const base = {
      calories: per100(d.foodNutrients, "208"),
      protein:  per100(d.foodNutrients, "203"),
      carbs:    per100(d.foodNutrients, "205"),
      fat:      per100(d.foodNutrients, "204"),
    }

    const servings: Serving[] = []
    const seen = new Set<string>()
    const push = (s: Serving) => {
      const key = s.label.toLowerCase()
      if (s.caloriesPer > 0 && !seen.has(key)) { seen.add(key); servings.push(s) }
    }

    // Branded label serving (already per serving)
    if (d.labelNutrients?.calories?.value) {
      const l = d.labelNutrients
      const label = d.householdServingFullText?.trim()
        || (d.servingSize ? `${d.servingSize} ${d.servingSizeUnit ?? "g"}` : "1 serving")
      push({
        label,
        unit:        toUnit(label),
        caloriesPer: Math.round(l.calories?.value ?? 0),
        proteinGPer: r1(l.protein?.value ?? 0),
        carbsGPer:   r1(l.carbohydrates?.value ?? 0),
        fatGPer:     r1(l.fat?.value ?? 0),
      })
    }

    // Household portions → per-serving via per-100g × grams/100.
    // Prefer named portions and dedupe by gram weight, so a generic
    // "Quantity not specified" doesn't duplicate a real named portion.
    const isNamed = (p: FoodPortion) =>
      !!p.portionDescription && p.portionDescription !== "Quantity not specified"
    const portions = (d.foodPortions ?? [])
      .filter((p) => (p.gramWeight ?? 0) > 0)
      .sort((a, b) => Number(isNamed(b)) - Number(isNamed(a)))
    const seenGrams = new Set<number>()
    for (const p of portions) {
      const g = Math.round(p.gramWeight!)
      if (seenGrams.has(g)) continue
      seenGrams.add(g)
      const named = isNamed(p)
      const desc = named
        ? p.portionDescription!
        : (p.modifier && !/^\d+$/.test(p.modifier) ? p.modifier : `1 serving (${g} g)`)
      push({
        label:       named ? `${desc} (${g} g)` : desc,
        unit:        toUnit(desc),
        caloriesPer: Math.round(base.calories * g / 100),
        proteinGPer: r1(base.protein * g / 100),
        carbsGPer:   r1(base.carbs   * g / 100),
        fatGPer:     r1(base.fat     * g / 100),
      })
    }

    // Always offer raw 100 g
    push({
      label: "100 g",
      unit: "100 g",
      caloriesPer: Math.round(base.calories),
      proteinGPer: r1(base.protein),
      carbsGPer:   r1(base.carbs),
      fatGPer:     r1(base.fat),
    })

    return NextResponse.json({
      name:  (d.description ?? "").trim(),
      brand: (d.brandName || d.brandOwner || "").trim() || null,
      servings: servings.slice(0, 6),
    })
  } catch {
    return NextResponse.json({ error: "network" }, { status: 200 })
  }
}
