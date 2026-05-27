"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Trash2, Star } from "lucide-react"
import { cn } from "@/lib/utils"

type Assignee = { id: string; name: string; avatarColor: string }
type Chore = {
  id: string
  title: string
  frequency: string
  pointValue: number
  lastCompleted: string | null
  assignee: Assignee | null
}

const FREQ_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
}

const FREQ_LABEL: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
}

function isDue(chore: Chore): boolean {
  if (!chore.lastCompleted) return true
  const days = FREQ_DAYS[chore.frequency] ?? 7
  const nextDue = new Date(chore.lastCompleted).getTime() + days * 86400000
  return Date.now() >= nextDue
}

function lastCompletedLabel(date: string | null): string {
  if (!date) return "Never done"
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (days === 0) return "Done today"
  if (days === 1) return "Done yesterday"
  return `Done ${days}d ago`
}

export function ChoreBoard({
  chores: initial,
  userId,
  canManage,
}: {
  chores: Chore[]
  userId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [chores, setChores] = useState(initial)
  const [completing, setCompleting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const due = chores.filter(isDue)
  const done = chores.filter((c) => !isDue(c))

  async function completeChore(id: string) {
    setCompleting(id)
    setChores((prev) =>
      prev.map((c) => (c.id === id ? { ...c, lastCompleted: new Date().toISOString() } : c))
    )
    await fetch(`/api/chores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    })
    setCompleting(null)
    router.refresh()
  }

  async function deleteChore(id: string) {
    setDeleting(id)
    setChores((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/chores/${id}`, { method: "DELETE" })
    setDeleting(null)
    router.refresh()
  }

  function canComplete(chore: Chore) {
    if (canManage) return true
    return chore.assignee?.id === userId
  }

  function renderCard(chore: Chore, overdue: boolean) {
    const color = chore.assignee?.avatarColor ?? "#6366f1"
    return (
      <div
        key={chore.id}
        className={cn(
          "bg-white rounded-2xl border-2 p-4 flex flex-col gap-3 transition-opacity",
          overdue ? "border-slate-200" : "border-slate-100 opacity-70"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {overdue && (
              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-600 uppercase tracking-wide">
                Due
              </span>
            )}
            <p className="font-semibold text-slate-900 text-sm leading-snug truncate">
              {chore.title}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => deleteChore(chore.id)}
              disabled={deleting === chore.id}
              className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {FREQ_LABEL[chore.frequency]}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-amber-500">
            <Star size={11} fill="currentColor" />
            {chore.pointValue}
          </span>
          {chore.assignee && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span
                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold"
                style={{ backgroundColor: color }}
              >
                {chore.assignee.name[0]}
              </span>
              {chore.assignee.name}
            </span>
          )}
        </div>

        {/* Last completed */}
        <p className="text-xs text-slate-400">{lastCompletedLabel(chore.lastCompleted)}</p>

        {/* Complete button */}
        {canComplete(chore) && overdue && (
          <button
            onClick={() => completeChore(chore.id)}
            disabled={completing === chore.id}
            className={cn(
              "w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white transition-opacity",
              completing === chore.id && "opacity-50"
            )}
            style={{ backgroundColor: color }}
          >
            <CheckCircle2 size={18} />
            Mark Done
          </button>
        )}
      </div>
    )
  }

  if (chores.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <CheckCircle2 size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No chores yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {due.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Needs Doing · {due.length}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {due.map((c) => renderCard(c, true))}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            All Good · {done.length}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {done.map((c) => renderCard(c, false))}
          </div>
        </div>
      )}
    </div>
  )
}
