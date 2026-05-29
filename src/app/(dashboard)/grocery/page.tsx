export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { GroceryList } from "./GroceryList"

export default async function GroceryPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "KIOSK") redirect("/dashboard")

  const canManage = session.user.role === "ADMIN" || session.user.role === "PARENT"

  const [currentUser, items] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, avatarColor: true },
    }),
    prisma.groceryItem.findMany({
      orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
      include: { addedBy: { select: { name: true, avatarColor: true } } },
    }),
  ])

  const pending = items.filter((i) => !i.completed).length

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Grocery List</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {pending === 0 ? "All stocked up!" : `${pending} item${pending !== 1 ? "s" : ""} to grab`}
        </p>
      </div>

      <GroceryList
        initialItems={items.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
        }))}
        canManage={canManage}
        currentUser={currentUser ?? { name: session.user.name ?? "You", avatarColor: "#6366f1" }}
      />
    </div>
  )
}
