export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { canEditFavoritesOf } from "@/lib/favorites"
import { loadFavorites } from "@/lib/favorites-data"
import { FavoritesBrowser } from "./FavoritesBrowser"

export default async function FavoritesPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [users, { categories, entries }] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "KIOSK" } },
      select: { id: true, name: true, role: true, avatarColor: true },
      orderBy: { createdAt: "asc" },
    }),
    loadFavorites(),
  ])

  // Put the viewer first so "mine" is always at the top
  const people = users
    .sort((a, b) => (a.id === session.user.id ? -1 : b.id === session.user.id ? 1 : 0))
    .map((u) => ({
      id: u.id,
      name: u.name,
      avatarColor: u.avatarColor,
      canEdit: canEditFavoritesOf(session.user, u),
    }))

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Family Favorites</h1>
        <p className="text-slate-500 text-sm mt-0.5">What everyone loves (and their sizes, for gift time)</p>
      </div>
      <FavoritesBrowser
        people={people}
        categories={categories}
        entries={entries}
        viewerId={session.user.id}
      />
    </div>
  )
}
