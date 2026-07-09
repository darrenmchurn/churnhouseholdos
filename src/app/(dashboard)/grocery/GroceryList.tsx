"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ShoppingCart, Plus, Trash2, Check, X, ChevronDown } from "lucide-react"
import { ConfirmSheet } from "@/components/ConfirmSheet"

type GroceryItem = {
  id: string
  name: string
  quantity: string | null
  category: string | null
  completed: boolean
  createdAt: string
  addedBy: { name: string; avatarColor: string }
}

const CATEGORIES = [
  "Produce", "Dairy", "Meat", "Bakery", "Frozen",
  "Pantry", "Drinks", "Snacks", "Household", "Other",
]

export function GroceryList({
  initialItems,
  canManage,
  currentUser,
}: {
  initialItems: GroceryItem[]
  canManage: boolean
  currentUser: { name: string; avatarColor: string }
}) {
  const router = useRouter()
  const [items, setItems] = useState<GroceryItem[]>(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("")
  const [category, setCategory] = useState("")
  const [saving, setSaving] = useState(false)
  const [showChecked, setShowChecked] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showForm) nameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [showForm])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const optimistic: GroceryItem = {
      id: `temp-${Date.now()}`,
      name: name.trim(),
      quantity: quantity.trim() || null,
      category: category.trim() || null,
      completed: false,
      createdAt: new Date().toISOString(),
      addedBy: { name: currentUser.name, avatarColor: currentUser.avatarColor },
    }
    setItems((prev) => [optimistic, ...prev])
    // Keep the form open and refocus for rapid multi-add — grocery entry is
    // naturally batched; keep the category since runs often group (X closes)
    setName(""); setQuantity("")
    nameRef.current?.focus()

    try {
      const res = await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: optimistic.name, quantity: optimistic.quantity, category: optimistic.category }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setItems((prev) => prev.map((it) => (it.id === optimistic.id ? created : it)))
    } catch {
      setItems((prev) => prev.filter((it) => it.id !== optimistic.id))
    } finally {
      setSaving(false)
      router.refresh()
    }
  }

  async function toggleItem(item: GroceryItem) {
    const next = !item.completed
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, completed: next } : it)))
    // Auto-expand checked section when the first item is checked off
    if (next) setShowChecked(true)
    try {
      await fetch(`/api/grocery/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
      })
    } catch {
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, completed: !next } : it)))
    }
    router.refresh()
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
    try { await fetch(`/api/grocery/${id}`, { method: "DELETE" }) } catch {}
    router.refresh()
  }

  async function clearCompleted() {
    setConfirmingClear(false)
    setItems((prev) => prev.filter((it) => !it.completed))
    try { await fetch("/api/grocery", { method: "DELETE" }) } catch {}
    router.refresh()
  }

  const uncompleted = items.filter((it) => !it.completed)
  const completed   = items.filter((it) => it.completed)

  // Group uncompleted by category
  const grouped: Record<string, GroceryItem[]> = {}
  for (const item of uncompleted) {
    const key = item.category ?? "Other"
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }
  const sortedKeys = Object.keys(grouped).sort()

  return (
    <div className="space-y-4">

      {/* ── Add form ── */}
      {showForm ? (
        <form onSubmit={addItem} className="bg-white rounded-2xl p-4 shadow-card-md space-y-2.5">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-sm font-semibold text-slate-800">Add Item</p>
            <button type="button" onClick={() => setShowForm(false)}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Name + optional quantity on one row */}
          <div className="flex gap-2">
            <input
              ref={nameRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name…"
              className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              className="w-20 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Category */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
          >
            <option value="">No category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full h-10 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add to List"}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Plus size={17} /> Add Item
        </button>
      )}

      {/* ── Empty state ── */}
      {items.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-card">
          <ShoppingCart size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">Your list is empty</p>
          <p className="text-xs text-slate-400 mt-1">Tap "Add Item" to get started</p>
        </div>
      )}

      {/* ── Uncompleted items, grouped by category ── */}
      {sortedKeys.map((key) => (
        <div key={key}>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 px-1">{key}</p>
          <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-slate-100">
            {grouped[key].map((item) => (
              <ItemRow key={item.id} item={item} canManage={canManage} onToggle={toggleItem} onDelete={deleteItem} />
            ))}
          </div>
        </div>
      ))}

      {/* ── Checked off — collapsible ── */}
      {completed.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5">
            <button
              onClick={() => setShowChecked((v) => !v)}
              className="flex items-center gap-2 flex-1 text-left"
              aria-expanded={showChecked}
            >
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Checked off
              </span>
              <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{completed.length}</span>
              <ChevronDown
                size={13}
                className={cn("text-slate-300 transition-transform ml-0.5", showChecked && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            {canManage && (
              <button onClick={() => setConfirmingClear(true)} className="text-xs text-red-500 font-medium hover:text-red-700 ml-3">
                Clear all
              </button>
            )}
          </div>
          {showChecked && (
            <div className="border-t border-slate-100 divide-y divide-slate-100">
              {completed.map((item) => (
                <ItemRow key={item.id} item={item} canManage={canManage} onToggle={toggleItem} onDelete={deleteItem} />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmSheet
        open={confirmingClear}
        title={`Clear ${completed.length} checked-off item${completed.length !== 1 ? "s" : ""}?`}
        message="They'll be removed from the list for everyone."
        confirmLabel="Clear all"
        onConfirm={clearCompleted}
        onCancel={() => setConfirmingClear(false)}
      />
    </div>
  )
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({
  item, canManage, onToggle, onDelete,
}: {
  item: GroceryItem
  canManage: boolean
  onToggle: (item: GroceryItem) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="px-3 py-2.5 flex items-center gap-3 min-h-[2.75rem]">
      {/* Square checkbox */}
      <button
        onClick={() => onToggle(item)}
        className={cn(
          "w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors",
          item.completed
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-slate-300 hover:border-indigo-400"
        )}
        aria-label={item.completed ? `Uncheck ${item.name}` : `Check off ${item.name}`}
      >
        {item.completed && <Check size={11} strokeWidth={3} />}
      </button>

      {/* Name — flex-1 with truncate */}
      <p className={cn(
        "flex-1 text-sm font-medium text-slate-900 truncate",
        item.completed && "line-through text-slate-400"
      )}>
        {item.name}
      </p>

      {/* Quantity — right-aligned, same row */}
      {item.quantity && (
        <span className={cn(
          "text-xs text-slate-400 flex-shrink-0",
          item.completed && "line-through"
        )}>
          {item.quantity}
        </span>
      )}

      {/* Delete */}
      {canManage && (
        <button
          onClick={() => onDelete(item.id)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          aria-label={`Remove ${item.name}`}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}
