"use client"

import { useState } from "react"
import { Plus, Check, X, Trash2, ChevronRight } from "lucide-react"
import { cn, relTime } from "@/lib/utils"
import { FAVORITE_GROUPS } from "@/lib/favorites-groups"
import type { FavCategory, FavEntry } from "../types"

type ApiFavorite = Omit<FavEntry, "updatedByName">

// Which row is open: a preset category, an existing custom answer, or the "add your own" form
type OpenKey = `cat:${string}` | `fav:${string}` | "new" | null

type Draft = { value: string; note: string; label: string; emoji: string }
const EMPTY_DRAFT: Draft = { value: "", note: "", label: "", emoji: "⭐" }

const inputCls = "w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"

export function FavoritesEditor({
  userId, categories, initialEntries,
}: {
  userId: string
  categories: FavCategory[]
  initialEntries: FavEntry[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [open, setOpen] = useState<OpenKey>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const byCategory = new Map(entries.filter((e) => e.categoryId).map((e) => [e.categoryId!, e]))
  const custom = entries.filter((e) => !e.categoryId)
  const filled = categories.filter((c) => byCategory.has(c.id)).length

  function openRow(key: OpenKey, entry?: FavEntry) {
    setOpen(key)
    setError("")
    setDraft({
      value: entry?.value ?? "",
      note: entry?.note ?? "",
      label: entry?.customLabel ?? "",
      emoji: entry?.customEmoji ?? "⭐",
    })
  }

  function upsertLocal(saved: ApiFavorite) {
    const entry: FavEntry = { ...saved, updatedByName: null }
    setEntries((prev) =>
      prev.some((e) => e.id === entry.id)
        ? prev.map((e) => (e.id === entry.id ? entry : e))
        : [...prev, entry],
    )
  }

  async function request(url: string, method: string, body?: object) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? "Something went wrong")
    return data
  }

  async function run(fn: () => Promise<void>) {
    setSaving(true); setError("")
    try {
      await fn()
      setOpen(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const remove = (entry: FavEntry) =>
    run(async () => {
      await request(`/api/favorites/${entry.id}`, "DELETE")
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    })

  function savePreset(category: FavCategory) {
    const existing = byCategory.get(category.id)
    // Saving an empty answer clears it
    if (!draft.value.trim()) return existing ? remove(existing) : setOpen(null)
    return run(async () => {
      upsertLocal(await request("/api/favorites", "POST", {
        userId, categoryId: category.id, value: draft.value, note: draft.note,
      }))
    })
  }

  function saveCustom(entry?: FavEntry) {
    const body = { customLabel: draft.label, customEmoji: draft.emoji, value: draft.value, note: draft.note }
    return run(async () => {
      upsertLocal(entry
        ? await request(`/api/favorites/${entry.id}`, "PATCH", body)
        : await request("/api/favorites", "POST", { userId, ...body }))
    })
  }

  // Plain render functions (not components) so inputs keep focus across re-renders
  const formFields = (customFields: boolean, onSave: () => void, entry?: FavEntry) => (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave() }}
      className="px-4 pb-4 pt-1 space-y-2.5 bg-slate-50/60"
    >
      {customFields && (
        <div className="grid grid-cols-[3.5rem_1fr] gap-2">
          <input
            value={draft.emoji}
            onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))}
            className={cn(inputCls, "text-xl text-center px-1")}
            maxLength={4}
            aria-label="Emoji"
          />
          <input
            required
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="Category, e.g. Superhero"
            className={inputCls}
            maxLength={60}
          />
        </div>
      )}
      <input
        autoFocus={!customFields}
        required={customFields}
        value={draft.value}
        onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
        placeholder="Your answer"
        className={inputCls}
        maxLength={200}
      />
      <input
        value={draft.note}
        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        placeholder="Note (optional) — brand, where to buy, details"
        className={cn(inputCls, "text-xs")}
        maxLength={300}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 h-10 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Check size={15} />
          {saving ? "Saving…" : "Save"}
        </button>
        {entry && (
          <button
            type="button"
            disabled={saving}
            onClick={() => remove(entry)}
            className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-red-500 flex items-center justify-center"
            aria-label="Clear answer"
            title="Clear answer"
          >
            <Trash2 size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-400 flex items-center justify-center"
          aria-label="Cancel"
        >
          <X size={15} />
        </button>
      </div>
    </form>
  )

  const row = (key: OpenKey, emoji: string, label: string, entry: FavEntry | undefined, form: () => React.ReactNode) => (
    <li key={key}>
      <button
        type="button"
        onClick={() => (open === key ? setOpen(null) : openRow(key, entry))}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <span className="text-lg w-6 text-center flex-shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 leading-tight">{label}</p>
          {entry ? (
            <>
              <p className="text-sm font-medium text-slate-800 break-words">{entry.value}</p>
              {entry.note && <p className="text-xs text-slate-500 break-words">{entry.note}</p>}
              <p className="text-[10px] text-slate-400 mt-0.5">
                Updated {relTime(entry.updatedAt)}{entry.updatedByName && ` by ${entry.updatedByName}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-300">Tap to add…</p>
          )}
        </div>
        <ChevronRight size={16} className={cn("text-slate-300 transition-transform flex-shrink-0", open === key && "rotate-90")} />
      </button>
      {open === key && form()}
    </li>
  )

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="bg-white rounded-2xl shadow-card px-4 py-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1.5">
          <span>{filled} of {categories.length} filled in</span>
          {custom.length > 0 && <span>+{custom.length} of your own</span>}
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${categories.length ? (filled / categories.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {FAVORITE_GROUPS.map((g) => {
        const cats = categories.filter((c) => c.group === g.value)
        if (cats.length === 0) return null
        return (
          <section key={g.value}>
            <h2 className="text-base font-semibold text-slate-700 mb-2">{g.emoji} {g.label}</h2>
            <ul className="bg-white rounded-2xl shadow-card divide-y divide-slate-100 overflow-hidden">
              {cats.map((c) => {
                const entry = byCategory.get(c.id)
                return row(`cat:${c.id}`, c.emoji, c.label, entry, () => formFields(false, () => savePreset(c), entry))
              })}
            </ul>
          </section>
        )
      })}

      {/* Custom categories */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-2">✨ Your Own</h2>
        <div className="space-y-2">
          {custom.length > 0 && (
            <ul className="bg-white rounded-2xl shadow-card divide-y divide-slate-100 overflow-hidden">
              {custom.map((e) =>
                row(`fav:${e.id}`, e.customEmoji ?? "⭐", e.customLabel ?? "", e, () => formFields(true, () => saveCustom(e), e)),
              )}
            </ul>
          )}
          {open === "new" ? (
            <div className="bg-white rounded-2xl shadow-card overflow-hidden">
              <p className="px-4 pt-3 pb-1 text-sm font-semibold text-slate-900">New favorite</p>
              {formFields(true, () => saveCustom())}
            </div>
          ) : (
            <button
              onClick={() => openRow("new")}
              className="w-full h-11 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 font-medium text-sm flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              <Plus size={16} />
              Add your own favorite
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
