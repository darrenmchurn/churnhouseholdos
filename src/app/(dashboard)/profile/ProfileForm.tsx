"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn, avatarTextColor, AVATAR_COLORS } from "@/lib/utils"
import { Check, Eye, EyeOff, Flame } from "lucide-react"

type Theme = {
  id: string
  name: string
  description: string
  bg: string
  card: string
  border: string
  accent: string
  text: string
  subtext: string
}

const THEMES: Theme[] = [
  {
    id: "default",
    name: "Default",
    description: "Clean & balanced. Works for everyone.",
    bg: "#f8fafc", card: "#ffffff", border: "#e2e8f0",
    accent: "#6366f1", text: "#0f172a", subtext: "#64748b",
  },
  {
    id: "kids",
    name: "Kids",
    description: "Bigger text, rounder corners, emoji nav.",
    bg: "#f8fafc", card: "#ffffff", border: "#e2e8f0",
    accent: "#6366f1", text: "#0f172a", subtext: "#64748b",
  },
  {
    id: "compact",
    name: "Compact",
    description: "Tighter layout — more info at a glance.",
    bg: "#f8fafc", card: "#ffffff", border: "#e2e8f0",
    accent: "#6366f1", text: "#0f172a", subtext: "#64748b",
  },
  {
    id: "dark",
    name: "Dark",
    description: "Black base with neon cyan accents.",
    bg: "#09090b", card: "#18181b", border: "#3f3f46",
    accent: "#22d3ee", text: "#fafafa", subtext: "#a1a1aa",
  },
  {
    id: "classy",
    name: "Classy",
    description: "Warm cream with elegant pink accents.",
    bg: "#faf7f2", card: "#fffcf7", border: "#e8d9c8",
    accent: "#db2777", text: "#1c1917", subtext: "#78716c",
  },
]

const THEME_ICONS: Record<string, string> = {
  default: "⚡",
  kids:    "🎈",
  compact: "📐",
  dark:    "🌙",
  classy:  "✨",
}

function ThemePreview({ t, selected, onClick }: { t: Theme; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative text-left rounded-2xl border-2 p-3 transition-all",
        selected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200 hover:border-slate-300"
      )}
    >
      {/* Mini preview */}
      <div
        className="rounded-xl p-2 mb-2 space-y-1.5"
        style={{ backgroundColor: t.bg }}
      >
        {/* Mini card */}
        <div
          className="rounded-lg px-2 py-1.5 flex items-center gap-1.5"
          style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
        >
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.accent }} />
          <div className="flex-1 space-y-0.5">
            <div className="h-1.5 rounded-full w-3/4" style={{ backgroundColor: t.text, opacity: 0.8 }} />
            <div className="h-1 rounded-full w-1/2" style={{ backgroundColor: t.subtext, opacity: 0.6 }} />
          </div>
        </div>
        {/* Mini nav */}
        <div
          className="rounded-lg px-2 py-1 flex justify-around"
          style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
        >
          {[t.accent, t.subtext, t.subtext, t.subtext].map((c, i) => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c, opacity: i === 0 ? 1 : 0.4 }} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-base">{THEME_ICONS[t.id]}</span>
        <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
        {selected && (
          <span className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
            <Check size={11} strokeWidth={3} className="text-white" />
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 leading-snug">{t.description}</p>
    </button>
  )
}

type Goals = { calories: number | null; protein: number | null; carbs: number | null; fat: number | null }

type Props = {
  initialName: string
  initialAvatarColor: string
  initialTheme: string
  initialGoals: Goals
}

export function ProfileForm({ initialName, initialAvatarColor, initialTheme, initialGoals }: Props) {
  const router = useRouter()

  // Profile section
  const [name, setName] = useState(initialName)
  const [avatarColor, setAvatarColor] = useState(initialAvatarColor)
  const [theme, setTheme] = useState(initialTheme)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Nutrition goals section
  const [goalCalories, setGoalCalories] = useState(String(initialGoals.calories ?? ""))
  const [goalProtein,  setGoalProtein]  = useState(String(initialGoals.protein  ?? ""))
  const [goalCarbs,    setGoalCarbs]    = useState(String(initialGoals.carbs    ?? ""))
  const [goalFat,      setGoalFat]      = useState(String(initialGoals.fat      ?? ""))
  const [savingGoals, setSavingGoals]   = useState(false)
  const [goalsMsg, setGoalsMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  // Password section
  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarColor, theme }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      setProfileMsg({ ok: true, text: "Saved! Changes apply on next page load." })
      router.refresh()
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" })
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveGoals(e: React.FormEvent) {
    e.preventDefault()
    setSavingGoals(true)
    setGoalsMsg(null)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyCalorieGoal: goalCalories ? Number(goalCalories) : null,
          dailyProteinGoal: goalProtein  ? Number(goalProtein)  : null,
          dailyCarbsGoal:   goalCarbs    ? Number(goalCarbs)    : null,
          dailyFatGoal:     goalFat      ? Number(goalFat)      : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      setGoalsMsg({ ok: true, text: "Goals saved!" })
    } catch (err) {
      setGoalsMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" })
    } finally {
      setSavingGoals(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "New passwords don't match" })
      return
    }
    setSavingPw(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Change failed")
      setPwMsg({ ok: true, text: "Password updated!" })
      setCurrentPw(""); setNewPw(""); setConfirmPw("")
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" })
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Profile & Theme form ── */}
      <form onSubmit={saveProfile} className="space-y-6">

        {/* Avatar + Name */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <h2 className="text-base font-semibold text-slate-700">Profile</h2>

          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-sm flex-shrink-0",
                avatarTextColor(avatarColor),
                avatarColor === "#ffffff" && "ring-1 ring-slate-200"
              )}
              style={{ backgroundColor: avatarColor }}
            >
              {name[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs font-medium text-slate-600 block mb-1">Display name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">Avatar colour</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    avatarColor === c ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : "",
                    c === "#ffffff" && avatarColor !== c && "ring-1 ring-slate-200"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Theme picker */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-base font-semibold text-slate-700">Theme</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <ThemePreview
                key={t.id}
                t={t}
                selected={theme === t.id}
                onClick={() => setTheme(t.id)}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400">Theme applies immediately after saving.</p>
        </div>

        {profileMsg && (
          <p className={cn("text-sm font-medium", profileMsg.ok ? "text-green-600" : "text-red-600")}>
            {profileMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={savingProfile}
          className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-base disabled:opacity-50"
        >
          {savingProfile ? "Saving…" : "Save Changes"}
        </button>
      </form>

      {/* ── Nutrition Goals form ── */}
      <form onSubmit={saveGoals} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-orange-500" />
          <h2 className="text-base font-semibold text-slate-700">Daily Nutrition Goals</h2>
        </div>
        <p className="text-xs text-slate-400 -mt-2">
          Leave blank to track without a goal. Used in the Nutrition tab on the Grocery page.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {([
            { label: "Calories (kcal)", value: goalCalories, set: setGoalCalories, placeholder: "e.g. 2000" },
            { label: "Protein (g)",     value: goalProtein,  set: setGoalProtein,  placeholder: "e.g. 150"  },
            { label: "Carbs (g)",       value: goalCarbs,    set: setGoalCarbs,    placeholder: "e.g. 250"  },
            { label: "Fat (g)",         value: goalFat,      set: setGoalFat,      placeholder: "e.g. 65"   },
          ] as { label: string; value: string; set: (v: string) => void; placeholder: string }[]).map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
              <input
                type="number"
                min="0"
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          ))}
        </div>

        {goalsMsg && (
          <p className={cn("text-sm font-medium", goalsMsg.ok ? "text-green-600" : "text-red-600")}>
            {goalsMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={savingGoals}
          className="w-full h-11 rounded-xl bg-orange-500 text-white font-semibold text-sm disabled:opacity-50"
        >
          {savingGoals ? "Saving…" : "Save Goals"}
        </button>
      </form>

      {/* ── Password form ── */}
      <form onSubmit={changePassword} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h2 className="text-base font-semibold text-slate-700">Change Password</h2>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Current password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">New password</label>
            <input
              type={showPw ? "text" : "password"}
              required
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Confirm</label>
            <input
              type={showPw ? "text" : "password"}
              required
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className={cn(
                "w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500",
                confirmPw && confirmPw !== newPw ? "border-red-300" : "border-slate-200"
              )}
            />
          </div>
        </div>

        {pwMsg && (
          <p className={cn("text-sm font-medium", pwMsg.ok ? "text-green-600" : "text-red-600")}>
            {pwMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={savingPw || !currentPw || !newPw || newPw !== confirmPw}
          className="w-full h-11 rounded-xl bg-slate-800 text-white font-semibold text-sm disabled:opacity-40"
        >
          {savingPw ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  )
}
