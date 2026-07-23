import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchCurated } from "@/lib/fastFoodDb"

// Two food databases, merged into one result list:
//  - Nutritionix: restaurant / fast-food / brand coverage (Chick-fil-A, Cane's…)
//  - USDA FoodData Central: generic whole foods + packaged grocery
// Each provider is optional and independent — if its keys are missing or it
// errors, the other still returns results.
const USDA_KEY = (process.env.USDA_FDC_API_KEY || "DEMO_KEY").trim()
const NIX_ID   = process.env.NUTRITIONIX_APP_ID?.trim()
const NIX_KEY  = process.env.NUTRITIONIX_APP_KEY?.trim()

export type SearchResult = {
  source: "local" | "usda" | "nix"
  id: string
  name: string
  brand: string | null
  calories: number
  note: string // display hint for the calorie basis, e.g. "per 100 g" or "8 nuggets"
}

// Curated local database (fast food / chains) — synchronous, no key, no network
function searchLocalDb(q: string): SearchResult[] {
  return searchCurated(q).map((f) => ({
    source: "local" as const,
    id: f.id,
    name: f.name,
    brand: f.brand,
    calories: f.servings[0].caloriesPer,
    note: f.servings[0].label,
  }))
}

type Provider = { results: SearchResult[]; error?: string; status?: number }

// ── USDA ────────────────────────────────────────────────────────────────────
type UsdaNutrient = { nutrientNumber?: string; value?: number }
type UsdaFood = {
  fdcId: number
  description?: string
  brandName?: string
  brandOwner?: string
  foodNutrients?: UsdaNutrient[]
}
const usdaNutr = (l: UsdaNutrient[] | undefined, code: string) =>
  l?.find((n) => n.nutrientNumber === code)?.value ?? 0

async function searchUsda(q: string): Promise<Provider> {
  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}` +
      `&query=${encodeURIComponent(q)}&pageSize=15` +
      `&dataType=${encodeURIComponent("Branded,Survey (FNDDS),SR Legacy,Foundation")}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      console.error(`[search] USDA ${res.status}`)
      return { results: [], error: res.status === 429 ? "rate-limited" : "upstream", status: res.status }
    }
    const data = (await res.json()) as { foods?: UsdaFood[] }
    const results: SearchResult[] = (data.foods ?? [])
      .map((f) => ({
        source: "usda" as const,
        id: String(f.fdcId),
        name: (f.description ?? "").trim(),
        brand: (f.brandName || f.brandOwner || "").trim() || null,
        calories: Math.round(usdaNutr(f.foodNutrients, "208")),
        note: "per 100 g",
      }))
      .filter((r) => r.name && r.calories > 0)
    return { results }
  } catch (e) {
    console.error("[search] USDA fetch failed:", e instanceof Error ? e.name : e)
    return { results: [], error: "network" }
  }
}

// ── Nutritionix ───────────────────────────────────────────────────────────────
type NixBranded = {
  food_name?: string
  brand_name?: string
  nix_item_id?: string
  nf_calories?: number
  serving_qty?: number
  serving_unit?: string
}

async function searchNix(q: string): Promise<Provider> {
  if (!NIX_ID || !NIX_KEY) return { results: [] } // not configured → skip silently
  try {
    const url = `https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(q)}&common=false&branded=true`
    const res = await fetch(url, {
      headers: { "x-app-id": NIX_ID, "x-app-key": NIX_KEY, "x-remote-user-id": "0" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.error(`[search] Nutritionix ${res.status}`)
      return { results: [], error: res.status === 429 ? "rate-limited" : "upstream", status: res.status }
    }
    const data = (await res.json()) as { branded?: NixBranded[] }
    const results: SearchResult[] = (data.branded ?? [])
      .map((b) => ({
        source: "nix" as const,
        id: b.nix_item_id ?? "",
        name: (b.food_name ?? "").trim(),
        brand: (b.brand_name ?? "").trim() || null,
        calories: Math.round(b.nf_calories ?? 0),
        note: b.serving_qty != null && b.serving_unit ? `${b.serving_qty} ${b.serving_unit}` : "1 serving",
      }))
      .filter((r) => r.id && r.name && r.calories > 0)
    return { results }
  } catch (e) {
    console.error("[search] Nutritionix fetch failed:", e instanceof Error ? e.name : e)
    return { results: [], error: "network" }
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const raw = new URL(req.url).searchParams.get("q")?.trim()
  if (!raw || raw.length < 2) return NextResponse.json({ results: [] })

  // USDA's parser treats + - ( ) : " * etc. as operators (so "Chick-Fil-A" 400s);
  // strip them for USDA. Nutritionix handles natural language, so it gets the raw text.
  const usdaQ = raw.replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim() || raw

  // Curated local matches first (exact chains the family eats), then Nutritionix
  // (restaurant/brand), then USDA (generic/grocery)
  const local = searchLocalDb(raw)
  const [nix, usda] = await Promise.all([searchNix(raw), searchUsda(usdaQ)])
  const results = [...local, ...nix.results, ...usda.results].slice(0, 30)

  if (results.length === 0) {
    const err = nix.error || usda.error
    if (err) {
      return NextResponse.json({
        results: [],
        error: err === "rate-limited" ? "rate-limited" : "upstream",
        status: nix.status ?? usda.status,
        demoKey: !NIX_ID && USDA_KEY === "DEMO_KEY",
      })
    }
  }
  return NextResponse.json({ results })
}
