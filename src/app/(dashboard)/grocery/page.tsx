export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { chicagoTodayStr } from "@/lib/utils"
import { GroceryTabs } from "./GroceryTabs"

export default async function GroceryPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "KIOSK") redirect("/dashboard")

  const canManage = session.user.role === "ADMIN" || session.user.role === "PARENT"
  // Chicago-local date, matching what NutritionTab shows on the client —
  // the server's own date is UTC on Vercel and flips a day early each evening
  const today = chicagoTodayStr()

  const [currentUser, items, meals, todayLog, recentWeights, savedFoods] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: session.user.id },
      select: {
        name: true, avatarColor: true,
        dailyCalorieGoal: true, dailyProteinGoal: true,
        dailyCarbsGoal: true, dailyFatGoal: true,
        weightGoalLbs: true,
      },
    }),
    prisma.groceryItem.findMany({
      orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
      include: { addedBy: { select: { name: true, avatarColor: true } } },
    }),
    prisma.meal.findMany({
      orderBy: { title: "asc" },
      include: {
        ingredients: { orderBy: { name: "asc" } },
        createdBy: { select: { name: true, avatarColor: true } },
      },
    }),
    prisma.foodLog.findMany({
      where: { userId: session.user.id, date: today },
      orderBy: { createdAt: "asc" },
    }),
    prisma.weightLog.findMany({
      where: { userId: session.user.id },
      orderBy: { date: "desc" }, // newest 30, reversed to ascending below for the chart
      take: 30,
    }),
    prisma.foodItem.findMany({
      where: { userId: session.user.id },
      orderBy: { lastUsedAt: "desc" },
    }),
  ])

  const pending = items.filter((i) => !i.completed).length

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Grocery & Meals</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {pending === 0 ? "All stocked up!" : `${pending} item${pending !== 1 ? "s" : ""} to grab`}
        </p>
      </div>

      <GroceryTabs
        initialItems={items.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
        }))}
        initialMeals={meals.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          servings: m.servings,
          prepMins: m.prepMins,
          cookMins: m.cookMins,
          ingredients: m.ingredients,
          createdBy: m.createdBy,
        }))}
        canManage={canManage}
        currentUser={currentUser ?? { name: session.user.name ?? "You", avatarColor: "#6366f1" }}
        initialLog={todayLog}
        goals={{
          calories:      currentUser?.dailyCalorieGoal ?? null,
          protein:       currentUser?.dailyProteinGoal ?? null,
          carbs:         currentUser?.dailyCarbsGoal   ?? null,
          fat:           currentUser?.dailyFatGoal     ?? null,
          weightGoalLbs: currentUser?.weightGoalLbs    ?? null,
        }}
        initialWeights={[...recentWeights].reverse()}
        savedFoods={savedFoods}
      />
    </div>
  )
}
