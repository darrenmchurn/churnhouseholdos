"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/Modal"
import { chicagoToUTC } from "@/lib/utils"
import { cn } from "@/lib/utils"

type User = { id: string; name: string; avatarColor: string }

const FREQUENCIES = [
  { value: "ONE_TIME",  label: "One-time"      },
  { value: "DAILY",     label: "Daily"         },
  { value: "WEEKLY",    label: "Weekly"        },
  { value: "BIWEEKLY",  label: "Every 2 weeks" },
  { value: "MONTHLY",   label: "Monthly"       },
]

export function ChoreForm({ users }: { users: User[] }) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [form, setForm] = useState({
    title:      "",
    frequency:  "ONE_TIME",
    pointValue: "1",
    assigneeId: "",
  })
  const [dueByDate, setDueByDate] = useState("")
  const [dueByTime, setDueByTime] = useState("08:00")

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleClose() {
    setOpen(false)
    setError("")
    setForm({ title: "", frequency: "ONE_TIME", pointValue: "1", assigneeId: "" })
    setDueByDate("")
    setDueByTime("08:00")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const dueBy = dueByDate ? chicagoToUTC(dueByDate, dueByTime) : null
    try {
      const res = await fetch("/api/chores", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          pointValue: parseInt(form.pointValue) || 1,
          assigneeId: form.assigneeId || null,
          dueBy,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to create chore")
      }
      handleClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
      >
        + Add Chore
      </button>

      <Modal open={open} onClose={handleClose} title="New Chore">
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
              <label className="text-xs font-medium text-slate-600 block mb-1">⭐ Stars</label>
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

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Due By <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dueByDate}
                onChange={(e) => setDueByDate(e.target.value)}
                className="flex-1 h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="time"
                value={dueByTime}
                onChange={(e) => setDueByTime(e.target.value)}
                disabled={!dueByDate}
                className="w-28 h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
              />
            </div>
          </div>

          {error && (
            <p className={cn("text-sm font-medium text-red-600")}>{error}</p>
          )}

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
