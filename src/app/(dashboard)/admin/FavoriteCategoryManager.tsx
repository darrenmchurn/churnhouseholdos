"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { FAVORITE_GROUPS } from "@/lib/favorites-groups"

type Category = {
  id: string
  label: string
  emoji: string
  group: string
  active: boolean
  sortOrder: number
  _count: { favorites: number }
}

type FormState = { emoji: string; label: string; group: string }
const EMPTY_FORM: FormState = { emoji: "⭐", label: "", group: "BASICS" }

export function FavoriteCategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  function openNew() {
    setEditingId(null); setForm(EMPTY_FORM); setError(""); setShowForm(true)
  }
  function openEdit(c: Category) {
    setEditingId(c.id); setForm({ emoji: c.emoji, label: c.label, group: c.group }); setError(""); setShowForm(true)
  }
  function cancelForm() {
    setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setError("")
  }

  async function patch(id: string, data: object) {
    const res = await fetch(`/api/favorites/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to save")
    return res.json()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label.trim()) return
    setSaving(true); setError("")
    try {
      if (editingId) {
        const saved = await patch(editingId, form)
        setCategories((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...saved } : c)))
      } else {
        const res = await fetch("/api/favorites/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to save")
        const saved = await res.json()
        setCategories((prev) => [...prev, { ...saved, _count: { favorites: 0 } }])
      }
      cancelForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(c: Category) {
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)))
    await patch(c.id, { active: !c.active })
  }

  // Swap sortOrder with the neighbour in the full list
  async function move(c: Category, dir: -1 | 1) {
    const i = sorted.findIndex((x) => x.id === c.id)
    const other = sorted[i + dir]
    if (!other) return
    setCategories((prev) => prev.map((x) =>
      x.id === c.id ? { ...x, sortOrder: other.sortOrder }
      : x.id === other.id ? { ...x, sortOrder: c.sortOrder }
      : x))
    await Promise.all([patch(c.id, { sortOrder: other.sortOrder }), patch(other.id, { sortOrder: c.sortOrder })])
  }

  async function remove(c: Category) {
    const n = c._count.favorites
    const msg = n > 0
      ? `Delete "${c.label}"? This also erases ${n} answer${n === 1 ? "" : "s"}. Use the toggle to hide it instead.`
      : `Delete "${c.label}"?`
    if (!confirm(msg)) return
    setCategories((prev) => prev.filter((x) => x.id !== c.id))
    await fetch(`/api/favorites/categories/${c.id}`, { method: "DELETE" })
  }

  return (
    <div className="space-y-3">
      {FAVORITE_GROUPS.map((g) => {
        const cats = sorted.filter((c) => c.group === g.value)
        if (cats.length === 0) return null
        return (
          <div key={g.value}>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">{g.emoji} {g.label}</p>
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {cats.map((c) => (
                <div key={c.id} className={cn("px-3 py-2 flex items-center gap-2", !c.active && "opacity-50")}>
                  <span className="text-lg w-6 text-center flex-shrink-0">{c.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.label}</p>
                    <p className="text-[10px] text-slate-400">
                      {c._count.favorites} answer{c._count.favorites === 1 ? "" : "s"}{!c.active && " · hidden"}
                    </p>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <button onClick={() => move(c, -1)} className="w-7 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-500" aria-label="Move up"><ChevronUp size={15} /></button>
                    <button onClick={() => move(c, 1)} className="w-7 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-500" aria-label="Move down"><ChevronDown size={15} /></button>
                    <button
                      onClick={() => toggleActive(c)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50"
                      title={c.active ? "Hide" : "Show"}
                    >
                      {c.active ? <ToggleRight size={16} className="text-indigo-500" /> : <ToggleLeft size={16} />}
                    </button>
                    <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50" aria-label="Edit"><Pencil size={14} /></button>
                    <button onClick={() => remove(c)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50" aria-label="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {showForm ? (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-slate-900">{editingId ? "Edit Category" : "New Category"}</p>
            <button type="button" onClick={cancelForm} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-[4rem_1fr] gap-2">
            <input
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-full h-10 px-2 rounded-xl border border-slate-200 text-xl text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              maxLength={4}
              aria-label="Emoji"
            />
            <input
              required
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Ice Cream Flavor"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FAVORITE_GROUPS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, group: g.value }))}
                className={cn(
                  "h-9 rounded-xl border-2 text-xs font-semibold transition-colors",
                  form.group === g.value
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300",
                )}
              >
                {g.emoji} {g.label}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !form.label.trim()}
            className="w-full h-10 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Check size={15} />
            {saving ? "Saving…" : editingId ? "Save Changes" : "Add Category"}
          </button>
        </form>
      ) : (
        <button
          onClick={openNew}
          className="w-full h-11 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 font-medium text-sm flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          <Plus size={16} />
          Add Category
        </button>
      )}
    </div>
  )
}
