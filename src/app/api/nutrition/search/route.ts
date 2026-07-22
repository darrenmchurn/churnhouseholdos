import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// USDA FoodData Central text search. Free API key — set USDA_FDC_API_KEY in the
// environment (Vercel + .env.local); falls back to the shared, rate-limited
// DEMO_KEY so search works out of the box before a real key is added.
// .trim() defends against a stray space/newline pasted into the env value
const USDA_KEY = (process.env.USDA_FDC_API_KEY || "DEMO_KEY").trim()
const USING_DEMO = USDA_KEY === "DEMO_KEY"

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

  const raw = new URL(req.url).searchParams.get("q")?.trim()
  if (!raw || raw.length < 2) return NextResponse.json({ results: [] })

  // USDA's search treats + - && || ! ( ) { } [ ] ^ " ~ * ? : \ / as query
  // operators, so a term like "Chick-Fil-A" produces a malformed query → 400.
  // Reduce to letters / numbers / spaces / apostrophes before querying.
  const q = raw.replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}` +
      `&query=${encodeURIComponent(q)}&pageSize=20` +
      `&dataType=${encodeURIComponent("Branded,Survey (FNDDS),SR Legacy,Foundation")}`

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      // Log the real status to Vercel function logs; surface it (and whether the
      // demo key is in use) to the client so config problems are diagnosable.
      console.error(`[nutrition/search] USDA ${res.status}${USING_DEMO ? " (DEMO_KEY)" : ""}`)
      return NextResponse.json(
        {
          results: [],
          error: res.status === 429 ? "rate-limited" : "upstream",
          status: res.status,
          demoKey: USING_DEMO,
        },
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
  } catch (e) {
    // Timeout (AbortError) or DNS/connection failure
    console.error(`[nutrition/search] fetch failed:`, e instanceof Error ? e.name : e)
    return NextResponse.json(
      { results: [], error: "network", demoKey: USING_DEMO },
      { status: 200 },
    )
  }
}
