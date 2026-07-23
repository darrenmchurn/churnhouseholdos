// Curated fast-food / restaurant database — a local, keyless, always-available
// source merged into nutrition search. Values are from official / published
// nutrition (fast-food macros are stable and widely published); every logged
// item is also editable in the app, so the family can correct anything.
//
// To add a chain: append a CuratedFood with one or more servings. Nugget/finger
// counts are exact multiples of a single verified piece, so they stay accurate.

export type CuratedServing = {
  label: string
  unit: string
  caloriesPer: number
  proteinGPer: number
  carbsGPer: number
  fatGPer: number
}

export type CuratedFood = {
  id: string
  name: string
  brand: string
  keywords?: string // extra search terms (synonyms like "tenders", "strips")
  servings: CuratedServing[]
}

const s = (
  label: string, unit: string,
  caloriesPer: number, proteinGPer: number, carbsGPer: number, fatGPer: number,
): CuratedServing => ({ label, unit, caloriesPer, proteinGPer, carbsGPer, fatGPer })

export const CURATED_FOODS: CuratedFood[] = [
  // ── Chick-fil-A ──────────────────────────────────────────────────────────
  {
    id: "cfa-nuggets", name: "Chicken Nuggets", brand: "Chick-fil-A",
    keywords: "tenders strips bites",
    servings: [
      s("8 count", "8 ct", 250, 27, 11, 11),
      s("12 count", "12 ct", 380, 40, 16, 17),
      s("5 count", "5 ct", 156, 17, 7, 7),
      s("30 count", "30 ct", 940, 101, 41, 41),
    ],
  },
  {
    id: "cfa-grilled-nuggets", name: "Grilled Nuggets", brand: "Chick-fil-A",
    keywords: "grilled tenders",
    servings: [
      s("8 count", "8 ct", 130, 25, 2, 3),
      s("12 count", "12 ct", 200, 38, 3, 4),
    ],
  },
  {
    id: "cfa-sandwich", name: "Chicken Sandwich", brand: "Chick-fil-A",
    servings: [s("1 sandwich", "sandwich", 420, 29, 41, 18)],
  },
  {
    id: "cfa-spicy-sandwich", name: "Spicy Chicken Sandwich", brand: "Chick-fil-A",
    servings: [s("1 sandwich", "sandwich", 450, 28, 45, 19)],
  },
  {
    id: "cfa-waffle-fries", name: "Waffle Potato Fries", brand: "Chick-fil-A",
    keywords: "fries",
    servings: [
      s("Medium", "medium", 420, 5, 45, 24),
      s("Small", "small", 320, 4, 34, 18),
    ],
  },

  // ── Raising Cane's ───────────────────────────────────────────────────────
  {
    id: "canes-fingers", name: "Chicken Fingers", brand: "Raising Cane's",
    keywords: "tenders strips canes chicken",
    servings: [
      s("3 fingers", "fingers", 390, 39, 15, 18),
      s("4 fingers", "fingers", 520, 52, 20, 24),
      s("6 fingers (Caniac)", "fingers", 780, 78, 30, 36),
      s("1 finger", "finger", 130, 13, 5, 6),
    ],
  },
  {
    id: "canes-box-combo", name: "Box Combo (4 fingers, fries, toast, slaw, sauce)", brand: "Raising Cane's",
    keywords: "canes combo meal",
    servings: [s("1 combo", "combo", 1250, 61, 97, 68)],
  },

  // ── McDonald's ───────────────────────────────────────────────────────────
  {
    id: "mcd-big-mac", name: "Big Mac", brand: "McDonald's",
    keywords: "burger",
    servings: [s("1 sandwich", "sandwich", 540, 25, 46, 28)],
  },
  {
    id: "mcd-mcnuggets", name: "Chicken McNuggets", brand: "McDonald's",
    keywords: "nuggets tenders",
    servings: [
      s("10 piece", "10 pc", 420, 24, 26, 25),
      s("6 piece", "6 pc", 250, 15, 16, 15),
      s("4 piece", "4 pc", 170, 10, 10, 10),
      s("20 piece", "20 pc", 840, 48, 52, 50),
    ],
  },
  {
    id: "mcd-fries", name: "French Fries", brand: "McDonald's",
    keywords: "fries",
    servings: [
      s("Medium", "medium", 320, 4, 43, 15),
      s("Small", "small", 230, 3, 33, 11),
      s("Large", "large", 480, 6, 66, 23),
    ],
  },

  // ── Wendy's ──────────────────────────────────────────────────────────────
  {
    id: "wendys-daves-single", name: "Dave's Single", brand: "Wendy's",
    keywords: "burger cheeseburger",
    servings: [s("1 burger", "burger", 590, 30, 39, 34)],
  },
]

// Substring match on an alphanumeric-normalized haystack, so "Chick-Fil-A",
// "chickfila", and "canes" all match regardless of punctuation/spacing.
const norm = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "")

export function searchCurated(query: string, limit = 8): CuratedFood[] {
  const terms = query.trim().split(/\s+/).map(norm).filter(Boolean)
  if (terms.length === 0) return []
  const scored = CURATED_FOODS.map((f) => {
    const hay = norm(`${f.brand} ${f.name} ${f.keywords ?? ""}`)
    const hits = terms.filter((t) => hay.includes(t)).length
    return { f, hits }
  })
  return scored
    .filter((x) => x.hits === terms.length) // every typed word must match
    .slice(0, limit)
    .map((x) => x.f)
}

export function getCurated(id: string): CuratedFood | undefined {
  return CURATED_FOODS.find((f) => f.id === id)
}
