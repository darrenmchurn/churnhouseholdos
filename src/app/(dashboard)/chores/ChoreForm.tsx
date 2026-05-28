"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/Modal"

type User = { id: string; name: string; avatarColor: string }

const FREQUENCIES = [
  { value: "ONE_TIME", label: "One-time" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "MONTHLY", label: "Monthly" },
]

export function ChoreForm({ users }: { users: User[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: "",
    frequency: "ONE_TIME",
    pointValue: "1",
    assigneeId: "",
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch("/api/chores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        pointValue: parseInt(form.pointValue) || 1,
        assigneeId: form.assigneeId || null,
      }),
    })
    setLoading(false)
    setOpen(false)
    setForm({ title: "", frequency: "ONE_TIME", pointValue: "1", assigneeId: "" })
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
      >
        + Add Chore
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New Chore">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Chore Name *</label>
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Take out trash"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => set("frequency", e.target.value)}
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
                value={form.pointValue}
                onChange={(e) => set("pointValue", e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Assign To</label>
            <select
              value={form.assigneeId}
              onChange={(e) => set("assigneeId", e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Anyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !form.title.trim()}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Chore"}
          </button>
        </form>
      </Modal>
    </>
  )
}
