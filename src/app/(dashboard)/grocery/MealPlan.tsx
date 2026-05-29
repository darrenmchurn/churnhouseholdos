"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, ChevronRight, ShoppingCart, BookOpen,
  Plus, X, Trash2, Clock, Users, Pencil,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type Ingredient = {
  id: string
  name: string
  quantity: string | null
  category: string | null
}

export type Meal = {
  id: string
  title: string
  description: string | null
  servings: number
  prepMins: number
  cookMins: number
  ingredients: Ingredient[]
  createdBy: { name: string; avatarColor: string }
}

type PlanEntry = {
  id: string
  date: string
  mealType: MealType
  note: string | null
  mealId: string | null
  meal: Meal | null
  user: { name: string; avatarColor: string }
}

type MealType = "BREAKFAST" | "LUNCH" | "DINNER"

const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"]
const MEAL_LABEL: Record<MealType, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner" }
const MEAL_ICON: Record<MealType, string> = { BREAKFAST: "☀️", LUNCH: "🌤️", DINNER: "🌙" }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const CATEGORIES = [
  "Produce", "Dairy", "Meat", "Bakery", "Frozen",
  "Pantry", "Drinks", "Snacks", "Household", "Other",
]

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay() // local day-of-week (0=Sun)
  d.setDate(d.getDate() - day)
  return toDateStr(d)
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function addWeeks(weekStart: string, n: number): string {
  const [y, m, d] = weekStart.split("-").map(Number)
  const date = new Date(y, m - 1, d + n * 7)
  return toDateStr(date)
}

function getWeekDays(weekStart: string): string[] {
  const [y, m, d] = weekStart.split("-").map(Number)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(y, m - 1, d + i)
    return toDateStr(date)
  })
}

function formatWeekRange(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 6)
  const fmt = (dt: Date) => `${MONTHS[dt.getMonth()]} ${dt.getDate()}`
  return `${fmt(start)} – ${fmt(end)}`
}

function formatDay(dateStr: string): { day: string; num: string } {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return { day: DAYS[date.getDay()], num: `${MONTHS[date.getMonth()]} ${d}` }
}

function isToday(dateStr: string): boolean {
  return dateStr === toDateStr(new Date())
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MealPlan({
  initialMeals,
  canManage,
}: {
  initialMeals: Meal[]
  canManage: boolean
}) {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [entries, setEntries] = useState<PlanEntry[]>([])
  const [meals, setMeals] = useState<Meal[]>(initialMeals)
  const [loading, setLoading] = useState(false)

  // Modal state
  const [slotModal, setSlotModal] = useState<{ date: string; mealType: MealType } | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [mealForm, setMealForm] = useState<Meal | null | "new">(null) // null = closed, "new" = create
  const [groceryResult, setGroceryResult] = useState<{ added: number; skipped: number } | null>(null)
  const [addingToGrocery, setAddingToGrocery] = useState(false)

  const loadWeek = useCallback(async (ws: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/meal-plan?week=${ws}`)
      if (res.ok) setEntries(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadWeek(weekStart) }, [weekStart, loadWeek])

  function getEntry(date: string, mealType: MealType): PlanEntry | undefined {
    return entries.find((e) => e.date === date && e.mealType === mealType)
  }

  async function assignSlot(date: string, mealType: MealType, mealId: string | null, note: string) {
    const res = await fetch("/api/meal-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, mealType, mealId, note: note || null }),
    })
    if (res.ok) {
      const updated: PlanEntry = await res.json()
      setEntries((prev) => {
        const without = prev.filter((e) => !(e.date === date && e.mealType === mealType))
        return [...without, updated]
      })
    }
    setSlotModal(null)
  }

  async function clearSlot(entry: PlanEntry) {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    await fetch(`/api/meal-plan/${entry.id}`, { method: "DELETE" })
  }

  async function addToGrocery() {
    setAddingToGrocery(true)
    setGroceryResult(null)
    try {
      const res = await fetch("/api/meal-plan/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: weekStart }),
      })
      if (res.ok) {
        const data = await res.json()
        setGroceryResult(data)
        router.refresh()
      }
    } finally {
      setAddingToGrocery(false)
    }
  }

  const days = getWeekDays(weekStart)
  const thisWeek = weekStart === getWeekStart()

  // Count assigned slots for "Add to Grocery" availability
  const assignedCount = entries.filter((e) => e.mealId).length

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">{formatWeekRange(weekStart)}</p>
            {thisWeek && (
              <p className="text-xs text-indigo-500 font-medium mt-0.5">This week</p>
            )}
          </div>
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {!thisWeek && (
          <button
            onClick={() => setWeekStart(getWeekStart())}
            className="w-full mt-2 text-xs text-indigo-600 font-medium py-1 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Back to this week
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setLibraryOpen(true)}
          className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-transform"
        >
          <BookOpen size={16} />
          Recipe Library
        </button>
        <button
          disabled={assignedCount === 0 || addingToGrocery}
          onClick={addToGrocery}
          className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-transform"
        >
          <ShoppingCart size={16} />
          {addingToGrocery ? "Adding…" : "Add to Grocery"}
        </button>
      </div>

      {/* Grocery result toast */}
      {groceryResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {groceryResult.added === 0
                ? "Nothing new to add"
                : `${groceryResult.added} ingredient${groceryResult.added !== 1 ? "s" : ""} added`}
            </p>
            {groceryResult.skipped > 0 && (
              <p className="text-xs text-emerald-600 mt-0.5">
                {groceryResult.skipped} already on your list
              </p>
            )}
          </div>
          <button onClick={() => setGroceryResult(null)} className="text-emerald-500 hover:text-emerald-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Day cards */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((date) => {
            const { day, num } = formatDay(date)
            const today = isToday(date)
            return (
              <div
                key={date}
                className={cn(
                  "bg-white rounded-2xl border px-4 py-3",
                  today ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"
                )}
              >
                {/* Day header */}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={cn("text-sm font-bold", today ? "text-indigo-600" : "text-slate-800")}>
                    {day}
                  </span>
                  <span className="text-xs text-slate-400">{num}</span>
                  {today && (
                    <span className="ml-auto text-xs font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Today
                    </span>
                  )}
                </div>

                {/* Meal slots */}
                <div className="space-y-1.5">
                  {MEAL_TYPES.map((mealType) => {
                    const entry = getEntry(date, mealType)
                    return (
                      <MealSlot
                        key={mealType}
                        date={date}
                        mealType={mealType}
                        entry={entry}
                        onAdd={() => {
                          setSlotModal({ date, mealType })
                        }}
                        onClear={() => entry && clearSlot(entry)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Slot picker modal ───────────────────────────────────────────────── */}
      {slotModal && (
        <SlotPickerModal
          date={slotModal.date}
          mealType={slotModal.mealType}
          meals={meals}
          existingEntry={getEntry(slotModal.date, slotModal.mealType)}
          onAssign={(mealId, note) => assignSlot(slotModal.date, slotModal.mealType, mealId, note)}
          onClose={() => setSlotModal(null)}
        />
      )}

      {/* ── Recipe library modal ────────────────────────────────────────────── */}
      {libraryOpen && (
        <RecipeLibraryModal
          meals={meals}
          canManage={canManage}
          onNewMeal={() => setMealForm("new")}
          onEditMeal={(m) => setMealForm(m)}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {/* ── New / edit meal modal ───────────────────────────────────────────── */}
      {mealForm !== null && (
        <MealFormModal
          meal={mealForm === "new" ? null : mealForm}
          onSaved={(meal) => {
            setMeals((prev) => {
              const idx = prev.findIndex((m) => m.id === meal.id)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = meal
                return next
              }
              return [meal, ...prev]
            })
            setMealForm(null)
          }}
          onDeleted={(id) => {
            setMeals((prev) => prev.filter((m) => m.id !== id))
            setMealForm(null)
          }}
          onClose={() => setMealForm(null)}
        />
      )}
    </div>
  )
}

// ─── MealSlot row ─────────────────────────────────────────────────────────────

function MealSlot({
  date: _date,
  mealType,
  entry,
  onAdd,
  onClear,
}: {
  date: string
  mealType: MealType
  entry: PlanEntry | undefined
  onAdd: () => void
  onClear: () => void
}) {
  const hasContent = entry?.meal || entry?.note

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-5 flex-shrink-0 text-center">{MEAL_ICON[mealType]}</span>
      {hasContent ? (
        <button
          onClick={onAdd}
          className="flex-1 text-left min-w-0 group"
        >
          <span className="text-sm text-slate-800 font-medium truncate block">
            {entry?.meal?.title ?? entry?.note}
          </span>
        </button>
      ) : (
        <button
          onClick={onAdd}
          className="flex-1 text-left"
        >
          <span className="text-sm text-slate-300 hover:text-slate-400 transition-colors">
            Add {MEAL_LABEL[mealType].toLowerCase()}…
          </span>
        </button>
      )}

      {hasContent && (
        <button
          onClick={onClear}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// ─── SlotPickerModal ──────────────────────────────────────────────────────────

function SlotPickerModal({
  date,
  mealType,
  meals,
  existingEntry,
  onAssign,
  onClose,
}: {
  date: string
  mealType: MealType
  meals: Meal[]
  existingEntry: PlanEntry | undefined
  onAssign: (mealId: string | null, note: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [note, setNote] = useState(existingEntry?.note ?? "")
  const [tab, setTab] = useState<"library" | "note">("library")

  const filtered = meals.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase())
  )

  const { day, num } = formatDay(date)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-4 pb-8 max-h-[85vh] flex flex-col">
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-base font-bold text-slate-900">
              {MEAL_ICON[mealType]} {MEAL_LABEL[mealType]}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{day}, {num}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-3">
          {(["library", "note"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 h-8 rounded-lg text-sm font-medium transition-colors",
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              {t === "library" ? "🍽️ Recipes" : "📝 Quick Note"}
            </button>
          ))}
        </div>

        {tab === "library" ? (
          <div className="flex-1 flex flex-col min-h-0">
            <input
              type="text"
              placeholder="Search recipes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3 flex-shrink-0"
              autoFocus
            />
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
              {filtered.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No recipes yet</p>
              ) : (
                filtered.map((meal) => (
                  <button
                    key={meal.id}
                    onClick={() => onAssign(meal.id, "")}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-xl border transition-colors",
                      existingEntry?.mealId === meal.id
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                    )}
                  >
                    <p className="text-sm font-medium text-slate-900">{meal.title}</p>
                    {meal.ingredients.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {meal.ingredients.slice(0, 4).map((i) => i.name).join(", ")}
                        {meal.ingredients.length > 4 && " …"}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                What&apos;s for {MEAL_LABEL[mealType].toLowerCase()}?
              </label>
              <input
                type="text"
                placeholder="e.g. Leftovers, Eating out, Sandwiches…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
            <button
              disabled={!note.trim()}
              onClick={() => onAssign(null, note.trim())}
              className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              Save Note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── RecipeLibraryModal ───────────────────────────────────────────────────────

function RecipeLibraryModal({
  meals,
  canManage,
  onNewMeal,
  onEditMeal,
  onClose,
}: {
  meals: Meal[]
  canManage: boolean
  onNewMeal: () => void
  onEditMeal: (m: Meal) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")

  const filtered = meals.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-4 pb-8 max-h-[90vh] flex flex-col">
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />

        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-bold text-slate-900">Recipe Library</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={onNewMeal}
            className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center gap-1.5"
          >
            <Plus size={16} />
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-medium text-slate-500">No recipes yet</p>
              <p className="text-xs text-slate-400 mt-1">Tap &quot;New&quot; to add your first recipe</p>
            </div>
          ) : (
            filtered.map((meal) => (
              <div
                key={meal.id}
                className="bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{meal.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {meal.servings > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Users size={11} /> {meal.servings}
                        </span>
                      )}
                      {(meal.prepMins + meal.cookMins) > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={11} /> {meal.prepMins + meal.cookMins} min
                        </span>
                      )}
                    </div>
                    {meal.ingredients.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {meal.ingredients.slice(0, 4).map((i) => i.name).join(", ")}
                        {meal.ingredients.length > 4 && ` +${meal.ingredients.length - 4} more`}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => onEditMeal(meal)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MealFormModal (create & edit) ────────────────────────────────────────────

type IngRow = { name: string; quantity: string; category: string }

function MealFormModal({
  meal,
  onSaved,
  onDeleted,
  onClose,
}: {
  meal: Meal | null
  onSaved: (m: Meal) => void
  onDeleted: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(meal?.title ?? "")
  const [description, setDescription] = useState(meal?.description ?? "")
  const [servings, setServings] = useState(String(meal?.servings ?? 4))
  const [prepMins, setPrepMins] = useState(String(meal?.prepMins ?? 0))
  const [cookMins, setCookMins] = useState(String(meal?.cookMins ?? 0))
  const [ingredients, setIngredients] = useState<IngRow[]>(
    meal?.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity ?? "",
      category: i.category ?? "",
    })) ?? [{ name: "", quantity: "", category: "" }]
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  function addIngredient() {
    setIngredients((prev) => [...prev, { name: "", quantity: "", category: "" }])
  }

  function updateIngredient(idx: number, field: keyof IngRow, value: string) {
    setIngredients((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true); setError("")
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        servings: Number(servings) || 4,
        prepMins: Number(prepMins) || 0,
        cookMins: Number(cookMins) || 0,
        ingredients: ingredients.filter((i) => i.name.trim()),
      }
      const url = meal ? `/api/meals/${meal.id}` : "/api/meals"
      const method = meal ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to save")
      }
      onSaved(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!meal) return
    if (!confirm(`Delete "${meal.title}"?`)) return
    setDeleting(true)
    await fetch(`/api/meals/${meal.id}`, { method: "DELETE" })
    onDeleted(meal.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-4 pb-8 max-h-[92vh] flex flex-col">
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-bold text-slate-900">{meal ? "Edit Recipe" : "New Recipe"}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto space-y-4 min-h-0 pb-2">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Recipe Name *</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spaghetti Bolognese"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes, tips, or source…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Meta */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Servings</label>
              <input
                type="number" min="1" max="20"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Prep (min)</label>
              <input
                type="number" min="0" max="600"
                value={prepMins}
                onChange={(e) => setPrepMins(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Cook (min)</label>
              <input
                type="number" min="0" max="600"
                value={cookMins}
                onChange={(e) => setCookMins(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
              />
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Ingredients</label>
              <button
                type="button"
                onClick={addIngredient}
                className="text-xs text-indigo-600 font-medium flex items-center gap-0.5 hover:text-indigo-800"
              >
                <Plus size={12} /> Add row
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-1.5 items-start">
                  <input
                    type="text"
                    placeholder="Ingredient"
                    value={ing.name}
                    onChange={(e) => updateIngredient(idx, "name", e.target.value)}
                    className="flex-[2] h-9 px-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Qty"
                    value={ing.quantity}
                    onChange={(e) => updateIngredient(idx, "quantity", e.target.value)}
                    className="w-16 h-9 px-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={ing.category}
                    onChange={(e) => updateIngredient(idx, "category", e.target.value)}
                    className="w-24 h-9 px-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Cat.</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {meal && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="h-11 px-4 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
              >
                <Trash2 size={14} /> {deleting ? "…" : "Delete"}
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : meal ? "Save Changes" : "Create Recipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
