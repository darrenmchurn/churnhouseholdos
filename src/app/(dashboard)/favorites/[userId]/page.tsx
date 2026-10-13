export const dynamic = "force-dynamic"

import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ChevronLeft } from "lucide-react"
import { canEditFavoritesOf } from "@/lib/favorites"
import { loadFavorites } from "@/lib/favorites-data"
import { FavoritesEditor } from "./FavoritesEditor"

export default async function EditFavoritesPage(props: { params: Promise<{ userId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  const { userId } = await props.params
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  })
  if (!target || !canEditFavoritesOf(session.user, target)) redirect("/favorites")

  const { categories, entries } = await loadFavorites(target.id)
  const isSelf = target.id === session.user.id

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <Link href="/favorites" className="inline-flex items-center gap-1 text-sm text-slate-500 mb-3">
        <ChevronLeft size={16} />
        Family Favorites
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">
          {isSelf ? "My Favorites" : `${target.name}'s Favorites`}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Tap any row to fill it in. Skip anything you like.</p>
      </div>
      <FavoritesEditor userId={target.id} categories={categories} initialEntries={entries} />
    </div>
  )
}
