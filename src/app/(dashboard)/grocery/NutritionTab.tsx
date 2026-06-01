"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2,
  Camera, Pencil, Flame, Scale, BookOpen, ArrowLeft, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

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

type WeightEntry = {
  id: string
  date: string
  weightLbs: number
  note: string | null
}

export type FoodItem = {
  id: string
  name: string
  barcode: string | null
  caloriesPer: number
  proteinGPer: number
  carbsGPer: number
  fatGPer: number
  unit: string
}

type Goals = {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  weightGoalLbs: number | null
}

type MealSection = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK"

const MEAL_SECTIONS: MealSection[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]
const MEAL_LABEL: Record<MealSection, string> = {
  BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner", SNACK: "Snacks",
}
const MEAL_ICON: Record<MealSection, string> = {
  BREAKFAST: "☀️", LUNCH: "🌤️", DINNER: "🌙", SNACK: "🍎",
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  if (dateStr === todayStr()) return "Today"
  if (dateStr === addDays(todayStr(), -1)) return "Yesterday"
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

// ─── Accessible progress bar ─────────────────────────────────────────────────

function ProgressBar({
  label,
  value,
  goal,
  barColor,
  overColor = "bg-red-400",
  height = "h-2",
}: {
  label: string
  value: number
  goal: number | null
  barColor: string
  overColor?: string
  height?: string
}) {
  const pct = goal ? Math.min((value / goal) * 100, 100) : 0
  const over = goal ? value > goal : false
  const displayColor = over ? overColor : barColor

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={goal ?? undefined}
      aria-label={
        goal
          ? `${label}: ${Math.round(value)} of ${goal}`
          : `${label}: ${Math.round(value)}`
      }
      className={cn("w-full bg-slate-200 rounded-full overflow-hidden", height)}
    >
      {goal ? (
        <div
          className={cn("h-full rounded-full transition-all duration-300", displayColor)}
          style={{ width: `${pct}%` }}
        />
      ) : (
        <div className={cn("h-full rounded-full w-full opacity-20", barColor)} />
      )}
    </div>
  )
}

function MacroRow({
  label,
  fullLabel,
  value,
  goal,
  barColor,
}: {
  label: string
  fullLabel: string
  value: number
  goal: number | null
  barColor: string
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Visually abbreviated, full label for screen readers */}
      <span className="text-xs font-medium text-slate-500 w-6 flex-shrink-0" aria-hidden="true">
        {label}
      </span>
      <span className="sr-only">{fullLabel}</span>
      <div className="flex-1">
        <ProgressBar label={fullLabel} value={value} goal={goal} barColor={barColor} height="h-1.5" />
      </div>
      <span className="text-xs text-slate-500 flex-shrink-0 text-right w-20">
        <span aria-hidden="true">
          {Math.round(value)}{goal ? `/${goal}g` : "g"}
        </span>
      </span>
    </div>
  )
}

// ─── Weight sparkline ─────────────────────────────────────────────────────────

function WeightSparkline({
  data,
  goalLbs,
}: {
  data: WeightEntry[]
  goalLbs: number | null
}) {
  if (data.length < 2) return null

  const W = 300
  const H = 52
  const PAD = 6

  const weights = data.map((d) => d.weightLbs)
  const allVals = goalLbs ? [...weights, goalLbs] : weights
  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const range = rawMax - rawMin || 1
  const min = rawMin - range * 0.1
  const max = rawMax + range * 0.1

  const xOf = (i: number) => PAD + ((i / (data.length - 1)) * (W - PAD * 2))
  const yOf = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2)

  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.weightLbs) }))
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      aria-hidden="true"
      focusable="false"
    >
      {/* Goal line */}
      {goalLbs && (
        <line
          x1={PAD} y1={yOf(goalLbs)}
          x2={W - PAD} y2={yOf(goalLbs)}
          stroke="#6366f1"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          opacity={0.6}
        />
      )}
      {/* Trend line */}
      <path d={pathD} fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#f97316" />
      ))}
      {/* Latest point highlighted */}
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={4.5} fill="#ea580c" />
    </svg>
  )
}

// ─── Weight card ──────────────────────────────────────────────────────────────

function WeightCard({
  weights,
  goalLbs,
  today,
}: {
  weights: WeightEntry[]
  goalLbs: number | null
  today: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [weightInput, setWeightInput] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [entries, setEntries] = useState<WeightEntry[]>(weights)

  const latest = entries[entries.length - 1]
  const todayEntry = entries.find((e) => e.date === today)
  const diff = latest && goalLbs ? latest.weightLbs - goalLbs : null

  async function logWeight(e: React.FormEvent) {
    e.preventDefault()
    if (!weightInput) return
    setSaving(true)
    try {
      const res = await fetch("/api/nutrition/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, weightLbs: Number(weightInput), note: note || null }),
      })
      if (res.ok) {
        const entry: WeightEntry = await res.json()
        setEntries((prev) => {
          const without = prev.filter((e) => e.date !== today)
          return [...without, entry].sort((a, b) => a.date.localeCompare(b.date))
        })
        setWeightInput("")
        setNote("")
        setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteWeight(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    await fetch(`/api/nutrition/weight/${id}`, { method: "DELETE" })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-indigo-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-800">Weight</h3>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
          aria-label={todayEntry ? "Edit today's weight" : "Log today's weight"}
        >
          {todayEntry ? <Pencil size={14} /> : <Plus size={16} />}
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        {latest ? (
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-none">
              {latest.weightLbs.toFixed(1)}
              <span className="text-sm font-normal text-slate-400 ml-1">lbs</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{formatDateLabel(latest.date)}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No entries yet</p>
        )}

        {goalLbs && latest && (
          <div className="flex-1">
            {diff !== null && (
              <p className={cn("text-sm font-semibold", diff > 0 ? "text-orange-500" : diff < 0 ? "text-green-600" : "text-indigo-600")}>
                {diff === 0
                  ? "✓ At goal!"
                  : diff > 0
                    ? `${diff.toFixed(1)} lbs above goal`
                    : `${Math.abs(diff).toFixed(1)} lbs below goal`}
              </p>
            )}
            <p className="text-xs text-slate-400">Goal: {goalLbs} lbs</p>
          </div>
        )}
      </div>

      {/* Chart */}
      {entries.length >= 2 && (
        <div>
          <WeightSparkline data={entries} goalLbs={goalLbs} />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-slate-400">{formatDateLabel(entries[0].date)}</span>
            {goalLbs && (
              <span className="flex items-center gap-1 text-xs text-indigo-500">
                <span className="inline-block w-4 border-t border-dashed border-indigo-400" aria-hidden="true" />
                Goal
              </span>
            )}
            <span className="text-xs text-slate-400">{formatDateLabel(entries[entries.length - 1].date)}</span>
          </div>
        </div>
      )}

      {/* Today's entry (if exists) */}
      {todayEntry && !showForm && (
        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
          <p className="text-sm text-slate-700">Today: <span className="font-semibold">{todayEntry.weightLbs.toFixed(1)} lbs</span></p>
          <button
            onClick={() => deleteWeight(todayEntry.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            aria-label="Remove today's weight entry"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Log form */}
      {showForm && (
        <form onSubmit={logWeight} className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="weight-input" className="sr-only">Weight in pounds</label>
              <input
                id="weight-input"
                type="number"
                min="50"
                max="700"
                step="0.1"
                required
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder={todayEntry ? String(todayEntry.weightLbs) : "e.g. 175.5"}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Weight in pounds"
              />
            </div>
            <span className="self-center text-sm text-slate-500 flex-shrink-0">lbs</span>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (e.g. morning)"
            className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Optional note for this weight entry"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 h-9 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !weightInput}
              className="flex-1 h-9 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : todayEntry ? "Update" : "Log Weight"}
            </button>
          </div>
        </form>
      )}

      {!goalLbs && !latest && (
        <p className="text-xs text-slate-400 text-center">
          Set a goal weight in your{" "}
          <a href="/profile" className="text-indigo-500 font-medium underline-offset-2 hover:underline">
            Profile
          </a>
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NutritionTab({
  initialLog,
  goals,
  initialWeights,
  initialFoods,
}: {
  initialLog: FoodEntry[]
  goals: Goals
  initialWeights: WeightEntry[]
  initialFoods: FoodItem[]
}) {
  const [date, setDate] = useState(todayStr)
  const [log, setLog] = useState<FoodEntry[]>(initialLog)
  const [loading, setLoading] = useState(false)
  const [addingFor, setAddingFor] = useState<MealSection | null>(null)
  const [savedFoods, setSavedFoods] = useState<FoodItem[]>(initialFoods)

  function handleFoodSaved(food: FoodItem) {
    setSavedFoods((prev) => {
      const without = prev.filter((f) => f.id !== food.id)
      return [food, ...without] // most recently used at top
    })
  }

  function handleFoodDeleted(id: string) {
    setSavedFoods((prev) => prev.filter((f) => f.id !== id))
  }

  const isToday = date === todayStr()

  const loadDay = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/nutrition/log?date=${d}`)
      if (res.ok) setLog(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (date !== todayStr()) loadDay(date)
  }, [date, loadDay])

  async function deleteEntry(id: string) {
    setLog((prev) => prev.filter((e) => e.id !== id))
    await fetch(`/api/nutrition/log/${id}`, { method: "DELETE" })
  }

  function onAdded(entry: FoodEntry) {
    setLog((prev) => [...prev, entry])
    setAddingFor(null)
  }

  const totals = log.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein:  acc.protein  + e.proteinG,
      carbs:    acc.carbs    + e.carbsG,
      fat:      acc.fat      + e.fatG,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const calOver = goals.calories ? totals.calories > goals.calories : false

  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setDate((d) => addDays(d, -1))}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-slate-900" aria-live="polite" aria-atomic="true">
          {formatDateLabel(date)}
        </p>
        <button
          onClick={() => setDate((d) => addDays(d, 1))}
          disabled={isToday}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30"
          aria-label="Next day"
          aria-disabled={isToday}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Daily summary card */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 sr-only">Daily nutrition summary</h2>

        {/* Calorie row */}
        <div className="flex items-center gap-3">
          <div
            className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", calOver ? "bg-red-100" : "bg-orange-50")}
            aria-hidden="true"
          >
            <Flame size={18} className={calOver ? "text-red-500" : "text-orange-500"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-semibold text-slate-900">
                {Math.round(totals.calories).toLocaleString()} kcal
              </span>
              {goals.calories && (
                <span className="text-xs text-slate-400" aria-hidden="true">
                  / {goals.calories.toLocaleString()} goal
                </span>
              )}
            </div>
            <ProgressBar
              label="Calories"
              value={totals.calories}
              goal={goals.calories}
              barColor="bg-orange-400"
              height="h-2.5"
            />
          </div>
        </div>

        {/* Macro rows */}
        <div className="space-y-2 pt-0.5">
          <MacroRow label="P" fullLabel="Protein" value={totals.protein} goal={goals.protein} barColor="bg-red-400" />
          <MacroRow label="C" fullLabel="Carbohydrates" value={totals.carbs} goal={goals.carbs} barColor="bg-yellow-400" />
          <MacroRow label="F" fullLabel="Fat" value={totals.fat} goal={goals.fat} barColor="bg-purple-400" />
        </div>

        {!goals.calories && !goals.protein && (
          <p className="text-xs text-slate-500 text-center pt-1">
            Set goals in your{" "}
            <a href="/profile" className="text-indigo-600 font-medium underline-offset-2 hover:underline">
              Profile
            </a>{" "}
            to see progress bars
          </p>
        )}
      </div>

      {/* Weight tracking card */}
      <WeightCard
        weights={initialWeights}
        goalLbs={goals.weightGoalLbs}
        today={todayStr()}
      />

      {/* Meal sections */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center" aria-live="polite">
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      ) : (
        <div className="space-y-3" aria-live="polite" aria-label="Food log">
          {MEAL_SECTIONS.map((section) => {
            const items = log.filter((e) => e.mealType === section)
            const sectionCals = Math.round(items.reduce((s, e) => s + e.calories, 0))
            return (
              <section key={section} aria-label={MEAL_LABEL[section]} className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">{MEAL_ICON[section]}</span>
                    <h3 className="text-sm font-semibold text-slate-800">{MEAL_LABEL[section]}</h3>
                    {sectionCals > 0 && (
                      <span className="text-xs text-slate-400" aria-label={`${sectionCals} calories`}>
                        {sectionCals} kcal
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setAddingFor(section)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
                    aria-label={`Add food to ${MEAL_LABEL[section]}`}
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 pb-0.5">Nothing logged yet</p>
                ) : (
                  <ul className="space-y-1.5" aria-label={`${MEAL_LABEL[section]} entries`}>
                    {items.map((entry) => (
                      <li key={entry.id}>
                        <FoodEntryRow entry={entry} onDelete={deleteEntry} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Add Food sheet */}
      {addingFor && (
        <AddFoodSheet
          date={date}
          mealType={addingFor}
          savedFoods={savedFoods}
          onAdded={onAdded}
          onFoodSaved={handleFoodSaved}
          onFoodDeleted={handleFoodDeleted}
          onClose={() => setAddingFor(null)}
        />
      )}
    </div>
  )
}

// ─── FoodEntryRow ─────────────────────────────────────────────────────────────

function FoodEntryRow({ entry, onDelete }: { entry: FoodEntry; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 min-h-[2.75rem]">
      <div className="flex-1 min-w-0 self-center">
        <p className="text-sm text-slate-800 truncate">{entry.name}</p>
        <p className="text-xs text-slate-500">
          <span aria-label={`${Math.round(entry.calories)} calories`}>{Math.round(entry.calories)} kcal</span>
          {" · "}
          <span aria-label={`${Math.round(entry.proteinG)} grams protein`}>P{Math.round(entry.proteinG)}g</span>
          {" · "}
          <span aria-label={`${Math.round(entry.carbsG)} grams carbs`}>C{Math.round(entry.carbsG)}g</span>
          {" · "}
          <span aria-label={`${Math.round(entry.fatG)} grams fat`}>F{Math.round(entry.fatG)}g</span>
          {entry.quantity !== 1 && <span aria-label={`quantity ${entry.quantity}`}>{" · "}{entry.quantity}×</span>}
        </p>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 self-center"
        aria-label={`Remove ${entry.name}`}
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>
  )
}

// ─── AddFoodSheet ─────────────────────────────────────────────────────────────

type BarcodeResult = {
  found: boolean
  name?: string
  caloriesPer?: number
  proteinGPer?: number
  carbsGPer?: number
  fatGPer?: number
  unit?: string
}

type SheetView = "choose" | "existing" | "new"

function AddFoodSheet({
  date,
  mealType,
  savedFoods,
  onAdded,
  onFoodSaved,
  onFoodDeleted,
  onClose,
}: {
  date: string
  mealType: MealSection
  savedFoods: FoodItem[]
  onAdded: (entry: FoodEntry) => void
  onFoodSaved: (food: FoodItem) => void
  onFoodDeleted: (id: string) => void
  onClose: () => void
}) {
  const [view, setView] = useState<SheetView>(savedFoods.length > 0 ? "choose" : "new")
  const [tab, setTab] = useState<"scan" | "manual">("scan")

  const [name,     setName]     = useState("")
  const [calories, setCalories] = useState("")
  const [protein,  setProtein]  = useState("")
  const [carbs,    setCarbs]    = useState("")
  const [fat,      setFat]      = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unit,     setUnit]     = useState("serving")
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState("")

  const [scanning,     setScanning]     = useState(false)
  const [barcodeInput, setBarcodeInput] = useState("")
  const [lookingUp,    setLookingUp]    = useState(false)
  const [lookupMsg,    setLookupMsg]    = useState("")
  const [cameraError,  setCameraError]  = useState("")
  const videoRef     = useRef<HTMLVideoElement>(null)
  const controlsRef  = useRef<{ stop: () => void } | null>(null)

  // "Existing" view state
  const [existingSearch, setExistingSearch] = useState("")
  const [selectedFood,   setSelectedFood]   = useState<FoodItem | null>(null)
  const [existingQty,    setExistingQty]    = useState("1")
  const [logginExisting, setLoggingExisting] = useState(false)
  const [deletingFood,   setDeletingFood]   = useState<string | null>(null)

  // Silent save to food library after every log
  async function saveToLibrary(data: {
    name: string; barcode: string | null
    caloriesPer: number; proteinGPer: number; carbsGPer: number; fatGPer: number
    unit: string
  }) {
    try {
      const res = await fetch("/api/nutrition/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) onFoodSaved(await res.json())
    } catch { /* silent */ }
  }

  async function deleteFromLibrary(food: FoodItem) {
    setDeletingFood(food.id)
    try {
      const res = await fetch(`/api/nutrition/foods/${food.id}`, { method: "DELETE" })
      if (res.ok) onFoodDeleted(food.id)
    } finally {
      setDeletingFood(null)
      if (selectedFood?.id === food.id) setSelectedFood(null)
    }
  }

  async function logExistingFood() {
    if (!selectedFood) return
    setLoggingExisting(true)
    try {
      const qty = Number(existingQty) || 1
      const res = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, mealType,
          name:     selectedFood.name,
          calories: selectedFood.caloriesPer * qty,
          proteinG: selectedFood.proteinGPer * qty,
          carbsG:   selectedFood.carbsGPer   * qty,
          fatG:     selectedFood.fatGPer     * qty,
          quantity: qty,
          unit:     selectedFood.unit,
          barcode:  selectedFood.barcode,
        }),
      })
      if (!res.ok) throw new Error("Failed to log")
      onAdded(await res.json())
      // Bump lastUsedAt on the saved food
      fetch(`/api/nutrition/foods/${selectedFood.id}`, { method: "PATCH" })
        .then((r) => r.ok ? r.json() : null)
        .then((updated) => { if (updated) onFoodSaved(updated) })
    } finally {
      setLoggingExisting(false)
    }
  }

  async function startScanner() {
    setCameraError("")
    setScanning(true)
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      const reader = new BrowserMultiFormatReader()
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        async (result, err) => {
          if (result) {
            stopScanner()
            await lookupBarcode(result.getText())
          }
          if (err && !(err instanceof Error && err.message?.includes("No MultiFormat Readers"))) {
            // Ignore per-frame "no barcode" errors
          }
        }
      )
      controlsRef.current = controls
    } catch (e) {
      setCameraError(
        e instanceof Error && e.message.includes("Permission")
          ? "Camera permission denied. Enter barcode manually below."
          : "Could not start camera. Enter barcode manually below."
      )
      setScanning(false)
    }
  }

  function stopScanner() {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
  }

  useEffect(() => () => { stopScanner() }, [])
  useEffect(() => { if (tab !== "scan") stopScanner() }, [tab])

  async function lookupBarcode(upc: string) {
    setLookingUp(true)
    setLookupMsg("Looking up barcode…")
    setBarcodeInput(upc)
    try {
      const res = await fetch(`/api/nutrition/barcode?upc=${encodeURIComponent(upc)}`)
      const data: BarcodeResult = await res.json()
      if (data.found && data.name) {
        setName(data.name)
        setCalories(String(data.caloriesPer ?? ""))
        setProtein(String(data.proteinGPer  ?? ""))
        setCarbs(String(data.carbsGPer      ?? ""))
        setFat(String(data.fatGPer          ?? ""))
        setUnit(data.unit ?? "serving")
        setLookupMsg(`Found: ${data.name}`)
      } else {
        setLookupMsg("Product not found. Fill in manually.")
      }
      setTab("manual")
    } catch {
      setLookupMsg("Lookup failed. Fill in manually.")
      setTab("manual")
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError("")
    try {
      const qty = Number(quantity) || 1
      const res = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, mealType,
          name:     name.trim(),
          calories: (Number(calories) || 0) * qty,
          proteinG: (Number(protein)  || 0) * qty,
          carbsG:   (Number(carbs)    || 0) * qty,
          fatG:     (Number(fat)      || 0) * qty,
          quantity: qty,
          unit,
          barcode:  barcodeInput || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save")
      const logged = await res.json()
      onAdded(logged)
      // Auto-save to library so it appears in "My Foods" next time
      saveToLibrary({
        name:        name.trim(),
        barcode:     barcodeInput || null,
        caloriesPer: Number(calories) || 0,
        proteinGPer: Number(protein)  || 0,
        carbsGPer:   Number(carbs)    || 0,
        fatGPer:     Number(fat)      || 0,
        unit,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const previewCals = Math.round((Number(calories) || 0) * (Number(quantity) || 1))
  const showPreview = !!(calories || protein || carbs || fat) && Number(quantity) > 0

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Add food to ${MEAL_LABEL[mealType]}`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative bg-white rounded-t-3xl px-4 pt-4 max-h-[90vh] flex flex-col"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" aria-hidden="true" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {(view === "existing" || (view === "new" && savedFoods.length > 0)) && (
              <button
                onClick={() => { setView("choose"); setSelectedFood(null); setExistingSearch("") }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100"
                aria-label="Back"
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
            )}
            <h2 className="text-base font-bold text-slate-900">
              <span aria-hidden="true">{MEAL_ICON[mealType]}</span>{" "}
              Add to {MEAL_LABEL[mealType]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* ── CHOOSE view ───────────────────────────────────────────────────────── */}
        {view === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setView("existing")}
              className="w-full flex items-center gap-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl px-4 py-4 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <BookOpen size={20} className="text-indigo-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">My Foods</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {savedFoods.length} saved item{savedFoods.length !== 1 ? "s" : ""}
                </p>
              </div>
              <ChevronRight size={16} className="text-slate-300 flex-shrink-0" aria-hidden="true" />
            </button>

            <button
              onClick={() => setView("new")}
              className="w-full flex items-center gap-4 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-2xl px-4 py-4 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Plus size={20} className="text-orange-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">New Food</p>
                <p className="text-xs text-slate-400 mt-0.5">Scan barcode or enter manually</p>
              </div>
            </button>
          </div>
        )}

        {/* ── EXISTING view ─────────────────────────────────────────────────────── */}
        {view === "existing" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search */}
            <div className="relative mb-3 flex-shrink-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search saved foods…"
                value={existingSearch}
                onChange={(e) => setExistingSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Search saved foods"
              />
            </div>

            {/* Food list */}
            <div className="flex-1 overflow-y-auto overscroll-contain space-y-1.5 min-h-0">
              {savedFoods
                .filter((f) => f.name.toLowerCase().includes(existingSearch.toLowerCase()))
                .map((food) => {
                  const isSelected = selectedFood?.id === food.id
                  return (
                    <div key={food.id} className={cn(
                      "rounded-2xl border transition-colors",
                      isSelected ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white"
                    )}>
                      <button
                        onClick={() => { setSelectedFood(isSelected ? null : food); setExistingQty("1") }}
                        className="w-full text-left px-4 py-3"
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{food.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {Math.round(food.caloriesPer)} kcal · P{Math.round(food.proteinGPer)}g ·{" "}
                              C{Math.round(food.carbsGPer)}g · F{Math.round(food.fatGPer)}g
                              {" · "}<span className="text-slate-300">per {food.unit}</span>
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteFromLibrary(food) }}
                            disabled={deletingFood === food.id}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-200 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0 mt-0.5"
                            aria-label={`Remove ${food.name} from My Foods`}
                          >
                            <Trash2 size={12} aria-hidden="true" />
                          </button>
                        </div>
                      </button>

                      {/* Inline quantity picker when selected */}
                      {isSelected && (
                        <div className="px-4 pb-3 space-y-3 border-t border-indigo-100 pt-3">
                          <div className="flex items-center gap-3">
                            <label htmlFor="existing-qty" className="text-xs font-medium text-slate-600 flex-shrink-0">
                              Quantity
                            </label>
                            <input
                              id="existing-qty"
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={existingQty}
                              onChange={(e) => setExistingQty(e.target.value)}
                              className="w-20 h-9 px-3 rounded-xl border border-indigo-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-500">{food.unit}</span>
                          </div>
                          {/* Preview */}
                          {Number(existingQty) > 0 && (
                            <p className="text-xs text-indigo-600 font-medium">
                              {Math.round(food.caloriesPer * (Number(existingQty) || 1))} kcal ·{" "}
                              P{Math.round(food.proteinGPer * (Number(existingQty) || 1))}g ·{" "}
                              C{Math.round(food.carbsGPer * (Number(existingQty) || 1))}g ·{" "}
                              F{Math.round(food.fatGPer * (Number(existingQty) || 1))}g
                            </p>
                          )}
                          <button
                            onClick={logExistingFood}
                            disabled={logginExisting || !existingQty || Number(existingQty) <= 0}
                            className="w-full h-10 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
                          >
                            {logginExisting ? "Adding…" : "Add to Log"}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

              {savedFoods.filter((f) => f.name.toLowerCase().includes(existingSearch.toLowerCase())).length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-400">No matching foods</p>
                  <button
                    onClick={() => setView("new")}
                    className="mt-2 text-sm text-indigo-600 font-medium"
                  >
                    Add a new food →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NEW view: scan + manual tabs ─────────────────────────────────────── */}
        {view === "new" && (<>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4" role="tablist">
          {(["scan", "manual"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 h-8 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              {t === "scan"
                ? <><Camera size={14} aria-hidden="true" /> Scan Barcode</>
                : <><Pencil size={14} aria-hidden="true" /> Manual</>}
            </button>
          ))}
        </div>

        {/* Scan tab */}
        {tab === "scan" && (
          <div role="tabpanel" aria-label="Scan barcode" className="flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto overscroll-contain">
            {lookupMsg && (
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700" role="status" aria-live="polite">
                {lookupMsg}
              </div>
            )}

            {!scanning && !lookingUp && (
              <button
                onClick={startScanner}
                className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Camera size={18} aria-hidden="true" /> Open Camera
              </button>
            )}

            {cameraError && (
              <p className="text-sm text-red-600 text-center" role="alert">{cameraError}</p>
            )}

            {scanning && (
              <div className="relative rounded-2xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  className="w-full"
                  autoPlay
                  playsInline
                  muted
                  aria-label="Camera viewfinder for barcode scanning"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                  <div className="w-52 h-32 border-2 border-white/70 rounded-xl" />
                </div>
                <button
                  onClick={stopScanner}
                  className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-black/50 flex items-center justify-center text-white"
                  aria-label="Stop camera"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            )}

            {lookingUp && (
              <p className="text-sm text-slate-400 text-center py-4" role="status" aria-live="polite">
                Looking up product…
              </p>
            )}

            <div>
              <label htmlFor="barcode-manual-input" className="text-xs font-medium text-slate-500 block mb-1">
                Or enter barcode manually
              </label>
              <div className="flex gap-2">
                <input
                  id="barcode-manual-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g. 012345678901"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  disabled={!barcodeInput.trim() || lookingUp}
                  onClick={() => lookupBarcode(barcodeInput.trim())}
                  className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
                >
                  Look up
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual tab */}
        {tab === "manual" && (
          <form
            role="tabpanel"
            aria-label="Manual food entry"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto overscroll-contain space-y-3 min-h-0"
          >
            {lookupMsg && (
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700" role="status" aria-live="polite">
                {lookupMsg}
              </div>
            )}

            <div>
              <label htmlFor="food-name" className="text-xs font-medium text-slate-600 block mb-1">
                Food name <span aria-hidden="true">*</span><span className="sr-only">(required)</span>
              </label>
              <input
                id="food-name"
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Greek Yogurt"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" id="per-serving-label">
              Per serving
            </p>
            <div className="grid grid-cols-2 gap-2" aria-describedby="per-serving-label">
              {([
                { id: "food-cal",     label: "Calories (kcal)", value: calories, set: setCalories },
                { id: "food-protein", label: "Protein (g)",     value: protein,  set: setProtein  },
                { id: "food-carbs",   label: "Carbs (g)",       value: carbs,    set: setCarbs    },
                { id: "food-fat",     label: "Fat (g)",         value: fat,      set: setFat      },
              ] as { id: string; label: string; value: string; set: (v: string) => void }[]).map(({ id, label, value, set }) => (
                <div key={id}>
                  <label htmlFor={id} className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
                  <input
                    id={id}
                    type="number"
                    min="0"
                    step="0.1"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="food-qty" className="text-xs font-medium text-slate-600 block mb-1">Quantity</label>
                <input
                  id="food-qty"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="food-unit" className="text-xs font-medium text-slate-600 block mb-1">Unit</label>
                <input
                  id="food-unit"
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="serving, cup, g…"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {showPreview && (
              <div
                className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5"
                aria-live="polite"
                aria-label={`Total: ${previewCals} calories`}
              >
                <p className="text-xs text-orange-700 font-medium">
                  Total for {quantity}× {unit}:&nbsp;
                  {previewCals} kcal ·{" "}
                  P{Math.round((Number(protein) || 0) * (Number(quantity) || 1))}g ·{" "}
                  C{Math.round((Number(carbs)   || 0) * (Number(quantity) || 1))}g ·{" "}
                  F{Math.round((Number(fat)     || 0) * (Number(quantity) || 1))}g
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full h-11 rounded-xl bg-orange-500 text-white font-semibold text-sm disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add to Log"}
            </button>
          </form>
        )}
        </>)}
      </div>
    </div>
  )
}
