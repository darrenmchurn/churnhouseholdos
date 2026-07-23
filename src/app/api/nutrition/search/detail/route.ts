import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Detail lookup for one search result → a set of per-serving portion options.
// Routes to USDA or Nutritionix based on ?source=.
const USDA_KEY = (process.env.USDA_FDC_API_KEY || "DEMO_KEY").trim()
const NIX_ID   = process.env.NUTRITIONIX_APP_ID?.trim()
const NIX_KEY  = process.env.NUTRITIONIX_APP_KEY?.trim()

type Serving = {
  label: string
  unit: string
  caloriesPer: number
  proteinGPer: number
  carbsGPer: number
  fatGPer: number
}
type Detail = { name: string; brand: string | null; servings: Serving[] }

const r1 = (n: number) => Math.round(n * 10) / 10
const toUnit = (desc: string) => desc.replace(/^1\s+/, "").trim() || "serving"

function pusher(servings: Serving[], seen: Set<string>) {
  return (s: Serving) => {
    const k = s.label.toLowerCase()
    if (s.caloriesPer > 0 && !seen.has(k)) { seen.add(k); servings.push(s) }
  }
}

// ── USDA ────────────────────────────────────────────────────────────────────
type DetailNutrient = { nutrient?: { number?: string }; amount?: number }
type FoodPortion = { gramWeight?: number; portionDescription?: string; modifier?: string }
type LabelValue = { value?: number }
type UsdaDetail = {
  description?: string
  brandName?: string
  brandOwner?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: DetailNutrient[]
  foodPortions?: FoodPortion[]
  labelNutrients?: { calories?: LabelValue; protein?: LabelValue; carbohydrates?: LabelValue; fat?: LabelValue }
}
const per100 = (l: DetailNutrient[] | undefined, code: string) =>
  l?.find((n) => n.nutrient?.number === code)?.amount ?? 0

async function usdaDetail(fdcId: string): Promise<Detail | null> {
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(fdcId)}?api_key=${USDA_KEY}`,
    { signal: AbortSignal.timeout(10000) },
  )
  if (!res.ok) { console.error(`[search/detail] USDA ${res.status}`); return null }
  const d = (await res.json()) as UsdaDetail

  const base = {
    calories: per100(d.foodNutrients, "208"),
    protein:  per100(d.foodNutrients, "203"),
    carbs:    per100(d.foodNutrients, "205"),
    fat:      per100(d.foodNutrients, "204"),
  }
  const servings: Serving[] = []
  const push = pusher(servings, new Set<string>())

  if (d.labelNutrients?.calories?.value) {
    const l = d.labelNutrients
    const label = d.householdServingFullText?.trim()
      || (d.servingSize ? `${d.servingSize} ${d.servingSizeUnit ?? "g"}` : "1 serving")
    push({
      label, unit: toUnit(label),
      caloriesPer: Math.round(l.calories?.value ?? 0),
      proteinGPer: r1(l.protein?.value ?? 0),
      carbsGPer:   r1(l.carbohydrates?.value ?? 0),
      fatGPer:     r1(l.fat?.value ?? 0),
    })
  }

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
      label: named ? `${desc} (${g} g)` : desc,
      unit: toUnit(desc),
      caloriesPer: Math.round(base.calories * g / 100),
      proteinGPer: r1(base.protein * g / 100),
      carbsGPer:   r1(base.carbs   * g / 100),
      fatGPer:     r1(base.fat     * g / 100),
    })
  }

  push({
    label: "100 g", unit: "100 g",
    caloriesPer: Math.round(base.calories),
    proteinGPer: r1(base.protein),
    carbsGPer:   r1(base.carbs),
    fatGPer:     r1(base.fat),
  })

  return {
    name: (d.description ?? "").trim(),
    brand: (d.brandName || d.brandOwner || "").trim() || null,
    servings: servings.slice(0, 6),
  }
}

// ── Nutritionix ───────────────────────────────────────────────────────────────
type AltMeasure = { serving_weight?: number; measure?: string; qty?: number }
type NixFood = {
  food_name?: string
  brand_name?: string
  serving_qty?: number
  serving_unit?: string
  serving_weight_grams?: number
  nf_calories?: number
  nf_protein?: number
  nf_total_carbohydrate?: number
  nf_total_fat?: number
  alt_measures?: AltMeasure[]
}

async function nixDetail(nixItemId: string): Promise<Detail | null> {
  if (!NIX_ID || !NIX_KEY) return null
  const res = await fetch(
    `https://trackapi.nutritionix.com/v2/search/item?nix_item_id=${encodeURIComponent(nixItemId)}`,
    { headers: { "x-app-id": NIX_ID, "x-app-key": NIX_KEY, "x-remote-user-id": "0" }, signal: AbortSignal.timeout(10000) },
  )
  if (!res.ok) { console.error(`[search/detail] Nutritionix ${res.status}`); return null }
  const data = (await res.json()) as { foods?: NixFood[] }
  const f = data.foods?.[0]
  if (!f) return null

  const cal = f.nf_calories ?? 0
  const pro = f.nf_protein ?? 0
  const carb = f.nf_total_carbohydrate ?? 0
  const fat = f.nf_total_fat ?? 0
  const grams = f.serving_weight_grams ?? 0

  const servings: Serving[] = []
  const push = pusher(servings, new Set<string>())

  // Primary serving (macros are already for this serving)
  const primary = `${f.serving_qty ?? 1} ${f.serving_unit ?? "serving"}`.trim()
  push({
    label: primary, unit: toUnit(primary),
    caloriesPer: Math.round(cal), proteinGPer: r1(pro), carbsGPer: r1(carb), fatGPer: r1(fat),
  })

  // Alternative measures + 100 g, scaled by gram weight
  if (grams > 0) {
    for (const m of f.alt_measures ?? []) {
      const g = m.serving_weight ?? 0
      if (g <= 0) continue
      const factor = g / grams
      const label = `${m.qty ?? 1} ${m.measure ?? ""}`.trim()
      push({
        label, unit: toUnit(label),
        caloriesPer: Math.round(cal * factor),
        proteinGPer: r1(pro * factor),
        carbsGPer:   r1(carb * factor),
        fatGPer:     r1(fat * factor),
      })
    }
    const f100 = 100 / grams
    push({
      label: "100 g", unit: "100 g",
      caloriesPer: Math.round(cal * f100),
      proteinGPer: r1(pro * f100),
      carbsGPer:   r1(carb * f100),
      fatGPer:     r1(fat * f100),
    })
  }

  return {
    name: (f.food_name ?? "").trim(),
    brand: (f.brand_name ?? "").trim() || null,
    servings: servings.slice(0, 6),
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const source = sp.get("source")
  const id = sp.get("id") || sp.get("fdcId") // fdcId kept for back-compat
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  try {
    const out = source === "nix" ? await nixDetail(id) : await usdaDetail(id)
    if (!out) return NextResponse.json({ error: "upstream" }, { status: 200 })
    return NextResponse.json(out)
  } catch (e) {
    console.error("[search/detail] failed:", e instanceof Error ? e.name : e)
    return NextResponse.json({ error: "network" }, { status: 200 })
  }
}
