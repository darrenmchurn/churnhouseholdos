"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Tile = {
  id: string
  title: string
  url: string
  emoji: string
  category: string
  active: boolean
  sortOrder: number
}

const CATEGORIES = [
  { value: "GAMES",    label: "Games",    badge: "bg-indigo-100 text-indigo-700" },
  { value: "LEARNING", label: "Learning", badge: "bg-emerald-100 text-emerald-700" },
  { value: "VIDEOS",   label: "Videos",   badge: "bg-amber-100 text-amber-700" },
]

type FormState = {
  emoji: string
  title: string
  url: string
  category: string
}

const EMPTY_FORM: FormState = { emoji: "🎮", title: "", url: "", category: "GAMES" }

export function KidsZoneTileManager({ initialTiles }: { initialTiles: Tile[] }) {
  const [tiles, setTiles] = useState<Tile[]>(initialTiles)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState("")

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError("")
    setShowForm(true)
  }

  function openEdit(tile: Tile) {
    setEditingId(tile.id)
    setForm({ emoji: tile.emoji, title: tile.title, url: tile.url, category: tile.category })
    setError("")
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError("")
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.url.trim()) return
    setSaving(true); setError("")
    try {
      const payload = {
        title: form.title.trim(),
        url: form.url.trim(),
        emoji: form.emoji.trim() || "🎮",
        category: form.category,
        sortOrder: editingId ? undefined : tiles.length,
      }
      const res = await fetch(
        editingId ? `/api/kids-zone/${editingId}` : "/api/kids-zone",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to save")
      }
      const saved: Tile = await res.json()
      setTiles((prev) =>
        editingId
          ? prev.map((t) => (t.id === editingId ? saved : t))
          : [...prev, saved]
      )
      cancelForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(tile: Tile) {
    const next = !tile.active
    setTiles((prev) => prev.map((t) => (t.id === tile.id ? { ...t, active: next } : t)))
    await fetch(`/api/kids-zone/${tile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    })
  }

  async function deleteTile(id: string) {
    if (!confirm("Delete this tile?")) return
    setTiles((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/kids-zone/${id}`, { method: "DELETE" })
  }

  async function loadDefaults() {
    setSeeding(true)
    try {
      const res = await fetch("/api/kids-zone/seed", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        if (data.tiles) setTiles(data.tiles)
      }
    } finally {
      setSeeding(false)
    }
  }

  const categoryBadge = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.badge ?? "bg-slate-100 text-slate-500"
  const categoryLabel = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label ?? cat

  return (
    <div className="space-y-3">
      {/* Empty state with Load Defaults */}
      {tiles.length === 0 && !showForm && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-center">
          <p className="text-sm font-medium text-slate-500 mb-3">No tiles yet</p>
          <button
            onClick={loadDefaults}
            disabled={seeding}
            className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {seeding ? "Loading…" : "Load Default Tiles"}
          </button>
        </div>
      )}

      {/* Tile list */}
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className={cn(
            "bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3",
            !tile.active && "opacity-50"
          )}
        >
          <span className="text-2xl flex-shrink-0">{tile.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{tile.title}</p>
            <p className="text-xs text-slate-400 truncate">{tile.url}</p>
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block", categoryBadge(tile.category))}>
              {categoryLabel(tile.category)}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => toggleActive(tile)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
              title={tile.active ? "Disable" : "Enable"}
            >
              {tile.active
                ? <ToggleRight size={16} className="text-indigo-500" />
                : <ToggleLeft size={16} />}
            </button>
            <button
              onClick={() => openEdit(tile)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => deleteTile(tile.id)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      {/* Add / Edit form */}
      {showForm ? (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-slate-900">
              {editingId ? "Edit Tile" : "New Tile"}
            </p>
            <button type="button" onClick={cancelForm} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-[4rem_1fr] gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Emoji</label>
              <input
                type="text"
                value={form.emoji}
                onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                className="w-full h-10 px-2 rounded-xl border border-slate-200 text-xl text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
              <input
                required
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Scratch"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">URL *</label>
            <input
              required
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://scratch.mit.edu"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Category</label>
            <div className="flex gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                  className={cn(
                    "flex-1 h-9 rounded-xl border-2 text-xs font-semibold transition-colors",
                    form.category === c.value
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving || !form.title.trim() || !form.url.trim()}
            className="w-full h-10 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Check size={15} />
            {saving ? "Saving…" : editingId ? "Save Changes" : "Add Tile"}
          </button>
        </form>
      ) : (
        <button
          onClick={openNew}
          className="w-full h-11 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 font-medium text-sm flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          <Plus size={16} />
          Add Tile
        </button>
      )}
    </div>
  )
}
