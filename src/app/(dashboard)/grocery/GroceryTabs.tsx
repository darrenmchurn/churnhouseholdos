"use client"

import { useState } from "react"
import { ShoppingCart, CalendarDays, Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { GroceryList } from "./GroceryList"
import { MealPlan } from "./MealPlan"
import { NutritionTab } from "./NutritionTab"
import type { Meal } from "./MealPlan"

type GroceryItem = {
  id: string
  name: string
  quantity: string | null
  category: string | null
  completed: boolean
  createdAt: string
  addedBy: { name: string; avatarColor: string }
}

type FoodEntry = {
  id: string
  date: string
  mealType: string
  name: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  quantity: number
  unit: string
}

type Goals = {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  weightGoalLbs: number | null
}

type WeightEntry = {
  id: string
  date: string
  weightLbs: number
  note: string | null
}

type Tab = "grocery" | "meals" | "nutrition"

export function GroceryTabs({
  initialItems,
  initialMeals,
  canManage,
  currentUser,
  initialLog,
  goals,
  initialWeights,
}: {
  initialItems: GroceryItem[]
  initialMeals: Meal[]
  canManage: boolean
  currentUser: { name: string; avatarColor: string }
  initialLog: FoodEntry[]
  goals: Goals
  initialWeights: WeightEntry[]
}) {
  const [tab, setTab] = useState<Tab>("grocery")

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
        <TabButton
          active={tab === "grocery"}
          onClick={() => setTab("grocery")}
          icon={<ShoppingCart size={14} />}
          label="Grocery"
        />
        <TabButton
          active={tab === "meals"}
          onClick={() => setTab("meals")}
          icon={<CalendarDays size={14} />}
          label="Meals"
        />
        <TabButton
          active={tab === "nutrition"}
          onClick={() => setTab("nutrition")}
          icon={<Flame size={14} />}
          label="Nutrition"
        />
      </div>

      {/* Content */}
      {tab === "grocery" && (
        <GroceryList
          initialItems={initialItems}
          canManage={canManage}
          currentUser={currentUser}
        />
      )}
      {tab === "meals" && (
        <MealPlan
          initialMeals={initialMeals}
          canManage={canManage}
        />
      )}
      {tab === "nutrition" && (
        <NutritionTab
          initialLog={initialLog}
          goals={goals}
          initialWeights={initialWeights}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors",
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  )
}
