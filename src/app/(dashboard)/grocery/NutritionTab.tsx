"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  ChevronLeft, ChevronRight, Plus, Minus, X, Trash2,
  Camera, Pencil, Flame, Scale, BookOpen, ArrowLeft, Search,
  Repeat, Check, TrendingUp, Star,
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
  isFavorite: boolean
}

// Sort favorites first, then most-recently-used (matches the server orderBy)
function sortFoods(foods: FoodItem[]): FoodItem[] {
  return [...foods].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite))
}

type Goals = {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  weightGoalLbs: number | null
}

type MealSection = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK"

// A per-unit food derived from history, used for one-tap quick-add
type QuickFood = {
  name: string
  unit: string
  caloriesPer: number
  proteinGPer: number
  carbsGPer: number
  fatGPer: number
  count: number
  lastDate: string
}

const MEAL_SECTIONS: MealSection[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]
const MEAL_LABEL: Record<MealSection, string> = {
  BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner", SNACK: "Snacks",
}
const MEAL_ICON: Record<MealSection, string> = {
  BREAKFAST: "☀️", LUNCH: "🌤️", DINNER: "🌙", SNACK: "🍎",
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" })
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
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" })
}

function weekdayLetter(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "narrow" })
}

// ─── Derivations from history ─────────────────────────────────────────────────

// Longest run of consecutive logged days ending today (or yesterday, so the
// streak isn't shown as "broken" before you've logged anything today).
function computeStreak(loggedDates: Set<string>, today: string): number {
  let cursor = today
  if (!loggedDates.has(cursor)) cursor = addDays(cursor, -1)
  let streak = 0
  while (loggedDates.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

// Most-logged foods for a given meal, with per-unit macros recovered from the
// stored totals (total ÷ quantity). Powers the one-tap quick-add chips.
function frequentFoodsForMeal(
  history: FoodEntry[],
  mealType: MealSection,
  exclude: Set<string>,
  limit = 4,
): QuickFood[] {
  const map = new Map<string, QuickFood>()
  for (const e of history) {
    if (e.mealType !== mealType) continue
    const key = e.name.toLowerCase()
    if (exclude.has(key)) continue
    const q = e.quantity || 1
    const existing = map.get(key)
    if (existing) {
      existing.count++
      if (e.date > existing.lastDate) {
        existing.lastDate    = e.date
        existing.name        = e.name
        existing.unit        = e.unit
        existing.caloriesPer = e.calories / q
        existing.proteinGPer = e.proteinG / q
        existing.carbsGPer   = e.carbsG / q
        existing.fatGPer     = e.fatG / q
      }
    } else {
      map.set(key, {
        name: e.name, unit: e.unit,
        caloriesPer: e.calories / q, proteinGPer: e.proteinG / q,
        carbsGPer: e.carbsG / q, fatGPer: e.fatG / q,
        count: 1, lastDate: e.date,
      })
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit)
}

// Recent days that have entries for this meal — the "repeat a meal" bundles.
type MealBundle = { date: string; items: FoodEntry[]; calories: number }
function recentMealBundles(
  history: FoodEntry[],
  mealType: MealSection,
  excludeDate: string,
  limit = 5,
): MealBundle[] {
  const byDate = new Map<string, FoodEntry[]>()
  for (const e of history) {
    if (e.mealType !== mealType || e.date === excludeDate) continue
    const arr = byDate.get(e.date) ?? []
    arr.push(e)
    byDate.set(e.date, arr)
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, limit)
    .map(([date, items]) => ({
      date, items,
      calories: Math.round(items.reduce((s, e) => s + e.calories, 0)),
    }))
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
  const met = goal ? value >= goal : false
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
          {met && <span className="text-green-500">✓ </span>}
          {Math.round(value)}{goal ? `/${goal}g` : "g"}
        </span>
      </span>
    </div>
  )
}

// ─── Sheet portal ─────────────────────────────────────────────────────────────
// Bottom sheets must render at document.body level, or a parent stacking context
// traps them behind the fixed BottomNav (z-50) and clips their bottom content.
// The base Modal component uses the same pattern. data-theme lives on <body>, so
// portaled children still inherit the active theme.

function SheetPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

// ─── Quantity stepper ─────────────────────────────────────────────────────────

function QtyStepper({
  value,
  onChange,
  id,
  accent = "slate",
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  accent?: "slate" | "indigo"
}) {
  const num = Number(value) || 0
  const bump = (delta: number) => {
    const next = Math.max(0.1, Math.round((num + delta) * 10) / 10)
    onChange(String(next))
  }
  const border = accent === "indigo" ? "border-indigo-200" : "border-slate-200"
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => bump(-0.5)}
        disabled={num <= 0.1}
        className={cn("w-9 h-9 rounded-xl border flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors", border)}
        aria-label="Decrease quantity by 0.5"
      >
        <Minus size={15} aria-hidden="true" />
      </button>
      <input
        id={id}
        type="number"
        min="0.1"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("w-16 h-9 px-2 rounded-xl border text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500", border)}
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={() => bump(0.5)}
        className={cn("w-9 h-9 rounded-xl border flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors", border)}
        aria-label="Increase quantity by 0.5"
      >
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

// ─── Calorie ring ─────────────────────────────────────────────────────────────

function CalorieRing({ consumed, goal }: { consumed: number; goal: number | null }) {
  const SIZE = 116
  const STROKE = 11
  const R = (SIZE - STROKE) / 2
  const C = 2 * Math.PI * R

  const pct = goal ? Math.min(consumed / goal, 1) : 0
  const remaining = goal ? Math.round(goal - consumed) : null
  const over = remaining !== null && remaining < 0
  const reached = remaining !== null && remaining <= 0

  // orange while filling, green at/under goal, red when over
  const ringColor = over ? "#ef4444" : reached ? "#22c55e" : "#fb923c"

  const bigText = goal
    ? over ? String(Math.abs(remaining!)) : String(remaining)
    : Math.round(consumed).toLocaleString()
  const smallText = goal ? (over ? "over" : "kcal left") : "kcal"

  return (
    <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#e2e8f0" strokeWidth={STROKE} />
        {goal && (
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none" stroke={ringColor} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            style={{ transition: "stroke-dashoffset .5s ease, stroke .3s ease" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{bigText}</span>
        <span className="text-[11px] text-slate-400 mt-0.5">{smallText}</span>
      </div>
      <span className="sr-only">
        {goal
          ? `${Math.round(consumed)} of ${goal} calories, ${over ? `${Math.abs(remaining!)} over` : `${remaining} remaining`}`
          : `${Math.round(consumed)} calories`}
      </span>
    </div>
  )
}

// ─── Weekly trend + streak card ───────────────────────────────────────────────

function WeekTrendCard({
  history,
  today,
  calorieGoal,
}: {
  history: FoodEntry[]
  today: string
  calorieGoal: number | null
}) {
  const loggedDates = useMemo(() => new Set(history.map((e) => e.date)), [history])
  const streak = computeStreak(loggedDates, today)

  // Last 7 days of calorie totals
  const days = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of history) totals.set(e.date, (totals.get(e.date) ?? 0) + e.calories)
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, -(6 - i))
      return { date: d, cals: Math.round(totals.get(d) ?? 0) }
    })
  }, [history, today])

  const maxCal = Math.max(...days.map((d) => d.cals), calorieGoal ?? 0, 1)
  const loggedCount = days.filter((d) => d.cals > 0).length

  return (
    <div className="bg-white rounded-2xl shadow-card-md px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-800">This week</h3>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
            streak > 0 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400",
          )}
          aria-label={streak > 0 ? `${streak} day logging streak` : "No active streak"}
        >
          <span aria-hidden="true">🔥</span>
          {streak > 0 ? `${streak}-day streak` : "Start a streak"}
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end justify-between gap-1.5 h-24" aria-hidden="true">
        {days.map((d) => {
          const h = maxCal ? (d.cals / maxCal) * 100 : 0
          const isToday = d.date === today
          const over = calorieGoal ? d.cals > calorieGoal : false
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="w-full flex-1 flex items-end">
                <div
                  className={cn(
                    "w-full rounded-md transition-all duration-500",
                    d.cals === 0
                      ? "bg-slate-100"
                      : over
                        ? "bg-red-400"
                        : isToday ? "bg-indigo-500" : "bg-orange-300",
                  )}
                  style={{ height: `${Math.max(h, d.cals > 0 ? 6 : 3)}%` }}
                />
              </div>
              <span className={cn("text-[10px]", isToday ? "text-indigo-600 font-semibold" : "text-slate-400")}>
                {weekdayLetter(d.date)}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Logged <span className="font-semibold text-slate-600">{loggedCount}/7</span> days this week
        {calorieGoal ? " · goal line varies by bar color" : ""}
      </p>
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
    <div className="bg-white rounded-2xl shadow-card-md px-4 py-4 space-y-3">
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
          <Link href="/profile" className="text-indigo-500 font-medium underline-offset-2 hover:underline">
            Profile
          </Link>
        </p>
      )}
    </div>
  )
}

// ─── Quick-add chips (one-tap re-log on a meal card) ──────────────────────────

function QuickAddChips({
  foods,
  onPick,
  busyName,
}: {
  foods: QuickFood[]
  onPick: (food: QuickFood) => void
  busyName: string | null
}) {
  if (foods.length === 0) return null
  return (
    <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain -mx-1 px-1 pb-0.5 pt-1 no-scrollbar">
      {foods.map((f) => {
        const busy = busyName === f.name
        return (
          <button
            key={f.name}
            onClick={() => onPick(f)}
            disabled={busy}
            className="flex items-center gap-1 flex-shrink-0 bg-slate-50 hover:bg-indigo-50 active:bg-indigo-100 border border-slate-200 hover:border-indigo-200 rounded-full pl-2.5 pr-3 py-1 transition-colors disabled:opacity-60"
            aria-label={`Quick add ${f.name}, ${Math.round(f.caloriesPer)} calories`}
          >
            {busy
              ? <Check size={13} className="text-green-500 flex-shrink-0" aria-hidden="true" />
              : <Plus size={13} className="text-indigo-500 flex-shrink-0" aria-hidden="true" />}
            <span className="text-xs font-medium text-slate-700 whitespace-nowrap max-w-[9rem] truncate">{f.name}</span>
            <span className="text-[10px] text-slate-400 whitespace-nowrap">{Math.round(f.caloriesPer)}</span>
          </button>
        )
      })}
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
  const [history, setHistory] = useState<FoodEntry[]>(initialLog)
  const [loading, setLoading] = useState(false)
  const [addingFor, setAddingFor] = useState<MealSection | null>(null)
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null)
  const [savedFoods, setSavedFoods] = useState<FoodItem[]>(initialFoods)
  const [quickBusy, setQuickBusy] = useState<string | null>(null)

  const isToday = date === todayStr()
  const windowStart = () => addDays(todayStr(), -29)

  function handleFoodSaved(food: FoodItem) {
    setSavedFoods((prev) => {
      const without = prev.filter((f) => f.id !== food.id)
      return sortFoods([food, ...without]) // recent at top, favorites floated up
    })
  }

  function handleFoodDeleted(id: string) {
    setSavedFoods((prev) => prev.filter((f) => f.id !== id))
  }

  // ── Local log/history mutation helpers (keep both stores in sync) ──
  const addLocal = useCallback((entries: FoodEntry[], viewedDate: string) => {
    const start = windowStart()
    setLog((prev) => [...prev, ...entries.filter((e) => e.date === viewedDate)])
    setHistory((prev) => [...prev, ...entries.filter((e) => e.date >= start)])
  }, [])

  const replaceLocal = useCallback((tempId: string, real: FoodEntry) => {
    const swap = (arr: FoodEntry[]) => arr.map((e) => (e.id === tempId ? real : e))
    setLog(swap)
    setHistory(swap)
  }, [])

  const removeLocal = useCallback((id: string) => {
    setLog((prev) => prev.filter((e) => e.id !== id))
    setHistory((prev) => prev.filter((e) => e.id !== id))
  }, [])

  // Load a 30-day history window once for streak / trend / repeat / quick-add
  useEffect(() => {
    const to = todayStr()
    const from = addDays(to, -29)
    fetch(`/api/nutrition/log?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: FoodEntry[]) => {
        setHistory((prev) => {
          const byId = new Map(rows.map((e) => [e.id, e]))
          // preserve any optimistic entries not yet reflected server-side
          for (const e of prev) if (!byId.has(e.id)) byId.set(e.id, e)
          return [...byId.values()]
        })
      })
      .catch(() => { /* streak/trend just stay based on today */ })
  }, [])

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
    else setLog((prev) => prev) // viewing today keeps the live log
  }, [date, loadDay])

  async function deleteEntry(id: string) {
    removeLocal(id)
    await fetch(`/api/nutrition/log/${id}`, { method: "DELETE" })
  }

  function onEntrySaved(updated: FoodEntry) {
    const swap = (arr: FoodEntry[]) => arr.map((e) => (e.id === updated.id ? updated : e))
    setLog(swap)
    setHistory(swap)
  }

  function onAdded(entry: FoodEntry) {
    addLocal([entry], date)
    setAddingFor(null)
  }

  function onAddedMany(entries: FoodEntry[]) {
    addLocal(entries, date)
    setAddingFor(null)
  }

  // Commit without closing the sheet — powers the fast one-tap "+" multi-add
  function onAddedStay(entries: FoodEntry[]) {
    addLocal(entries, date)
  }

  // One-tap quick-add from a meal card (optimistic)
  async function quickAdd(section: MealSection, food: QuickFood) {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimistic: FoodEntry = {
      id: tempId, date, mealType: section, name: food.name,
      calories: food.caloriesPer, proteinG: food.proteinGPer,
      carbsG: food.carbsGPer, fatG: food.fatGPer, quantity: 1, unit: food.unit,
    }
    addLocal([optimistic], date)
    setQuickBusy(food.name)
    try {
      const res = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, mealType: section, name: food.name,
          calories: food.caloriesPer, proteinG: food.proteinGPer,
          carbsG: food.carbsGPer, fatG: food.fatGPer, quantity: 1, unit: food.unit,
        }),
      })
      if (res.ok) replaceLocal(tempId, await res.json())
      else removeLocal(tempId)
    } catch {
      removeLocal(tempId)
    } finally {
      setTimeout(() => setQuickBusy((n) => (n === food.name ? null : n)), 900)
    }
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

  const calGoalReached = goals.calories ? totals.calories > 0 && totals.calories <= goals.calories : false

  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="bg-white rounded-2xl shadow-card-md px-4 py-3 flex items-center justify-between">
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

      {/* Daily summary card — calorie ring + macros */}
      <div className="bg-white rounded-2xl shadow-card-md px-4 py-4">
        <h2 className="sr-only">Daily nutrition summary</h2>
        <div className="flex items-center gap-4">
          <CalorieRing consumed={totals.calories} goal={goals.calories} />

          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Flame size={15} className="text-orange-500" aria-hidden="true" />
                {Math.round(totals.calories).toLocaleString()}
                {goals.calories && <span className="text-xs font-normal text-slate-400">/ {goals.calories.toLocaleString()}</span>}
              </span>
            </div>
            <MacroRow label="P" fullLabel="Protein" value={totals.protein} goal={goals.protein} barColor="bg-red-400" />
            <MacroRow label="C" fullLabel="Carbohydrates" value={totals.carbs} goal={goals.carbs} barColor="bg-yellow-400" />
            <MacroRow label="F" fullLabel="Fat" value={totals.fat} goal={goals.fat} barColor="bg-purple-400" />
          </div>
        </div>

        {calGoalReached && (
          <p className="mt-3 text-center text-xs font-semibold text-green-600" aria-live="polite">
            🎉 Calorie goal reached — nicely done!
          </p>
        )}

        {!goals.calories && !goals.protein && (
          <p className="text-xs text-slate-500 text-center pt-3">
            Set goals in your{" "}
            <Link href="/profile" className="text-indigo-600 font-medium underline-offset-2 hover:underline">
              Profile
            </Link>{" "}
            to see progress
          </p>
        )}
      </div>

      {/* Weekly streak + trend */}
      <WeekTrendCard history={history} today={todayStr()} calorieGoal={goals.calories} />

      {/* Weight tracking card */}
      <WeightCard
        weights={initialWeights}
        goalLbs={goals.weightGoalLbs}
        today={todayStr()}
      />

      {/* Meal sections */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-card-md p-8 text-center" aria-live="polite">
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      ) : (
        <div className="space-y-3" aria-live="polite" aria-label="Food log">
          {MEAL_SECTIONS.map((section) => {
            const items = log.filter((e) => e.mealType === section)
            const sectionCals = Math.round(items.reduce((s, e) => s + e.calories, 0))
            const loggedNames = new Set(items.map((e) => e.name.toLowerCase()))
            const quickFoods = isToday
              ? frequentFoodsForMeal(history, section, loggedNames)
              : []
            return (
              <section key={section} aria-label={MEAL_LABEL[section]} className="bg-white rounded-2xl shadow-card-md px-4 py-3">
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
                        <FoodEntryRow entry={entry} onDelete={deleteEntry} onEdit={setEditingEntry} />
                      </li>
                    ))}
                  </ul>
                )}

                {/* One-tap quick add of your frequent foods for this meal */}
                {quickFoods.length > 0 && (
                  <QuickAddChips
                    foods={quickFoods}
                    onPick={(f) => quickAdd(section, f)}
                    busyName={quickBusy}
                  />
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
          history={history}
          onAdded={onAdded}
          onAddedMany={onAddedMany}
          onAddedStay={onAddedStay}
          onFoodSaved={handleFoodSaved}
          onFoodDeleted={handleFoodDeleted}
          onClose={() => setAddingFor(null)}
        />
      )}

      {/* Edit logged entry sheet */}
      {editingEntry && (
        <EditEntrySheet
          entry={editingEntry}
          onSaved={onEntrySaved}
          onDeleted={deleteEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  )
}

// ─── FoodEntryRow ─────────────────────────────────────────────────────────────

function FoodEntryRow({
  entry,
  onDelete,
  onEdit,
}: {
  entry: FoodEntry
  onDelete: (id: string) => void
  onEdit: (entry: FoodEntry) => void
}) {
  return (
    <div className="flex items-center gap-2 min-h-[2.75rem]">
      <button
        onClick={() => onEdit(entry)}
        className="flex-1 min-w-0 self-center text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-slate-50 transition-colors"
        aria-label={`Edit ${entry.name}`}
      >
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
      </button>
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

// ─── EditEntrySheet — tap a logged item to change quantity / meal ─────────────

function EditEntrySheet({
  entry,
  onSaved,
  onDeleted,
  onClose,
}: {
  entry: FoodEntry
  onSaved: (updated: FoodEntry) => void
  onDeleted: (id: string) => void
  onClose: () => void
}) {
  const [qty, setQty] = useState(String(entry.quantity))
  const [mealType, setMealType] = useState<MealSection>(entry.mealType as MealSection)
  const [saving, setSaving] = useState(false)

  // entry macros are totals for entry.quantity — scale for the preview
  const ratio = (Number(qty) || entry.quantity) / (entry.quantity || 1)
  const scaled = (v: number) => Math.round(v * ratio)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/nutrition/log/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: Number(qty) || entry.quantity, mealType }),
      })
      if (res.ok) {
        onSaved(await res.json())
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetPortal>
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${entry.name}`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative bg-white rounded-t-3xl px-4 pt-4"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" aria-hidden="true" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 truncate pr-2">{entry.name}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Meal picker */}
        <p className="text-xs font-medium text-slate-600 mb-1.5">Meal</p>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {MEAL_SECTIONS.map((m) => (
            <button
              key={m}
              onClick={() => setMealType(m)}
              aria-pressed={mealType === m}
              className={cn(
                "h-11 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-colors",
                mealType === m ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500",
              )}
            >
              <span aria-hidden="true">{MEAL_ICON[m]}</span>
              {MEAL_LABEL[m]}
            </button>
          ))}
        </div>

        {/* Quantity */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-slate-600">Quantity</p>
            <p className="text-xs text-slate-400">{entry.unit}</p>
          </div>
          <QtyStepper value={qty} onChange={setQty} accent="indigo" />
        </div>

        {/* Preview */}
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 mb-4" aria-live="polite">
          <p className="text-xs text-slate-600 font-medium">
            {scaled(entry.calories)} kcal · P{scaled(entry.proteinG)}g · C{scaled(entry.carbsG)}g · F{scaled(entry.fatG)}g
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { onDeleted(entry.id); onClose() }}
            className="h-11 px-4 rounded-xl border border-slate-200 text-red-500 text-sm font-medium flex items-center gap-1.5"
            aria-label={`Remove ${entry.name}`}
          >
            <Trash2 size={15} aria-hidden="true" /> Remove
          </button>
          <button
            onClick={save}
            disabled={saving || !(Number(qty) > 0)}
            className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
    </SheetPortal>
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

type SheetView = "choose" | "existing" | "repeat" | "search" | "new"

type SearchResult = {
  fdcId: number
  name: string
  brand: string | null
  per100: { calories: number; protein: number; carbs: number; fat: number }
}

type SearchServing = {
  label: string
  unit: string
  caloriesPer: number
  proteinGPer: number
  carbsGPer: number
  fatGPer: number
}

function AddFoodSheet({
  date,
  mealType,
  savedFoods,
  history,
  onAdded,
  onAddedMany,
  onAddedStay,
  onFoodSaved,
  onFoodDeleted,
  onClose,
}: {
  date: string
  mealType: MealSection
  savedFoods: FoodItem[]
  history: FoodEntry[]
  onAdded: (entry: FoodEntry) => void
  onAddedMany: (entries: FoodEntry[]) => void
  onAddedStay: (entries: FoodEntry[]) => void
  onFoodSaved: (food: FoodItem) => void
  onFoodDeleted: (id: string) => void
  onClose: () => void
}) {
  const bundles = useMemo(
    () => recentMealBundles(history, mealType, date),
    [history, mealType, date],
  )
  // Search + New Food are always offered, so the chooser is always the entry point
  const [view, setView] = useState<SheetView>("choose")
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
  const [quickAddedId,   setQuickAddedId]   = useState<string | null>(null)
  const [favBusy,        setFavBusy]        = useState<string | null>(null)

  // Inline "edit saved food" form state
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null)
  const [editName,    setEditName]    = useState("")
  const [editCal,     setEditCal]     = useState("")
  const [editProtein, setEditProtein] = useState("")
  const [editCarbs,   setEditCarbs]   = useState("")
  const [editFat,     setEditFat]     = useState("")
  const [editUnit,    setEditUnit]    = useState("serving")
  const [savingEdit,  setSavingEdit]  = useState(false)

  // "Repeat" view state
  const [copyingDate, setCopyingDate] = useState<string | null>(null)

  // "Search" view state (USDA FoodData Central)
  const [searchQuery,     setSearchQuery]     = useState("")
  const [searchResults,   setSearchResults]   = useState<SearchResult[]>([])
  const [searching,       setSearching]       = useState(false)
  const [searchError,     setSearchError]     = useState("")
  const [openResultId,    setOpenResultId]    = useState<number | null>(null)
  const [servings,        setServings]        = useState<SearchServing[] | null>(null)
  const [loadingServings, setLoadingServings] = useState(false)

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

  async function toggleFavorite(food: FoodItem) {
    setFavBusy(food.id)
    try {
      const res = await fetch(`/api/nutrition/foods/${food.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !food.isFavorite }),
      })
      if (res.ok) onFoodSaved(await res.json())
    } finally {
      setFavBusy(null)
    }
  }

  function startEditFood(food: FoodItem) {
    setEditingFoodId(food.id)
    setEditName(food.name)
    setEditCal(String(food.caloriesPer))
    setEditProtein(String(food.proteinGPer))
    setEditCarbs(String(food.carbsGPer))
    setEditFat(String(food.fatGPer))
    setEditUnit(food.unit)
  }

  async function saveEditedFood(food: FoodItem) {
    if (!editName.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/nutrition/foods/${food.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        editName.trim(),
          caloriesPer: Number(editCal)     || 0,
          proteinGPer: Number(editProtein) || 0,
          carbsGPer:   Number(editCarbs)   || 0,
          fatGPer:     Number(editFat)     || 0,
          unit:        editUnit.trim() || "serving",
        }),
      })
      if (res.ok) {
        onFoodSaved(await res.json())
        setEditingFoodId(null)
      }
    } finally {
      setSavingEdit(false)
    }
  }

  // Log a saved food; keepOpen=true powers the fast one-tap "+" (multi-add)
  async function logSavedFood(food: FoodItem, qty: number, keepOpen: boolean) {
    const res = await fetch("/api/nutrition/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date, mealType,
        name:     food.name,
        calories: food.caloriesPer * qty,
        proteinG: food.proteinGPer * qty,
        carbsG:   food.carbsGPer   * qty,
        fatG:     food.fatGPer     * qty,
        quantity: qty,
        unit:     food.unit,
        barcode:  food.barcode,
      }),
    })
    if (!res.ok) throw new Error("Failed to log")
    const entry: FoodEntry = await res.json()
    if (keepOpen) onAddedStay([entry])
    else onAdded(entry)
    // Bump lastUsedAt on the saved food
    fetch(`/api/nutrition/foods/${food.id}`, { method: "PATCH" })
      .then((r) => (r.ok ? r.json() : null))
      .then((updated) => { if (updated) onFoodSaved(updated) })
  }

  async function logExistingFood() {
    if (!selectedFood) return
    setLoggingExisting(true)
    try {
      await logSavedFood(selectedFood, Number(existingQty) || 1, false)
    } finally {
      setLoggingExisting(false)
    }
  }

  // Fast one-tap add of qty 1, sheet stays open so a whole meal is quick to build
  async function quickAddSaved(food: FoodItem) {
    setQuickAddedId(food.id)
    try {
      await logSavedFood(food, 1, true)
    } catch { /* ignore */ } finally {
      setTimeout(() => setQuickAddedId((id) => (id === food.id ? null : id)), 900)
    }
  }

  async function repeatBundle(bundle: MealBundle) {
    setCopyingDate(bundle.date)
    try {
      const res = await fetch("/api/nutrition/log/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDate: bundle.date,
          targetDate: date,
          mealType,
          targetMealType: mealType,
        }),
      })
      if (res.ok) onAddedMany(await res.json())
    } finally {
      setCopyingDate(null)
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

  // Debounced food-database search
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) { setSearchResults([]); setSearchError(""); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setSearching(true); setSearchError("")
      try {
        const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        const data = await res.json()
        setSearchResults(data.results ?? [])
        if (data.error === "rate-limited") setSearchError("Search is busy — try again in a moment.")
        else if (data.error) setSearchError("Couldn't reach the food database.")
        else if ((data.results ?? []).length === 0) setSearchError("")
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setSearchError("Search failed. Check your connection.")
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [searchQuery])

  async function openResult(result: SearchResult) {
    if (openResultId === result.fdcId) { setOpenResultId(null); return }
    setOpenResultId(result.fdcId)
    setServings(null)
    setLoadingServings(true)
    try {
      const res = await fetch(`/api/nutrition/search/detail?fdcId=${result.fdcId}`)
      const data = await res.json()
      setServings(data.servings ?? [])
    } catch {
      setServings([])
    } finally {
      setLoadingServings(false)
    }
  }

  // Prefill the manual form from a chosen search result + serving, then let the
  // user review and hit "Add to Log" (which also saves it to My Foods).
  function useServing(result: SearchResult, serving: SearchServing) {
    setName(result.brand ? `${result.name} (${result.brand})` : result.name)
    setCalories(String(serving.caloriesPer))
    setProtein(String(serving.proteinGPer))
    setCarbs(String(serving.carbsGPer))
    setFat(String(serving.fatGPer))
    setQuantity("1")
    setUnit(serving.unit)
    setBarcodeInput("")
    setLookupMsg("")
    setView("new")
    setTab("manual")
  }

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

  const filteredFoods = savedFoods.filter((f) =>
    f.name.toLowerCase().includes(existingSearch.toLowerCase()),
  )

  return (
    <SheetPortal>
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Add food to ${MEAL_LABEL[mealType]}`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative bg-white rounded-t-3xl px-4 pt-4 max-h-[85dvh] overflow-hidden flex flex-col"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" aria-hidden="true" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {view !== "choose" && (
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
              onClick={() => setView("search")}
              className="w-full flex items-center gap-4 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-2xl px-4 py-4 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                <Search size={20} className="text-sky-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">Search foods</p>
                <p className="text-xs text-slate-400 mt-0.5">Fast food, brands &amp; everyday foods</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 flex-shrink-0" aria-hidden="true" />
            </button>

            {bundles.length > 0 && (
              <button
                onClick={() => setView("repeat")}
                className="w-full flex items-center gap-4 bg-slate-50 hover:bg-green-50 border border-slate-200 hover:border-green-300 rounded-2xl px-4 py-4 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Repeat size={20} className="text-green-600" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Repeat a meal</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Copy a recent {MEAL_LABEL[mealType].toLowerCase()} in one tap
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" aria-hidden="true" />
              </button>
            )}

            {savedFoods.length > 0 && (
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
                    {savedFoods.length} saved item{savedFoods.length !== 1 ? "s" : ""} · tap ＋ to add fast
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" aria-hidden="true" />
              </button>
            )}

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

        {/* ── REPEAT view ───────────────────────────────────────────────────────── */}
        {view === "repeat" && (
          <div className="flex-1 flex flex-col min-h-0">
            <p className="text-xs text-slate-500 mb-3 flex-shrink-0">
              Tap a day to copy its {MEAL_LABEL[mealType].toLowerCase()} into {formatDateLabel(date).toLowerCase()}.
            </p>
            <div className="flex-1 overflow-y-auto overscroll-contain space-y-2 min-h-0">
              {bundles.map((b) => (
                <button
                  key={b.date}
                  onClick={() => repeatBundle(b)}
                  disabled={copyingDate === b.date}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white hover:border-green-300 hover:bg-green-50 transition-colors px-4 py-3 disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{formatDateLabel(b.date)}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {b.items.length} item{b.items.length !== 1 ? "s" : ""} ·{" "}
                        {b.items.map((i) => i.name).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-slate-500">{b.calories} kcal</span>
                      {copyingDate === b.date
                        ? <Check size={16} className="text-green-500" aria-hidden="true" />
                        : <Repeat size={15} className="text-green-500" aria-hidden="true" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SEARCH view (USDA food database) ──────────────────────────────────── */}
        {view === "search" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="relative mb-3 flex-shrink-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                autoFocus
                enterKeyHint="search"
                placeholder="Search fast food &amp; foods…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Search the food database"
              />
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain space-y-1.5 min-h-0" aria-live="polite">
              {searching && (
                <p className="text-sm text-slate-400 text-center py-6" role="status">Searching…</p>
              )}
              {!searching && searchError && (
                <p className="text-sm text-slate-500 text-center py-6">{searchError}</p>
              )}
              {!searching && !searchError && searchQuery.trim().length < 2 && (
                <p className="text-xs text-slate-400 text-center py-8 px-6">
                  Type a food name — e.g. “big mac”, “chipotle bowl”, or “banana”.
                </p>
              )}
              {!searching && !searchError && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400">No matches</p>
                  <button onClick={() => setView("new")} className="mt-2 text-sm text-indigo-600 font-medium">
                    Add it manually →
                  </button>
                </div>
              )}

              {searchResults.map((r) => {
                const open = openResultId === r.fdcId
                return (
                  <div key={r.fdcId} className={cn(
                    "rounded-2xl border transition-colors",
                    open ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white",
                  )}>
                    <button
                      onClick={() => openResult(r)}
                      className="w-full text-left px-4 py-3"
                      aria-expanded={open}
                    >
                      <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {r.brand ? `${r.brand} · ` : ""}{r.per100.calories} kcal / 100g
                      </p>
                    </button>

                    {open && (
                      <div className="px-4 pb-3 border-t border-sky-100 pt-3">
                        {loadingServings ? (
                          <p className="text-xs text-slate-400 py-1">Loading portions…</p>
                        ) : servings && servings.length > 0 ? (
                          <>
                            <p className="text-xs font-medium text-slate-500 mb-2">Choose a portion</p>
                            <div className="space-y-1.5">
                              {servings.map((s, i) => (
                                <button
                                  key={i}
                                  onClick={() => useServing(r, s)}
                                  className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50 px-3 py-2 text-left transition-colors"
                                >
                                  <span className="text-sm text-slate-800 truncate">{s.label}</span>
                                  <span className="text-xs font-semibold text-slate-500 flex-shrink-0">{s.caloriesPer} kcal</span>
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => useServing(r, {
                              label: "100 g", unit: "100 g",
                              caloriesPer: r.per100.calories, proteinGPer: r.per100.protein,
                              carbsGPer: r.per100.carbs, fatGPer: r.per100.fat,
                            })}
                            className="text-xs text-sky-600 font-medium py-1"
                          >
                            Use per-100g values →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-[10px] text-slate-300 text-center pt-2 flex-shrink-0">
              Powered by USDA FoodData Central
            </p>
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
              {filteredFoods.map((food) => {
                const isSelected = selectedFood?.id === food.id
                const justAdded = quickAddedId === food.id
                const isEditing = editingFoodId === food.id
                return (
                  <div key={food.id} className={cn(
                    "rounded-2xl border transition-colors",
                    isSelected ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white"
                  )}>
                    <div className="flex items-center gap-0.5 pr-2">
                      <button
                        onClick={() => { setSelectedFood(isSelected ? null : food); setExistingQty("1"); setEditingFoodId(null) }}
                        className="flex-1 min-w-0 text-left px-4 py-3"
                        aria-pressed={isSelected}
                        aria-expanded={isSelected}
                      >
                        <p className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                          {food.isFavorite && <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" aria-hidden="true" />}
                          <span className="truncate">{food.name}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {Math.round(food.caloriesPer)} kcal · P{Math.round(food.proteinGPer)}g ·{" "}
                          C{Math.round(food.carbsGPer)}g · F{Math.round(food.fatGPer)}g
                          {" · "}<span className="text-slate-300">per {food.unit}</span>
                        </p>
                      </button>
                      {/* Favorite toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(food) }}
                        disabled={favBusy === food.id}
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                          food.isFavorite ? "text-amber-400" : "text-slate-300 hover:text-amber-400 hover:bg-amber-50",
                        )}
                        aria-label={food.isFavorite ? `Unfavorite ${food.name}` : `Favorite ${food.name}`}
                        aria-pressed={food.isFavorite}
                      >
                        <Star size={16} className={food.isFavorite ? "fill-amber-400" : ""} aria-hidden="true" />
                      </button>
                      {/* Fast one-tap add (qty 1) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); quickAddSaved(food) }}
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                          justAdded ? "bg-green-100 text-green-600" : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200",
                        )}
                        aria-label={justAdded ? `${food.name} added` : `Quick add ${food.name}`}
                      >
                        {justAdded ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                      </button>
                    </div>

                    {/* Inline EDIT form */}
                    {isEditing ? (
                      <div className="px-4 pb-3 space-y-2 border-t border-slate-100 pt-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Food name"
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          aria-label="Food name"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { ph: "Calories", value: editCal,     set: setEditCal },
                            { ph: "Protein g", value: editProtein, set: setEditProtein },
                            { ph: "Carbs g",   value: editCarbs,   set: setEditCarbs },
                            { ph: "Fat g",     value: editFat,     set: setEditFat },
                          ] as { ph: string; value: string; set: (v: string) => void }[]).map(({ ph, value, set }) => (
                            <input
                              key={ph}
                              type="number" min="0" step="0.1"
                              value={value}
                              onChange={(e) => set(e.target.value)}
                              placeholder={ph}
                              className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              aria-label={ph}
                            />
                          ))}
                        </div>
                        <input
                          type="text"
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          placeholder="Unit (serving, cup…)"
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          aria-label="Unit"
                        />
                        <div className="flex gap-2 pt-0.5">
                          <button
                            onClick={() => setEditingFoodId(null)}
                            className="flex-1 h-9 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEditedFood(food)}
                            disabled={savingEdit || !editName.trim()}
                            className="flex-1 h-9 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : isSelected && (
                      <div className="px-4 pb-3 space-y-3 border-t border-indigo-100 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                            Quantity <span className="text-slate-400">({food.unit})</span>
                          </span>
                          <QtyStepper value={existingQty} onChange={setExistingQty} accent="indigo" />
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
                        <div className="flex items-center justify-between pt-0.5">
                          <button
                            onClick={() => startEditFood(food)}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                          >
                            <Pencil size={13} aria-hidden="true" /> Edit details
                          </button>
                          <button
                            onClick={() => deleteFromLibrary(food)}
                            disabled={deletingFood === food.id}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-500 disabled:opacity-50"
                          >
                            <Trash2 size={13} aria-hidden="true" /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {filteredFoods.length === 0 && (
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
        {view === "new" && (
        <div className="flex-1 flex flex-col min-h-0">

        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4 flex-shrink-0" role="tablist">
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
            className="flex-1 flex flex-col min-h-0"
          >
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-3 min-h-0 pb-3">
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
                <QtyStepper id="food-qty" value={quantity} onChange={setQuantity} />
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

          </div>

            {/* Pinned footer — stays visible while the form body scrolls */}
            <div className="flex-shrink-0 pt-2 space-y-2">
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="w-full h-11 rounded-xl bg-orange-500 text-white font-semibold text-sm disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add to Log"}
              </button>
            </div>
          </form>
        )}
        </div>
        )}
      </div>
    </div>
    </SheetPortal>
  )
}
