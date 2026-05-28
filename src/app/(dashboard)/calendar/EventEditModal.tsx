"use client"

import { useState } from "react"
import { Modal } from "@/components/Modal"
import { GCAL_COLORS } from "@/lib/calendar-constants"
import type { CalEvent } from "@/lib/calendar-constants"
import { Trash2 } from "lucide-react"

const COLOR_OPTIONS = Object.values(GCAL_COLORS)
const COLOR_NAMES: Record<string, string> = {
  "#ef4444":"Tomato","#f97316":"Flamingo","#f59e0b":"Tangerine","#eab308":"Banana",
  "#84cc16":"Sage","#16a34a":"Basil","#0d9488":"Peacock","#3b82f6":"Blueberry",
  "#a78bfa":"Lavender","#9333ea":"Grape","#6b7280":"Graphite",
}
const TZ = "America/Chicago"

function toDateInput(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }) // YYYY-MM-DD
}
function toTimeInput(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit",
  }) // HH:MM
}

type Props = {
  event: CalEvent
  onClose: () => void
  onSaved: (updated: CalEvent) => void
  onDeleted: (id: string) => void
}

export function EventEditModal({ event, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle]       = useState(event.title)
  const [description, setDesc]  = useState(event.description ?? "")
  const [color, setColor]       = useState(event.color)
  const [allDay, setAllDay]     = useState(event.allDay)
  const [date, setDate]         = useState(toDateInput(event.startDate))
  const [startTime, setStart]   = useState(event.allDay ? "09:00" : toTimeInput(event.startDate))
  const [endTime, setEnd]       = useState(
    event.endDate && !event.allDay ? toTimeInput(event.endDate) : "10:00"
  )
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState("")

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError("")
    try {
      const startDate = allDay ? date : `${date}T${startTime}:00`
      const endDate   = allDay ? date : `${date}T${endTime}:00`
      const res = await fetch(`/api/calendar/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || undefined, color, startDate, endDate, allDay }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed")
      onSaved({ ...event, title, description, color, allDay,
        startDate: allDay ? date + "T12:00:00Z" : `${date}T${startTime}:00`,
        endDate:   allDay ? date + "T12:00:00Z" : `${date}T${endTime}:00`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${event.title}"?`)) return
    setDeleting(true)
    await fetch(`/api/calendar/${event.id}`, { method: "DELETE" })
    onDeleted(event.id)
  }

  return (
    <Modal open onClose={onClose} title="Edit Event">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {/* All-day toggle */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setAllDay(!allDay)}
            className={`w-10 h-6 rounded-full transition-colors flex items-center ${allDay ? "bg-indigo-500" : "bg-slate-200"}`}>
            <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${allDay ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm text-slate-700">All-day event</span>
        </div>

        {/* Date / time */}
        <div className={`grid gap-3 ${allDay ? "grid-cols-1" : "grid-cols-3"}`}>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {!allDay && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Start (CST)</label>
                <input type="time" value={startTime} onChange={(e) => setStart(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">End (CST)</label>
                <input type="time" value={endTime} onChange={(e) => setEnd(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </>
          )}
        </div>

        {/* Colour */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTIONS.map((hex) => (
              <button key={hex} type="button" title={COLOR_NAMES[hex]} onClick={() => setColor(hex)}
                className={`w-7 h-7 rounded-full transition-transform ${color === hex ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : ""}`}
                style={{ backgroundColor: hex }} />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Notes</label>
          <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Optional details…" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="h-11 px-4 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm font-medium disabled:opacity-50">
            <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
          </button>
          <button type="submit" disabled={saving || !title.trim()}
            className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
