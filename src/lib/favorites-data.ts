import { prisma } from "@/lib/prisma"
import { ensureFavoriteCategories } from "@/lib/favorites"
import type { FavCategory, FavEntry } from "@/app/(dashboard)/favorites/types"

/** Active preset categories + answers (optionally for one person), serialized for client components. */
export async function loadFavorites(userId?: string): Promise<{ categories: FavCategory[]; entries: FavEntry[] }> {
  await ensureFavoriteCategories()
  const [categories, favorites] = await Promise.all([
    prisma.favoriteCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, emoji: true, group: true, sortOrder: true },
    }),
    prisma.favorite.findMany({
      where: {
        ...(userId ? { userId } : {}),
        // Hide answers to categories an admin has hidden
        OR: [{ categoryId: null }, { category: { active: true } }],
      },
      orderBy: { createdAt: "asc" },
      include: { updatedBy: { select: { name: true } } },
    }),
  ])

  return {
    categories,
    entries: favorites.map((f) => ({
      id: f.id,
      userId: f.userId,
      categoryId: f.categoryId,
      customLabel: f.customLabel,
      customEmoji: f.customEmoji,
      value: f.value,
      note: f.note,
      updatedAt: f.updatedAt.toISOString(),
      updatedByName: f.updatedById && f.updatedById !== f.userId ? (f.updatedBy?.name ?? null) : null,
    })),
  }
}
