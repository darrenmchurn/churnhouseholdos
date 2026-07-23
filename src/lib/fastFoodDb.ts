// Curated fast-food / restaurant database — a local, keyless, always-available
// source merged into nutrition search. Values are from official / published
// nutrition (fast-food macros are stable and widely published); every logged
// item is also editable in the app, so the family can correct anything.
//
// Regional chains (esp. Torchy's) vary a lot by source and customization, so
// treat those as close approximations. To add a chain: append a CuratedFood.
// Nugget/finger counts are exact multiples of a verified single piece.

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

// One-serving helper for items that have a single portion
const one = (
  id: string, name: string, brand: string,
  label: string, unit: string,
  cal: number, p: number, c: number, f: number,
  keywords?: string,
): CuratedFood => ({ id, name, brand, keywords, servings: [s(label, unit, cal, p, c, f)] })

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
    servings: [s("8 count", "8 ct", 130, 25, 2, 3), s("12 count", "12 ct", 200, 38, 3, 4)],
  },
  one("cfa-sandwich", "Chicken Sandwich", "Chick-fil-A", "1 sandwich", "sandwich", 420, 29, 41, 18),
  one("cfa-spicy-sandwich", "Spicy Chicken Sandwich", "Chick-fil-A", "1 sandwich", "sandwich", 450, 28, 45, 19),
  {
    id: "cfa-waffle-fries", name: "Waffle Potato Fries", brand: "Chick-fil-A", keywords: "fries",
    servings: [s("Medium", "medium", 420, 5, 45, 24), s("Small", "small", 320, 4, 34, 18)],
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
  one("canes-box-combo", "Box Combo (4 fingers, fries, toast, slaw, sauce)", "Raising Cane's", "1 combo", "combo", 1250, 61, 97, 68, "canes combo meal"),

  // ── McDonald's ───────────────────────────────────────────────────────────
  one("mcd-big-mac", "Big Mac", "McDonald's", "1 sandwich", "sandwich", 540, 25, 46, 28, "burger"),
  {
    id: "mcd-mcnuggets", name: "Chicken McNuggets", brand: "McDonald's", keywords: "nuggets tenders",
    servings: [
      s("10 piece", "10 pc", 420, 24, 26, 25),
      s("6 piece", "6 pc", 250, 15, 16, 15),
      s("4 piece", "4 pc", 170, 10, 10, 10),
      s("20 piece", "20 pc", 840, 48, 52, 50),
    ],
  },
  {
    id: "mcd-fries", name: "French Fries", brand: "McDonald's", keywords: "fries",
    servings: [s("Medium", "medium", 320, 4, 43, 15), s("Small", "small", 230, 3, 33, 11), s("Large", "large", 480, 6, 66, 23)],
  },
  one("mcd-quarter-pounder", "Quarter Pounder with Cheese", "McDonald's", "1 sandwich", "sandwich", 520, 30, 42, 26, "burger"),
  one("mcd-mccrispy", "McCrispy Chicken Sandwich", "McDonald's", "1 sandwich", "sandwich", 470, 27, 46, 20, "chicken"),

  // ── Wendy's ──────────────────────────────────────────────────────────────
  one("wendys-daves-single", "Dave's Single", "Wendy's", "1 burger", "burger", 590, 30, 39, 34, "burger cheeseburger"),
  one("wendys-baconator", "Baconator", "Wendy's", "1 burger", "burger", 950, 56, 39, 62, "burger"),
  {
    id: "wendys-nuggets", name: "Chicken Nuggets", brand: "Wendy's", keywords: "nuggets tenders",
    servings: [s("6 piece", "6 pc", 250, 13, 12, 16), s("10 piece", "10 pc", 420, 22, 20, 27), s("4 piece", "4 pc", 170, 9, 8, 11)],
  },
  one("wendys-fries", "French Fries", "Wendy's", "Medium", "medium", 420, 5, 55, 20, "fries"),

  // ── Chipotle (build-your-own ingredients) ─────────────────────────────────
  one("chip-bowl", "Chicken Burrito Bowl (rice, beans, cheese, salsa)", "Chipotle", "1 bowl", "bowl", 660, 51, 68, 21, "burrito bowl"),
  one("chip-chicken", "Chicken", "Chipotle", "4 oz serving", "serving", 180, 32, 0, 7, "burrito bowl protein"),
  one("chip-steak", "Steak", "Chipotle", "4 oz serving", "serving", 150, 21, 1, 6, "burrito bowl protein"),
  one("chip-barbacoa", "Barbacoa", "Chipotle", "4 oz serving", "serving", 170, 24, 2, 7, "burrito bowl protein"),
  one("chip-carnitas", "Carnitas", "Chipotle", "4 oz serving", "serving", 210, 23, 0, 12, "burrito bowl protein pork"),
  one("chip-sofritas", "Sofritas", "Chipotle", "4 oz serving", "serving", 150, 8, 9, 10, "burrito bowl protein tofu"),
  one("chip-white-rice", "White Rice", "Chipotle", "4 oz serving", "serving", 210, 4, 40, 4, "burrito bowl"),
  one("chip-brown-rice", "Brown Rice", "Chipotle", "4 oz serving", "serving", 210, 4, 36, 6, "burrito bowl"),
  one("chip-black-beans", "Black Beans", "Chipotle", "4 oz serving", "serving", 130, 8, 22, 2, "burrito bowl"),
  one("chip-pinto-beans", "Pinto Beans", "Chipotle", "4 oz serving", "serving", 130, 8, 21, 2, "burrito bowl"),
  one("chip-guac", "Guacamole", "Chipotle", "4 oz serving", "serving", 230, 2, 8, 22, "burrito bowl guac"),
  one("chip-cheese", "Cheese", "Chipotle", "1 oz serving", "serving", 110, 6, 1, 8, "burrito bowl"),
  one("chip-sour-cream", "Sour Cream", "Chipotle", "2 oz serving", "serving", 110, 2, 2, 9, "burrito bowl"),
  one("chip-queso", "Queso Blanco", "Chipotle", "2 oz serving", "serving", 120, 5, 4, 9, "burrito bowl"),
  one("chip-chips", "Chips", "Chipotle", "1 bag", "bag", 540, 7, 73, 25, "tortilla chips"),
  one("chip-tortilla", "Flour Tortilla (burrito)", "Chipotle", "1 tortilla", "tortilla", 320, 8, 50, 9, "burrito wrap"),

  // ── Taco Bell ────────────────────────────────────────────────────────────
  one("tb-crunchy-taco", "Crunchy Taco", "Taco Bell", "1 taco", "taco", 170, 8, 13, 10),
  one("tb-soft-taco", "Soft Taco (Beef)", "Taco Bell", "1 taco", "taco", 180, 9, 18, 9),
  one("tb-crunchwrap", "Crunchwrap Supreme", "Taco Bell", "1 crunchwrap", "crunchwrap", 530, 16, 71, 21),
  one("tb-bean-burrito", "Bean Burrito", "Taco Bell", "1 burrito", "burrito", 350, 13, 54, 9),
  one("tb-5layer", "Beefy 5-Layer Burrito", "Taco Bell", "1 burrito", "burrito", 490, 17, 65, 18),
  one("tb-chicken-quesadilla", "Chicken Quesadilla", "Taco Bell", "1 quesadilla", "quesadilla", 510, 26, 37, 27),
  one("tb-gordita-crunch", "Cheesy Gordita Crunch", "Taco Bell", "1 gordita", "gordita", 500, 20, 41, 28),
  one("tb-nachos-bellgrande", "Nachos BellGrande", "Taco Bell", "1 order", "order", 740, 16, 82, 38),

  // ── Starbucks (Grande, 2% milk) ──────────────────────────────────────────
  one("sbux-latte", "Caffè Latte", "Starbucks", "Grande", "grande", 190, 13, 19, 7, "coffee grande"),
  one("sbux-caramel-macchiato", "Caramel Macchiato", "Starbucks", "Grande", "grande", 250, 10, 34, 7, "coffee grande"),
  one("sbux-cappuccino", "Cappuccino", "Starbucks", "Grande", "grande", 140, 9, 14, 5, "coffee grande"),
  one("sbux-mocha", "Caffè Mocha", "Starbucks", "Grande", "grande", 360, 13, 44, 16, "coffee grande"),
  one("sbux-caramel-frap", "Caramel Frappuccino", "Starbucks", "Grande", "grande", 380, 5, 62, 15, "coffee frappuccino grande"),
  one("sbux-white-mocha", "White Chocolate Mocha", "Starbucks", "Grande", "grande", 430, 14, 53, 18, "coffee grande"),
  one("sbux-pike", "Pike Place Brewed Coffee", "Starbucks", "Grande", "grande", 5, 1, 0, 0, "coffee black grande"),

  // ── Panda Express ────────────────────────────────────────────────────────
  one("panda-orange-chicken", "Orange Chicken", "Panda Express", "1 entree", "entree", 490, 25, 51, 23),
  one("panda-beijing-beef", "Beijing Beef", "Panda Express", "1 entree", "entree", 470, 13, 46, 26),
  one("panda-broccoli-beef", "Broccoli Beef", "Panda Express", "1 entree", "entree", 150, 9, 13, 7),
  one("panda-kung-pao", "Kung Pao Chicken", "Panda Express", "1 entree", "entree", 290, 16, 14, 19),
  one("panda-teriyaki-chicken", "Grilled Teriyaki Chicken", "Panda Express", "1 entree", "entree", 300, 33, 8, 13),
  one("panda-chow-mein", "Chow Mein", "Panda Express", "1 side", "side", 510, 13, 80, 20, "noodles"),
  one("panda-fried-rice", "Fried Rice", "Panda Express", "1 side", "side", 520, 11, 85, 16),
  one("panda-white-rice", "White Steamed Rice", "Panda Express", "1 side", "side", 380, 7, 87, 0),
  one("panda-super-greens", "Super Greens", "Panda Express", "1 side", "side", 90, 6, 10, 3, "vegetables"),

  // ── Panera ───────────────────────────────────────────────────────────────
  {
    id: "panera-broc-cheddar", name: "Broccoli Cheddar Soup", brand: "Panera", keywords: "soup",
    servings: [s("Cup", "cup", 230, 9, 16, 13), s("Bowl", "bowl", 360, 14, 25, 20), s("Bread bowl", "bread bowl", 890, 37, 117, 33)],
  },
  one("panera-mac", "Mac & Cheese", "Panera", "Regular", "regular", 480, 17, 50, 24),
  one("panera-chicken-caesar", "Chicken Caesar Salad", "Panera", "Whole", "whole", 470, 33, 15, 31, "salad"),

  // ── Smoothie King (20 oz) ────────────────────────────────────────────────
  one("sk-gladiator-choc", "Gladiator Chocolate (20 oz)", "Smoothie King", "20 oz", "20 oz", 230, 45, 5, 3, "smoothie protein"),
  one("sk-angel-food-slim", "Angel Food Slim (20 oz)", "Smoothie King", "20 oz", "20 oz", 220, 4, 55, 1, "smoothie"),
  one("sk-peanut-power-plus", "Peanut Power Plus (20 oz)", "Smoothie King", "20 oz", "20 oz", 590, 20, 79, 24, "smoothie"),
  one("sk-hulk-choc", "The Hulk Chocolate (20 oz)", "Smoothie King", "20 oz", "20 oz", 640, 24, 104, 22, "smoothie"),

  // ── Freddy's ─────────────────────────────────────────────────────────────
  {
    id: "freddys-steakburger", name: "Steakburger", brand: "Freddy's", keywords: "burger",
    servings: [s("Single", "single", 380, 24, 30, 12), s("Double", "double", 570, 43, 30, 29)],
  },
  {
    id: "freddys-cali-steakburger", name: "California Style Steakburger", brand: "Freddy's", keywords: "burger",
    servings: [s("Single", "single", 510, 27, 35, 29), s("Double", "double", 750, 49, 36, 45)],
  },
  one("freddys-spicy-chicken", "Spicy Chicken Sandwich", "Freddy's", "1 sandwich", "sandwich", 570, 32, 44, 29),
  {
    id: "freddys-fries", name: "Fries", brand: "Freddy's", keywords: "fries",
    servings: [s("Regular", "regular", 400, 7, 48, 21), s("Large", "large", 520, 7, 62, 27)],
  },

  // ── Torchy's Tacos (approximate — values vary by source/customization) ────
  one("torchys-trailer-park", "Trailer Park Taco (fried chicken)", "Torchy's Tacos", "1 taco", "taco", 570, 28, 44, 31, "chicken"),
  one("torchys-democrat", "The Democrat (barbacoa)", "Torchy's Tacos", "1 taco", "taco", 400, 25, 33, 18, "beef"),
  one("torchys-green-chile-pork", "Green Chile Pork Taco", "Torchy's Tacos", "1 taco", "taco", 380, 24, 28, 19, "pork"),
  one("torchys-baja-shrimp", "Baja Shrimp Taco", "Torchy's Tacos", "1 taco", "taco", 344, 19, 35, 14, "shrimp"),
  one("torchys-fried-avocado", "Fried Avocado Taco", "Torchy's Tacos", "1 taco", "taco", 367, 13, 35, 21, "vegetarian"),
  one("torchys-queso", "Green Chile Queso", "Torchy's Tacos", "Regular", "regular", 300, 12, 12, 22, "dip cheese"),

  // ── Subway (6-inch) ──────────────────────────────────────────────────────
  one("subway-turkey", "Turkey Breast (6\")", "Subway", "6 inch", "6 inch", 280, 18, 46, 4, "sub sandwich"),
  one("subway-italian-bmt", "Italian B.M.T. (6\")", "Subway", "6 inch", "6 inch", 390, 19, 44, 16, "sub sandwich"),
  one("subway-meatball", "Meatball Marinara (6\")", "Subway", "6 inch", "6 inch", 480, 21, 58, 18, "sub sandwich"),
  one("subway-chicken", "Oven Roasted Chicken (6\")", "Subway", "6 inch", "6 inch", 320, 23, 45, 5, "sub sandwich"),
  one("subway-steak-cheese", "Steak & Cheese (6\")", "Subway", "6 inch", "6 inch", 380, 24, 45, 10, "sub sandwich"),

  // ── Popeyes ──────────────────────────────────────────────────────────────
  one("popeyes-chicken-sandwich", "Chicken Sandwich (Classic)", "Popeyes", "1 sandwich", "sandwich", 700, 28, 50, 42),
  one("popeyes-spicy-sandwich", "Spicy Chicken Sandwich", "Popeyes", "1 sandwich", "sandwich", 700, 28, 51, 42),
  {
    id: "popeyes-tenders", name: "Chicken Tenders (mild)", brand: "Popeyes", keywords: "strips fingers",
    servings: [s("3 tenders", "tenders", 340, 23, 16, 20), s("5 tenders", "tenders", 567, 38, 27, 33)],
  },
  one("popeyes-red-beans", "Red Beans & Rice", "Popeyes", "Regular", "regular", 230, 7, 30, 9),
  one("popeyes-biscuit", "Biscuit", "Popeyes", "1 biscuit", "biscuit", 200, 3, 26, 10),

  // ── Whataburger ──────────────────────────────────────────────────────────
  one("whataburger-classic", "Whataburger", "Whataburger", "1 burger", "burger", 590, 30, 56, 26, "burger"),
  one("whataburger-cheese", "Whataburger with Cheese", "Whataburger", "1 burger", "burger", 670, 34, 57, 33, "burger cheeseburger"),
  one("whataburger-fries", "French Fries", "Whataburger", "Medium", "medium", 420, 6, 54, 20, "fries"),

  // ── In-N-Out ─────────────────────────────────────────────────────────────
  {
    id: "innout-burger", name: "Burger", brand: "In-N-Out", keywords: "cheeseburger double double",
    servings: [
      s("Double-Double", "double double", 670, 37, 39, 41),
      s("Cheeseburger", "cheeseburger", 480, 22, 39, 27),
      s("Hamburger", "hamburger", 390, 16, 39, 19),
    ],
  },
  one("innout-fries", "French Fries", "In-N-Out", "1 order", "order", 370, 7, 54, 18, "fries"),

  // ── Dunkin' ──────────────────────────────────────────────────────────────
  one("dunkin-glazed", "Glazed Donut", "Dunkin'", "1 donut", "donut", 240, 4, 28, 12, "doughnut"),
  one("dunkin-boston-kreme", "Boston Kreme Donut", "Dunkin'", "1 donut", "donut", 300, 4, 40, 14, "doughnut"),
  one("dunkin-latte", "Latte", "Dunkin'", "Medium", "medium", 190, 11, 18, 7, "coffee"),
  one("dunkin-bec-croissant", "Bacon Egg & Cheese Croissant", "Dunkin'", "1 sandwich", "sandwich", 510, 20, 40, 30, "breakfast"),
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
