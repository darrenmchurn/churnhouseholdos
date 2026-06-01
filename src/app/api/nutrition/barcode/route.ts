import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

type OFFNutriments = {
  "energy-kcal_serving"?: number
  "energy-kcal_100g"?: number
  proteins_serving?: number
  proteins_100g?: number
  carbohydrates_serving?: number
  carbohydrates_100g?: number
  fat_serving?: number
  fat_100g?: number
}

type OFFProduct = {
  product_name?: string
  product_name_en?: string
  nutriments?: OFFNutriments
  serving_size?: string
  serving_quantity?: number
}

type OFFResponse = {
  status: number // 1 = found, 0 = not found
  product?: OFFProduct
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const upc = searchParams.get("upc")?.trim()
  if (!upc) return NextResponse.json({ error: "upc param required" }, { status: 400 })

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(upc)}.json?fields=product_name,product_name_en,nutriments,serving_size,serving_quantity`
    const res = await fetch(url, {
      headers: { "User-Agent": "FamilyHubApp/1.0 (household organizer)" },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json({ found: false })
    }

    const data: OFFResponse = await res.json()

    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ found: false })
    }

    const p = data.product
    const n = p.nutriments ?? {}
    const name = p.product_name_en || p.product_name || ""

    // Prefer per-serving values; fall back to per-100g
    const hasServing =
      n["energy-kcal_serving"] !== undefined ||
      n.proteins_serving !== undefined

    let caloriesPer: number
    let proteinGPer: number
    let carbsGPer: number
    let fatGPer: number
    let unit: string

    if (hasServing) {
      caloriesPer = Math.round(n["energy-kcal_serving"] ?? 0)
      proteinGPer = Math.round((n.proteins_serving ?? 0) * 10) / 10
      carbsGPer   = Math.round((n.carbohydrates_serving ?? 0) * 10) / 10
      fatGPer     = Math.round((n.fat_serving ?? 0) * 10) / 10
      unit        = p.serving_size ?? "serving"
    } else {
      caloriesPer = Math.round(n["energy-kcal_100g"] ?? 0)
      proteinGPer = Math.round((n.proteins_100g ?? 0) * 10) / 10
      carbsGPer   = Math.round((n.carbohydrates_100g ?? 0) * 10) / 10
      fatGPer     = Math.round((n.fat_100g ?? 0) * 10) / 10
      unit        = "per 100g"
    }

    return NextResponse.json({
      found:       true,
      name:        name.trim(),
      caloriesPer,
      proteinGPer,
      carbsGPer,
      fatGPer,
      unit,
    })
  } catch {
    // Network error or timeout
    return NextResponse.json({ found: false })
  }
}
