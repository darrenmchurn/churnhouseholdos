"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ShoppingCart, Plus, Trash2, Check, X } from "lucide-react"

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
}: {
  initialItems: GroceryItem[]
  canManage: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<GroceryItem[]>(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("")
  const [category, setCategory] = useState("")
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showForm) nameRef.current?.focus()
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
      addedBy: { name: "You", avatarColor: "#6366f1" },
    }
    setItems((prev) => [optimistic, ...prev])
    setName("")
    setQuantity("")
    setCategory("")
    setShowForm(false)

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
    try {
      await fetch(`/api/grocery/${id}`, { method: "DELETE" })
    } catch {
      // item already visually removed; refresh will resync
    }
    router.refresh()
  }

  async function clearCompleted() {
    setItems((prev) => prev.filter((it) => !it.completed))
    try {
      await fetch("/api/grocery", { method: "DELETE" })
    } catch {}
    router.refresh()
  }

  // Group uncompleted by category, then show completed at bottom
  const uncompleted = items.filter((it) => !it.completed)
  const completed = items.filter((it) => it.completed)

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
      {/* Add form */}
      {showForm ? (
        <form onSubmit={addItem} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-slate-900 text-sm">New Item</p>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Item *</label>
            <input
              ref={nameRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Almond milk"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Quantity</label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 2 gallons"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add to List"}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Plus size={18} />
          Add Item
        </button>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <ShoppingCart size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">Your list is empty</p>
          <p className="text-xs text-slate-400 mt-1">Tap "Add Item" to get started</p>
        </div>
      )}

      {/* Grouped uncompleted items */}
      {sortedKeys.map((key) => (
        <div key={key}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">{key}</p>
          <div className="space-y-2">
            {grouped[key].map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                canManage={canManage}
                onToggle={toggleItem}
                onDelete={deleteItem}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Completed section */}
      {completed.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Checked off ({completed.length})
            </p>
            {canManage && (
              <button
                onClick={clearCompleted}
                className="text-xs text-red-500 font-medium hover:text-red-700"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-2 opacity-60">
            {completed.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                canManage={canManage}
                onToggle={toggleItem}
                onDelete={deleteItem}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ItemRow({
  item,
  canManage,
  onToggle,
  onDelete,
}: {
  item: GroceryItem
  canManage: boolean
  onToggle: (item: GroceryItem) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3">
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item)}
        className={cn(
          "w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
          item.completed
            ? "bg-green-500 border-green-500 text-white"
            : "border-slate-300 hover:border-indigo-400"
        )}
      >
        {item.completed && <Check size={12} strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium text-slate-900 truncate", item.completed && "line-through text-slate-400")}>
          {item.name}
        </p>
        {item.quantity && (
          <p className="text-xs text-slate-500">{item.quantity}</p>
        )}
      </div>

      {/* Delete */}
      {canManage && (
        <button
          onClick={() => onDelete(item.id)}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}
