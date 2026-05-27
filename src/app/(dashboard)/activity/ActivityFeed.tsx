"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  CheckSquare,
  Sparkles,
  ShoppingCart,
  CalendarDays,
  Megaphone,
  Loader2,
} from "lucide-react"

type LogEntry = {
  id: string
  action: string
  entity: string
  entityTitle: string
  createdAt: string
  user: { name: string; avatarColor: string }
}

const ENTITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "task", label: "Tasks" },
  { value: "chore", label: "Chores" },
  { value: "grocery", label: "Grocery" },
  { value: "event", label: "Calendar" },
  { value: "announcement", label: "Posts" },
]

const ENTITY_META: Record<string, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  task:         { icon: CheckSquare, bg: "bg-blue-50",   text: "text-blue-600",   label: "Task" },
  chore:        { icon: Sparkles,    bg: "bg-yellow-50", text: "text-yellow-600", label: "Chore" },
  grocery:      { icon: ShoppingCart,bg: "bg-pink-50",   text: "text-pink-600",   label: "Grocery" },
  event:        { icon: CalendarDays,bg: "bg-green-50",  text: "text-green-600",  label: "Calendar" },
  announcement: { icon: Megaphone,   bg: "bg-indigo-50", text: "text-indigo-600", label: "Announcement" },
}

const ACTION_LABELS: Record<string, { verb: string; color: string }> = {
  created:     { verb: "created",       color: "text-emerald-600" },
  completed:   { verb: "completed",     color: "text-blue-600" },
  checked_off: { verb: "checked off",   color: "text-blue-600" },
  unchecked:   { verb: "unchecked",     color: "text-slate-500" },
  updated:     { verb: "updated",       color: "text-amber-600" },
  deleted:     { verb: "deleted",       color: "text-red-500" },
  added:       { verb: "added",         color: "text-emerald-600" },
  cleared:     { verb: "cleared",       color: "text-red-500" },
  posted:      { verb: "posted",        color: "text-indigo-600" },
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

export function ActivityFeed({
  initialLogs,
  initialCursor,
}: {
  initialLogs: LogEntry[]
  initialCursor: string | null
}) {
  const [filter, setFilter] = useState("all")
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [filteredCursor, setFilteredCursor] = useState<string | null>(initialCursor)
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[] | null>(null) // null = use server data

  // When filter changes, fetch fresh data for that entity
  const applyFilter = useCallback(async (entity: string) => {
    setFilter(entity)
    if (entity === "all") {
      setFilteredLogs(null)
      setFilteredCursor(initialCursor)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/activity?entity=${entity}`)
      const data = await res.json()
      setFilteredLogs(data.logs)
      setFilteredCursor(data.nextCursor)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [initialCursor])

  async function loadMore() {
    const c = filter === "all" ? cursor : filteredCursor
    if (!c) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ cursor: c })
      if (filter !== "all") params.set("entity", filter)
      const res = await fetch(`/api/activity?${params}`)
      const data = await res.json()
      if (filter === "all") {
        setLogs((prev) => [...prev, ...data.logs])
        setCursor(data.nextCursor)
      } else {
        setFilteredLogs((prev) => [...(prev ?? []), ...data.logs])
        setFilteredCursor(data.nextCursor)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const displayLogs = filteredLogs !== null ? filteredLogs : logs
  const hasMore = filter === "all" ? !!cursor : !!filteredCursor

  // Group by calendar date
  const groups: { dateKey: string; entries: LogEntry[] }[] = []
  for (const log of displayLogs) {
    const dateKey = new Date(log.createdAt).toDateString()
    const last = groups[groups.length - 1]
    if (last?.dateKey === dateKey) {
      last.entries.push(log)
    } else {
      groups.push({ dateKey, entries: [log] })
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => applyFilter(f.value)}
            className={cn(
              "flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-colors",
              filter === f.value
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {displayLogs.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">No activity yet</p>
          <p className="text-xs text-slate-400 mt-1">Actions across the household will appear here</p>
        </div>
      )}

      {/* Timeline */}
      {groups.map(({ dateKey, entries }) => (
        <div key={dateKey}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
            {formatDateHeader(entries[0].createdAt)}
          </p>
          <div className="space-y-2">
            {entries.map((log) => {
              const meta = ENTITY_META[log.entity] ?? ENTITY_META.task
              const actionMeta = ACTION_LABELS[log.action] ?? { verb: log.action, color: "text-slate-600" }
              const Icon = meta.icon

              return (
                <div key={log.id} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                  {/* User avatar */}
                  <div
                    className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: log.user.avatarColor }}
                  >
                    {log.user.name[0].toUpperCase()}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 leading-snug">
                      <span className="font-semibold">{log.user.name}</span>
                      {" "}
                      <span className={cn("font-medium", actionMeta.color)}>{actionMeta.verb}</span>
                      {" "}
                      <span className="text-slate-600 truncate">"{log.entityTitle}"</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", meta.bg)}>
                        <Icon size={11} className={meta.text} />
                      </div>
                      <span className="text-xs text-slate-400">{meta.label}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{formatRelativeTime(log.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full h-11 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Loading…" : "Load older activity"}
        </button>
      )}
    </div>
  )
}
