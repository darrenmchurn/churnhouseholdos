"use client"

import { useState, useCallback } from "react"
import { ChevronLeft, ChevronRight, Trash2, Clock, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CalEvent } from "@/lib/calendar-constants"
import { EventForm } from "./EventForm"
import { EventEditModal } from "./EventEditModal"
import { ConfirmSheet } from "@/components/ConfirmSheet"

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

const TZ = "America/Chicago"

function eventDateKey(e: CalEvent): string {
  // Slice date in CST so all-day events land on the right calendar cell
  return new Date(e.startDate).toLocaleDateString("en-CA", { timeZone: TZ })
}

function formatEventTime(e: CalEvent): string {
  if (e.allDay) return "All day"
  return new Date(e.startDate).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: TZ,
  })
}

export function CalendarView({
  initialEvents,
  initialYear,
  initialMonth,
  today,
  canManage,
  avatarColors,
  myAvatarColor,
}: {
  initialEvents: CalEvent[]
  initialYear: number
  initialMonth: number
  today: string
  canManage: boolean
  avatarColors: string[]
  myAvatarColor: string
}) {
  const [year, setYear]               = useState(initialYear)
  const [month, setMonth]             = useState(initialMonth)
  const [events, setEvents]           = useState<CalEvent[]>(initialEvents)
  // Start with today selected so the page opens onto today's agenda
  // instead of a bare grid with empty space below
  const [selectedDate, setSelectedDate] = useState<string | null>(today)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [editing, setEditing]         = useState<CalEvent | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<CalEvent | null>(null)
  const [loading, setLoading]         = useState(false)

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const timeMin = new Date(y, m, 1).toISOString()
      const timeMax = new Date(y, m + 1, 0, 23, 59, 59).toISOString()
      const res = await fetch(`/api/calendar?timeMin=${timeMin}&timeMax=${timeMax}`)
      if (res.ok) setEvents(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  function prevMonth() {
    const y = month === 0 ? year - 1 : year
    const m = month === 0 ? 11 : month - 1
    setYear(y); setMonth(m); setSelectedDate(null); fetchEvents(y, m)
  }
  function nextMonth() {
    const y = month === 11 ? year + 1 : year
    const m = month === 11 ? 0 : month + 1
    setYear(y); setMonth(m); setSelectedDate(null); fetchEvents(y, m)
  }
  function goToday() {
    const [y, m] = today.split("-").map(Number)
    setYear(y); setMonth(m - 1); setSelectedDate(today); fetchEvents(y, m - 1)
  }

  async function handleDelete(id: string) {
    setConfirmingDelete(null)
    setDeleting(id)
    await fetch(`/api/calendar/${id}`, { method: "DELETE" })
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setDeleting(null)
  }

  // Build month grid
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ day: number | null; dateStr: string | null }> = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: null })
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    })
  }

  const eventsByDate: Record<string, CalEvent[]> = {}
  for (const e of events) {
    const d = eventDateKey(e)
    if (!eventsByDate[d]) eventsByDate[d] = []
    eventsByDate[d].push(e)
  }

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : []

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center gap-2">
        <button onClick={prevMonth} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600"><ChevronLeft size={18} /></button>
        <div className="flex-1 text-center">
          <h2 className="font-bold text-slate-900">{MONTHS[month]} {year}</h2>
          <p className="text-xs text-slate-400 mt-0.5" aria-live="polite">
            {loading ? "Loading…" : `${events.length} event${events.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={goToday} className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-medium">Today</button>
        <button onClick={nextMonth} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600"><ChevronRight size={18} /></button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>)}
      </div>

      {/* Calendar grid */}
      <div className={cn(
        "grid grid-cols-7 gap-px bg-slate-100 rounded-2xl overflow-hidden border border-slate-100 transition-opacity",
        loading && "opacity-60"
      )}>
        {cells.map((cell, i) => {
          if (!cell.dateStr) return <div key={`empty-${i}`} className="bg-slate-50 aspect-square" />
          const dayEvents = eventsByDate[cell.dateStr] ?? []
          const isToday    = cell.dateStr === today
          const isSelected = cell.dateStr === selectedDate
          return (
            <button
              key={cell.dateStr}
              onClick={() => setSelectedDate(cell.dateStr === selectedDate ? null : cell.dateStr)}
              aria-label={`${MONTHS[month]} ${cell.day}${isToday ? ", today" : ""}${
                dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length !== 1 ? "s" : ""}` : ""
              }`}
              aria-pressed={isSelected}
              className={cn("bg-white aspect-square flex flex-col items-center pt-1.5 gap-0.5 transition-colors",
                isSelected && "bg-indigo-50", !isSelected && "hover:bg-slate-50")}
            >
              <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                isToday ? "bg-indigo-600 text-white" : "text-slate-700")} aria-hidden="true">
                {cell.day}
              </span>
              <div className="flex items-center gap-0.5" aria-hidden="true">
                {dayEvents.slice(0, 3).map((e) => (
                  <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[8px] font-semibold text-slate-400 leading-none">+{dayEvents.length - 3}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected day */}
      {selectedDate && (
        <div className="bg-white rounded-2xl shadow-card-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </h3>
            {canManage && (
              <EventForm
                defaultDate={selectedDate ?? today}
                onCreated={() => fetchEvents(year, month)}
                defaultColor={myAvatarColor}
                avatarColors={avatarColors}
              />
            )}
          </div>

          {selectedEvents.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400">No events this day.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {selectedEvents.map((e) => (
                <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{e.title}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      {formatEventTime(e)}
                    </p>
                    {e.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{e.description}</p>}
                  </div>
                  {canManage && (
                    <div className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => setEditing(e)}
                        className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-indigo-500 transition-colors"
                        aria-label={`Edit "${e.title}"`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(e)}
                        disabled={deleting === e.id}
                        className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors"
                        aria-label={`Delete "${e.title}"`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add button when no date selected */}
      {!selectedDate && canManage && (
        <div className="flex justify-end">
          <EventForm
          defaultDate={today}
          onCreated={() => fetchEvents(year, month)}
          defaultColor={myAvatarColor}
          avatarColors={avatarColors}
        />
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmSheet
        open={!!confirmingDelete}
        title={confirmingDelete ? `Delete "${confirmingDelete.title}"?` : ""}
        message="It will be removed from the family calendar."
        confirmLabel="Delete"
        onConfirm={() => confirmingDelete && handleDelete(confirmingDelete.id)}
        onCancel={() => setConfirmingDelete(null)}
      />

      {/* Edit modal */}
      {editing && (
        <EventEditModal
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e))
            setEditing(null)
          }}
          onDeleted={(id) => {
            setEvents((prev) => prev.filter((e) => e.id !== id))
            setEditing(null)
          }}
          avatarColors={avatarColors}
        />
      )}
    </div>
  )
}
