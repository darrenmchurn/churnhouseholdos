"use client"

import { useState } from "react"
import { Modal } from "@/components/Modal"

type Props = {
  defaultDate: string
  onCreated: () => void
  defaultColor: string   // creator's avatar color
  avatarColors: string[] // active avatar colors for the picker
}

export function EventForm({ defaultDate, onCreated, defaultColor, avatarColors }: Props) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [allDay, setAllDay]   = useState(true)
  const [form, setForm] = useState({
    title:       "",
    description: "",
    color:       defaultColor,
    date:        defaultDate,
    startTime:   "09:00",
    endTime:     "10:00",
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleClose() {
    setOpen(false)
    setError("")
    setForm((f) => ({ ...f, title: "", description: "", color: defaultColor, startTime: "09:00", endTime: "10:00" }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const startDate = allDay ? form.date : `${form.date}T${form.startTime}:00`
    const endDate   = allDay ? form.date : `${form.date}T${form.endTime}:00`

    try {
      const res = await fetch("/api/calendar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:       form.title,
          description: form.description || undefined,
          color:       form.color,
          startDate,
          endDate,
          allDay,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to create event")
      }
      handleClose()
      onCreated()
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
        + Add Event
      </button>

      <Modal open={open} onClose={handleClose} title="New Event">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Event name"
            />
          </div>

          {/* All-day toggle */}
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

          {/* Date / time */}
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
                  <label className="text-xs font-medium text-slate-600 block mb-1">Start (Central)</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => set("startTime", e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">End (Central)</label>
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

          {/* Colour picker */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {avatarColors.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => set("color", hex)}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === hex ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : ""}${hex === "#ffffff" ? " ring-1 ring-slate-200" : ""}`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
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

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !form.title.trim()}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add to Calendar"}
          </button>
        </form>
      </Modal>
    </>
  )
}
