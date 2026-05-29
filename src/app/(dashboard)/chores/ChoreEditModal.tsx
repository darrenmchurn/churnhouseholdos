"use client"

import { useState } from "react"
import { Modal } from "@/components/Modal"
import { cn, chicagoToUTC, utcToChicago } from "@/lib/utils"

type User = { id: string; name: string; avatarColor: string }
type Chore = {
  id: string
  title: string
  frequency: string
  pointValue: number
  dueBy: string | null
  assignee: { id: string; name: string; avatarColor: string } | null
}

const FREQUENCIES = [
  { value: "ONE_TIME", label: "One-time" },
  { value: "DAILY",    label: "Daily" },
  { value: "WEEKLY",   label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "MONTHLY",  label: "Monthly" },
]

type Props = {
  chore: Chore | null
  users: User[]
  onClose: () => void
  onSaved: (updated: Chore & { lastCompleted: string | null }) => void
}

export function ChoreEditModal({ chore, users, onClose, onSaved }: Props) {
  const [title, setTitle]       = useState(chore?.title ?? "")
  const [frequency, setFreq]    = useState(chore?.frequency ?? "ONE_TIME")
  const [points, setPoints]     = useState(String(chore?.pointValue ?? 1))
  const [assigneeId, setAssignee] = useState(chore?.assignee?.id ?? "")
  const [dueByDate, setDate]    = useState(() => {
    if (!chore?.dueBy) return ""
    return utcToChicago(chore.dueBy).date
  })
  const [dueByTime, setTime]    = useState(() => {
    if (!chore?.dueBy) return "08:00"
    return utcToChicago(chore.dueBy).time
  })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")

  // Reset state when chore changes (modal re-opens for a different chore)
  // This is handled by remounting via key in parent.

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!chore) return
    setSaving(true)
    setError("")
    const dueBy = dueByDate ? chicagoToUTC(dueByDate, dueByTime) : null
    try {
      const res = await fetch(`/api/chores/${chore.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          frequency,
          pointValue: parseInt(points) || 1,
          assigneeId: assigneeId || null,
          dueBy,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Save failed")
      }
      const updated = await res.json()
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!chore} onClose={onClose} title="Edit Chore">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Chore Name *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFreq(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Points</label>
            <input
              type="number"
              min="1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Assign To</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Anyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Due By <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dueByDate}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="time"
              value={dueByTime}
              onChange={(e) => setTime(e.target.value)}
              disabled={!dueByDate}
              className="w-28 h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
            />
          </div>
          {dueByDate && (
            <button
              type="button"
              onClick={() => { setDate(""); setTime("08:00") }}
              className="text-xs text-slate-400 hover:text-red-500 mt-1.5"
            >
              Clear due date
            </button>
          )}
        </div>

        {error && (
          <p className={cn("text-sm font-medium text-red-600")}>{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </Modal>
  )
}
