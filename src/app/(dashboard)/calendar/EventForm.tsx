"use client"

import { useState } from "react"
import { Modal } from "@/components/Modal"
import { GCAL_COLORS } from "@/lib/calendar-constants"

const COLOR_OPTIONS = Object.entries(GCAL_COLORS).map(([id, hex]) => ({ id, hex }))

const COLOR_NAMES: Record<string, string> = {
  "1": "Tomato", "2": "Flamingo", "3": "Tangerine", "4": "Banana",
  "5": "Sage", "6": "Basil", "7": "Peacock", "8": "Blueberry",
  "9": "Lavender", "10": "Grape", "11": "Graphite",
}

type Props = {
  defaultDate?: string
  onCreated: () => void
}

export function EventForm({ defaultDate, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [allDay, setAllDay] = useState(true)
  const [form, setForm] = useState({
    summary: "",
    description: "",
    colorId: "8",
    date: defaultDate ?? new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "10:00",
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const start = allDay ? form.date : `${form.date}T${form.startTime}:00`
    const end = allDay
      ? form.date
      : `${form.date}T${form.endTime}:00`

    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: form.summary,
        description: form.description || undefined,
        colorId: form.colorId,
        start,
        end,
        allDay,
      }),
    })

    setLoading(false)
    setOpen(false)
    setForm({ summary: "", description: "", colorId: "8", date: form.date, startTime: "09:00", endTime: "10:00" })
    onCreated()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
      >
        + Add Event
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New Event">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
            <input
              required
              autoFocus
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Event name"
            />
          </div>

          {/* All day toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAllDay(!allDay)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center ${allDay ? "bg-indigo-500" : "bg-slate-200"}`}
            >
              <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${allDay ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </button>
            <span className="text-sm text-slate-700">All-day event</span>
          </div>

          <div className={`grid gap-3 ${allDay ? "grid-cols-1" : "grid-cols-3"}`}>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {!allDay && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Start</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => set("startTime", e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">End</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => set("endTime", e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map(({ id, hex }) => (
                <button
                  key={id}
                  type="button"
                  title={COLOR_NAMES[id]}
                  onClick={() => set("colorId", id)}
                  className={`w-7 h-7 rounded-full transition-transform ${form.colorId === id ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : ""}`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Notes</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Optional details…"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !form.summary.trim()}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add to Calendar"}
          </button>
        </form>
      </Modal>
    </>
  )
}
