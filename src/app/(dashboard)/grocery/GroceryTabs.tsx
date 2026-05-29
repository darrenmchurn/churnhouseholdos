"use client"

import { useState } from "react"
import { ShoppingCart, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { GroceryList } from "./GroceryList"
import { MealPlan } from "./MealPlan"
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

type Tab = "grocery" | "meals"

export function GroceryTabs({
  initialItems,
  initialMeals,
  canManage,
  currentUser,
}: {
  initialItems: GroceryItem[]
  initialMeals: Meal[]
  canManage: boolean
  currentUser: { name: string; avatarColor: string }
}) {
  const [tab, setTab] = useState<Tab>("grocery")

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
        <TabButton
          active={tab === "grocery"}
          onClick={() => setTab("grocery")}
          icon={<ShoppingCart size={15} />}
          label="Grocery List"
        />
        <TabButton
          active={tab === "meals"}
          onClick={() => setTab("meals")}
          icon={<CalendarDays size={15} />}
          label="Meal Plan"
        />
      </div>

      {/* Content */}
      {tab === "grocery" ? (
        <GroceryList
          initialItems={initialItems}
          canManage={canManage}
          currentUser={currentUser}
        />
      ) : (
        <MealPlan
          initialMeals={initialMeals}
          canManage={canManage}
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
        "flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors",
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
