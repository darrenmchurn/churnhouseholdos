"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2,
  Camera, Pencil, Flame,
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

type Goals = {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
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

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const isToday = dateStr === todayStr()
  if (isToday) return "Today"
  const yesterday = addDays(todayStr(), -1)
  if (dateStr === yesterday) return "Yesterday"
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function MacroBar({
  label, value, goal, color, unit = "g",
}: {
  label: string; value: number; goal: number | null; color: string; unit?: string
}) {
  const pct = goal ? Math.min((value / goal) * 100, 100) : 0
  const over = goal ? value > goal : false
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-6 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
        {goal ? (
          <div
            className={cn("h-1.5 rounded-full transition-all", over ? "bg-red-400" : color)}
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className={cn("h-1.5 rounded-full w-full opacity-30", color)} />
        )}
      </div>
      <span className="text-xs text-slate-500 flex-shrink-0 text-right w-16">
        {Math.round(value)}{goal ? `/${goal}` : ""}{unit}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NutritionTab({
  initialLog,
  goals,
}: {
  initialLog: FoodEntry[]
  goals: Goals
}) {
  const [date, setDate] = useState(todayStr)
  const [log, setLog] = useState<FoodEntry[]>(initialLog)
  const [loading, setLoading] = useState(false)
  const [addingFor, setAddingFor] = useState<MealSection | null>(null)

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

  // Totals
  const totals = log.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein:  acc.protein  + e.proteinG,
      carbs:    acc.carbs    + e.carbsG,
      fat:      acc.fat      + e.fatG,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const calPct = goals.calories ? Math.min((totals.calories / goals.calories) * 100, 100) : 0
  const calOver = goals.calories ? totals.calories > goals.calories : false

  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setDate((d) => addDays(d, -1))}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-semibold text-slate-900">{formatDate(date)}</p>
        <button
          onClick={() => setDate((d) => addDays(d, 1))}
          disabled={isToday}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Daily summary card */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 space-y-3">
        {/* Calorie row */}
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", calOver ? "bg-red-100" : "bg-orange-50")}>
            <Flame size={18} className={calOver ? "text-red-500" : "text-orange-500"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-semibold text-slate-900">
                {Math.round(totals.calories).toLocaleString()} kcal
              </span>
              {goals.calories && (
                <span className="text-xs text-slate-400">
                  / {goals.calories.toLocaleString()} goal
                </span>
              )}
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              {goals.calories ? (
                <div
                  className={cn("h-2.5 rounded-full transition-all", calOver ? "bg-red-400" : "bg-orange-400")}
                  style={{ width: `${calPct}%` }}
                />
              ) : (
                <div className="h-2.5 rounded-full w-full bg-orange-200" />
              )}
            </div>
          </div>
        </div>

        {/* Macro bars */}
        <div className="space-y-2 pt-1">
          <MacroBar label="P" value={totals.protein} goal={goals.protein} color="bg-red-400" />
          <MacroBar label="C" value={totals.carbs}   goal={goals.carbs}   color="bg-yellow-400" />
          <MacroBar label="F" value={totals.fat}     goal={goals.fat}     color="bg-purple-400" />
        </div>

        {!goals.calories && !goals.protein && (
          <p className="text-xs text-slate-400 text-center pt-1">
            Set goals in your <a href="/profile" className="text-indigo-500 font-medium">Profile</a> to see progress bars
          </p>
        )}
      </div>

      {/* Meal sections */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {MEAL_SECTIONS.map((section) => {
            const items = log.filter((e) => e.mealType === section)
            const sectionCals = Math.round(items.reduce((s, e) => s + e.calories, 0))
            return (
              <div key={section} className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{MEAL_ICON[section]}</span>
                    <span className="text-sm font-semibold text-slate-800">{MEAL_LABEL[section]}</span>
                    {sectionCals > 0 && (
                      <span className="text-xs text-slate-400">{sectionCals} kcal</span>
                    )}
                  </div>
                  <button
                    onClick={() => setAddingFor(section)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-300 pb-0.5">Nothing logged yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((entry) => (
                      <FoodEntryRow key={entry.id} entry={entry} onDelete={deleteEntry} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Food sheet */}
      {addingFor && (
        <AddFoodSheet
          date={date}
          mealType={addingFor}
          onAdded={onAdded}
          onClose={() => setAddingFor(null)}
        />
      )}
    </div>
  )
}

// ─── FoodEntryRow ─────────────────────────────────────────────────────────────

function FoodEntryRow({ entry, onDelete }: { entry: FoodEntry; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 min-h-[2.5rem]">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 truncate">{entry.name}</p>
        <p className="text-xs text-slate-400">
          {Math.round(entry.calories)} kcal · P{Math.round(entry.proteinG)}g · C{Math.round(entry.carbsG)}g · F{Math.round(entry.fatG)}g
          {entry.quantity !== 1 && ` · ${entry.quantity}×`}
        </p>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
      >
        <Trash2 size={13} />
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

function AddFoodSheet({
  date,
  mealType,
  onAdded,
  onClose,
}: {
  date: string
  mealType: MealSection
  onAdded: (entry: FoodEntry) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<"scan" | "manual">("scan")

  // Manual form state
  const [name, setName]         = useState("")
  const [calories, setCalories] = useState("")
  const [protein,  setProtein]  = useState("")
  const [carbs,    setCarbs]    = useState("")
  const [fat,      setFat]      = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unit,     setUnit]     = useState("serving")
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState("")

  // Barcode scanner state
  const [scanning,      setScanning]      = useState(false)
  const [barcodeInput,  setBarcodeInput]  = useState("")
  const [lookingUp,     setLookingUp]     = useState(false)
  const [lookupMsg,     setLookupMsg]     = useState("")
  const [cameraError,   setCameraError]   = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  // Start camera scanner
  async function startScanner() {
    setCameraError("")
    setScanning(true)
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      const reader = new BrowserMultiFormatReader()
      const controls = await reader.decodeFromVideoDevice(
        undefined, // auto-select rear camera
        videoRef.current!,
        async (result, err) => {
          if (result) {
            stopScanner()
            await lookupBarcode(result.getText())
          }
          if (err && !(err instanceof Error && err.message?.includes("No MultiFormat Readers"))) {
            // Ignore "no barcode found in frame" — fires continuously while scanning
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
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }
    setScanning(false)
  }

  // Clean up on unmount or tab switch
  useEffect(() => {
    return () => { stopScanner() }
  }, [])

  useEffect(() => {
    if (tab !== "scan") stopScanner()
  }, [tab])

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
        setProtein(String(data.proteinGPer ?? ""))
        setCarbs(String(data.carbsGPer ?? ""))
        setFat(String(data.fatGPer ?? ""))
        setUnit(data.unit ?? "serving")
        setLookupMsg(`Found: ${data.name}`)
        setTab("manual")
      } else {
        setLookupMsg("Product not found in database. Fill in manually.")
        setTab("manual")
      }
    } catch {
      setLookupMsg("Lookup failed. Fill in manually.")
      setTab("manual")
    } finally {
      setLookingUp(false)
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError("")
    try {
      const qty = Number(quantity) || 1
      const payload = {
        date,
        mealType,
        name: name.trim(),
        calories: (Number(calories) || 0) * qty,
        proteinG: (Number(protein)  || 0) * qty,
        carbsG:   (Number(carbs)    || 0) * qty,
        fatG:     (Number(fat)      || 0) * qty,
        quantity: qty,
        unit,
        barcode: barcodeInput || null,
      }
      const res = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to save")
      }
      onAdded(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-3xl px-4 pt-4 max-h-[90vh] flex flex-col"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-base font-bold text-slate-900">
              {MEAL_ICON[mealType]} Add to {MEAL_LABEL[mealType]}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setTab("scan")}
            className={cn("flex-1 h-8 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
              tab === "scan" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
          >
            <Camera size={14} /> Scan Barcode
          </button>
          <button
            onClick={() => setTab("manual")}
            className={cn("flex-1 h-8 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
              tab === "manual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
          >
            <Pencil size={14} /> Manual
          </button>
        </div>

        {/* Scan tab */}
        {tab === "scan" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto overscroll-contain">
            {lookupMsg && (
              <div className="bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-600">{lookupMsg}</div>
            )}

            {!scanning && !lookingUp && (
              <button
                onClick={startScanner}
                className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Camera size={18} /> Open Camera
              </button>
            )}

            {cameraError && (
              <p className="text-xs text-red-500 text-center">{cameraError}</p>
            )}

            {/* Camera viewfinder */}
            {scanning && (
              <div className="relative rounded-2xl overflow-hidden bg-black">
                <video ref={videoRef} className="w-full" autoPlay playsInline muted />
                {/* Scan overlay guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-52 h-32 border-2 border-white/70 rounded-xl" />
                </div>
                <button
                  onClick={stopScanner}
                  className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-black/50 flex items-center justify-center text-white"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {lookingUp && (
              <p className="text-sm text-slate-400 text-center py-4">Looking up product…</p>
            )}

            {/* Manual barcode input */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Or enter barcode manually</label>
              <div className="flex gap-2">
                <input
                  type="number"
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

        {/* Manual entry tab */}
        {tab === "manual" && (
          <form onSubmit={handleManualSubmit} className="flex-1 overflow-y-auto overscroll-contain space-y-3 min-h-0">
            {lookupMsg && (
              <div className="bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-600">{lookupMsg}</div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Food name *</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Greek Yogurt"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Per-serving nutrition */}
            <p className="text-xs font-medium text-slate-500">Per serving</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { label: "Calories (kcal)", value: calories, set: setCalories, placeholder: "0" },
                { label: "Protein (g)",     value: protein,  set: setProtein,  placeholder: "0" },
                { label: "Carbs (g)",       value: carbs,    set: setCarbs,    placeholder: "0" },
                { label: "Fat (g)",         value: fat,      set: setFat,      placeholder: "0" },
              ] as { label: string; value: string; set: (v: string) => void; placeholder: string }[]).map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>

            {/* Quantity + unit */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="serving, cup, g…"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Preview */}
            {(calories || protein || carbs || fat) && Number(quantity) > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-xs text-orange-700">
                Total: {Math.round((Number(calories) || 0) * Number(quantity))} kcal ·{" "}
                P{Math.round((Number(protein) || 0) * Number(quantity))}g ·{" "}
                C{Math.round((Number(carbs)   || 0) * Number(quantity))}g ·{" "}
                F{Math.round((Number(fat)     || 0) * Number(quantity))}g
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full h-11 rounded-xl bg-orange-500 text-white font-semibold text-sm disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add to Log"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
