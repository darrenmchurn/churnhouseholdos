import { prisma } from "@/lib/prisma"

export { FAVORITE_GROUPS, groupLabel } from "@/lib/favorites-groups"

const DEFAULTS: { label: string; emoji: string; group: string }[] = [
  { label: "Color",            emoji: "🎨", group: "BASICS" },
  { label: "Food",             emoji: "🍕", group: "BASICS" },
  { label: "Dessert",          emoji: "🍨", group: "BASICS" },
  { label: "Snack / Candy",    emoji: "🍬", group: "BASICS" },
  { label: "Restaurant",       emoji: "🍔", group: "BASICS" },
  { label: "Drink",            emoji: "🥤", group: "BASICS" },
  { label: "Movie",            emoji: "🎬", group: "BASICS" },
  { label: "TV Show",          emoji: "📺", group: "BASICS" },
  { label: "Song / Artist",    emoji: "🎵", group: "BASICS" },
  { label: "Book",             emoji: "📚", group: "BASICS" },
  { label: "Animal",           emoji: "🐶", group: "BASICS" },
  { label: "Sport",            emoji: "⚽", group: "BASICS" },
  { label: "Holiday",          emoji: "🎄", group: "BASICS" },
  { label: "Game",             emoji: "🎮", group: "BASICS" },
  { label: "Dream Vacation",   emoji: "🏝️", group: "FUN" },
  { label: "School Subject",   emoji: "✏️", group: "FUN" },
  { label: "Family Memory",    emoji: "📸", group: "FUN" },
  { label: "Dream Job",        emoji: "🚀", group: "FUN" },
  { label: "Least Favorite Food", emoji: "🥦", group: "DISLIKES" },
  { label: "Allergies",        emoji: "⚠️", group: "DISLIKES" },
  { label: "Shirt Size",       emoji: "👕", group: "SIZES" },
  { label: "Pant Size",        emoji: "👖", group: "SIZES" },
  { label: "Shoe Size",        emoji: "👟", group: "SIZES" },
]

const SEEDED_KEY = "favorites_seeded"

/** Seed the starter categories once. Guarded by a Settings flag so admins can
 *  delete presets without them reappearing. */
export async function ensureFavoriteCategories() {
  const flag = await prisma.settings.findUnique({ where: { key: SEEDED_KEY } })
  if (flag) return
  try {
    await prisma.$transaction([
      prisma.settings.create({ data: { key: SEEDED_KEY, value: "1" } }),
      prisma.favoriteCategory.createMany({
        data: DEFAULTS.map((d, i) => ({ ...d, sortOrder: i })),
      }),
    ])
  } catch {
    // A concurrent first load won the race (unique key on the flag) — fine.
  }
}

/** Everyone edits their own; admins/parents can also edit kids'. */
export function canEditFavoritesOf(
  viewer: { id: string; role: string },
  target: { id: string; role: string },
) {
  if (viewer.role === "KIOSK") return false
  if (viewer.id === target.id) return true
  return (viewer.role === "ADMIN" || viewer.role === "PARENT") && target.role === "CHILD"
}
