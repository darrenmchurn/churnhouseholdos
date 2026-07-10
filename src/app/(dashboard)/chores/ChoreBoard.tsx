"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2, Trash2, Star, GripVertical,
  Pencil, RotateCcw, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChoreEditModal } from "./ChoreEditModal"
import { ConfirmSheet } from "@/components/ConfirmSheet"

type User = { id: string; name: string; avatarColor: string }
type Chore = {
  id: string
  title: string
  frequency: string
  pointValue: number
  dueBy: string | null
  lastCompleted: string | null
  completedById: string | null
  assignee:    { id: string; name: string; avatarColor: string } | null
  completedBy: { id: string; name: string; avatarColor: string } | null
}

const FREQ_DAYS: Record<string, number> = {
  DAILY: 1, WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30,
}

const FREQ_LABEL: Record<string, string> = {
  ONE_TIME: "One-time", DAILY: "Daily", WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly", MONTHLY: "Monthly",
}

function isDue(chore: Chore): boolean {
  if (chore.frequency === "ONE_TIME") return !chore.lastCompleted
  if (!chore.lastCompleted) return true
  const days = FREQ_DAYS[chore.frequency] ?? 7
  return Date.now() >= new Date(chore.lastCompleted).getTime() + days * 86_400_000
}

function lastCompletedLabel(date: string | null): string {
  if (!date) return "Never done"
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days}d ago`
}

// Only shows a badge when an explicit due date is actually set.
function getDueBadge(dueBy: string | null): { label: string; cls: string } | null {
  if (!dueBy) return null
  const nowMidnight = new Date(); nowMidnight.setHours(0, 0, 0, 0)
  const dueMidnight = new Date(dueBy); dueMidnight.setHours(0, 0, 0, 0)
  const diffDays = (dueMidnight.getTime() - nowMidnight.getTime()) / 86_400_000
  const label = new Date(dueBy).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "America/Chicago",
  })
  if (diffDays <= 0)  return { label: `Due ${label}`, cls: "bg-red-100 text-red-600" }
  if (diffDays <= 3)  return { label: `Due ${label}`, cls: "bg-amber-100 text-amber-700" }
  return               { label: `Due ${label}`, cls: "bg-emerald-100 text-emerald-700" }
}

// ─── Month-grouping helpers ───────────────────────────────────────────────────

// Works for both ISO strings and Date objects (Prisma returns Date at runtime)
function monthKey(lastCompleted: string | Date | null): string {
  if (!lastCompleted) return "unknown"
  const d = new Date(lastCompleted)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(key: string): string {
  if (key === "unknown") return "No date"
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function groupByMonth(chores: Chore[]): { key: string; label: string; items: Chore[] }[] {
  const map = new Map<string, Chore[]>()
  for (const c of chores) {
    const k = monthKey(c.lastCompleted)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(c)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))   // newest month first
    .map(([key, items]) => ({ key, label: monthLabel(key), items }))
}

// ─── Compact done row ─────────────────────────────────────────────────────────

function DoneChoreRow({
  chore, canManage, canUndo, undoing, onUndo, onEdit,
}: {
  chore: Chore
  canManage: boolean
  canUndo: boolean
  undoing: string | null
  onUndo: (id: string) => void
  onEdit: (chore: Chore) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 truncate">{chore.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {chore.completedBy && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span
                className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                style={{ backgroundColor: chore.completedBy.avatarColor }}
                aria-hidden="true"
              >{chore.completedBy.name[0]}</span>
              {chore.completedBy.name}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {lastCompletedLabel(chore.lastCompleted)}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-amber-500 ml-auto">
            <Star size={10} fill="currentColor" />{chore.pointValue}
          </span>
        </div>
      </div>
      {canManage && (
        <button
          onClick={() => onEdit(chore)}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-indigo-400 hover:bg-indigo-50 transition-colors flex-shrink-0"
          aria-label={`Edit ${chore.title}`}
        >
          <Pencil size={13} />
        </button>
      )}
      {canUndo && (
        <button
          onClick={() => onUndo(chore.id)}
          disabled={undoing === chore.id}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0 disabled:opacity-40"
          aria-label={`Undo ${chore.title}`}
        >
          <RotateCcw size={13} />
        </button>
      )}
    </div>
  )
}

// ─── Active sortable card (compact row layout) ────────────────────────────────

function SortableChoreCard({
  chore, canManage, canComplete, completing, deleting,
  onComplete, onDelete, onEdit,
}: {
  chore: Chore
  canManage: boolean
  canComplete: boolean
  completing: string | null
  deleting: string | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (chore: Chore) => void
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: chore.id, disabled: !canManage })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const color  = chore.assignee?.avatarColor ?? "#6366f1"
  const badge  = getDueBadge(chore.dueBy)
  const isCompleting = completing === chore.id

  // Surface urgency through the card background — not just the badge
  const urgencyBg =
    badge?.cls.includes("red")   ? "bg-red-50/60 border-l-[3px] border-red-400" :
    badge?.cls.includes("amber") ? "bg-amber-50/50 border-l-[3px] border-amber-400" :
    "bg-white"

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "rounded-2xl px-3 py-2.5 flex items-center gap-3 transition-all shadow-card active:scale-[0.98]",
        urgencyBg,
        isDragging && "shadow-card-lg scale-[1.02] opacity-95"
      )}
    >
      {/* ── Circle complete button ────────────────────────────────────────── */}
      <button
        onClick={() => canComplete && !isCompleting && onComplete(chore.id)}
        disabled={!canComplete || isCompleting}
        className={cn(
          "w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all duration-200",
          canComplete && !isCompleting && "hover:scale-[1.15] hover:shadow-card-md active:scale-90",
          !canComplete && "opacity-25 cursor-default"
        )}
        style={{
          borderColor: color,
          backgroundColor: isCompleting ? color : "transparent",
          boxShadow: isCompleting ? `0 0 14px 3px ${color}40` : undefined,
        }}
        aria-label={`Mark ${chore.title} done`}
      >
        {isCompleting && (
          <CheckCircle2 size={18} className="text-white" strokeWidth={2.5} />
        )}
      </button>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Title + actions */}
        <div className="flex items-center gap-1">
          <p className="flex-1 text-sm font-semibold text-slate-900 truncate">
            {chore.title}
          </p>
          {canManage && (
            <>
              <button
                onClick={() => onEdit(chore)}
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-indigo-400 transition-colors flex-shrink-0"
                aria-label="Edit chore"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => onDelete(chore.id)}
                disabled={deleting === chore.id}
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 disabled:opacity-40"
                aria-label="Delete chore"
              >
                <Trash2 size={12} />
              </button>
              <button
                {...listeners}
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
                aria-label="Drag to reorder"
                tabIndex={-1}
              >
                <GripVertical size={15} />
              </button>
            </>
          )}
        </div>

        {/* Meta row — single line, all inline */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-400">
            {FREQ_LABEL[chore.frequency] ?? chore.frequency}
          </span>
          <span className="text-slate-300 text-xs">·</span>
          <span className="flex items-center gap-0.5 text-xs text-amber-500">
            <Star size={10} fill="currentColor" />{chore.pointValue}
          </span>
          {badge && (
            <>
              <span className="text-slate-300 text-xs">·</span>
              <span className={cn("text-[10px] font-semibold px-1.5 py-px rounded-full", badge.cls)}>
                {badge.label}
              </span>
            </>
          )}
          {chore.lastCompleted && (
            <>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-xs text-slate-400">{lastCompletedLabel(chore.lastCompleted)}</span>
            </>
          )}
          {chore.assignee && (
            <span
              className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold ml-auto flex-shrink-0"
              style={{ backgroundColor: chore.assignee.avatarColor }}
              aria-hidden="true"
            >
              {chore.assignee.name[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sortable section ─────────────────────────────────────────────────────────

function SortableSection({
  items, canManage, userId, completing, deleting,
  onComplete, onDelete, onEdit, onReorder,
}: {
  items: Chore[]
  canManage: boolean
  userId: string
  completing: string | null
  deleting: string | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (chore: Chore) => void
  onReorder: (newItems: Chore[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((c) => c.id === active.id)
    const newIndex = items.findIndex((c) => c.id === over.id)
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {items.map((chore) => (
            <SortableChoreCard
              key={chore.id}
              chore={chore}
              canManage={canManage}
              canComplete={canManage || chore.assignee?.id === userId}
              completing={completing}
              deleting={deleting}
              onComplete={onComplete}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ─── Main board ───────────────────────────────────────────────────────────────

export function ChoreBoard({
  chores: initial, users, userId, canManage,
}: {
  chores: Chore[]
  users: User[]
  userId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [chores, setChores]         = useState(initial)
  const [completing, setCompleting] = useState<string | null>(null)
  const [undoing,    setUndoing]    = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [editingChore, setEditingChore] = useState<Chore | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<Chore | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showDone, setShowDone]     = useState(() => initial.filter((c) => !isDue(c)).length <= 2)
  // Only the most recent month starts expanded; others collapsed
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    const groups = groupByMonth(initial.filter((c) => !isDue(c)))
    return groups.length > 0 ? new Set([groups[0].key]) : new Set()
  })

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  useEffect(() => {
    setChores((prev) => {
      const existingIds = new Set(prev.map((c) => c.id))
      const newItems = initial.filter((c) => !existingIds.has(c.id))
      return newItems.length > 0 ? [...prev, ...newItems] : prev
    })
  }, [initial])

  const due  = chores.filter(isDue)
  const done = chores
    .filter((c) => !isDue(c))
    .sort((a, b) => {
      const aTime = a.lastCompleted ? new Date(a.lastCompleted).getTime() : 0
      const bTime = b.lastCompleted ? new Date(b.lastCompleted).getTime() : 0
      return bTime - aTime
    })

  // Family recap for the collapsed Completed header
  const thisMonthKey   = monthKey(new Date().toISOString())
  const doneThisMonth  = done.filter((c) => monthKey(c.lastCompleted) === thisMonthKey)
  const starsThisMonth = doneThisMonth.reduce((sum, c) => sum + c.pointValue, 0)

  function flashError(msg: string) {
    setActionError(msg)
    setTimeout(() => setActionError(null), 4000)
  }

  async function completeChore(id: string) {
    const snapshot = chores.find((c) => c.id === id)
    setCompleting(id)
    setShowDone(true)
    setExpandedMonths((prev) => new Set([...prev, monthKey(new Date().toISOString())]))
    setChores((prev) => prev.map((c) =>
      c.id === id ? { ...c, lastCompleted: new Date().toISOString(), completedById: userId } : c
    ))
    try {
      const res = await fetch(`/api/chores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      })
      if (!res.ok) {
        // Revert the optimistic completion — e.g. someone else finished it first (409)
        if (snapshot) setChores((prev) => prev.map((c) => (c.id === id ? snapshot : c)))
        flashError(res.status === 409 ? "Someone already completed that one!" : "Couldn't complete chore — try again")
      }
    } catch {
      if (snapshot) setChores((prev) => prev.map((c) => (c.id === id ? snapshot : c)))
      flashError("Couldn't complete chore — check your connection")
    }
    setCompleting(null)
    router.refresh()
  }

  async function undoChore(id: string) {
    const snapshot = chores.find((c) => c.id === id)
    setUndoing(id)
    setChores((prev) => prev.map((c) =>
      c.id === id ? { ...c, lastCompleted: null, completedById: null } : c
    ))
    try {
      const res = await fetch(`/api/chores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      })
      if (!res.ok) {
        if (snapshot) setChores((prev) => prev.map((c) => (c.id === id ? snapshot : c)))
        flashError("Couldn't undo — try again")
      }
    } catch {
      if (snapshot) setChores((prev) => prev.map((c) => (c.id === id ? snapshot : c)))
      flashError("Couldn't undo — check your connection")
    }
    setUndoing(null)
    router.refresh()
  }

  async function deleteChore(id: string) {
    setConfirmingDelete(null)
    setDeleting(id)
    setChores((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/chores/${id}`, { method: "DELETE" })
    setDeleting(null)
    router.refresh()
  }

  function handleSaved(updated: Chore & { lastCompleted: string | null }) {
    setChores((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setEditingChore(null)
  }

  function saveOrder(newDue: Chore[], newDone: Chore[]) {
    fetch("/api/chores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: [...newDue, ...newDone].map((c) => c.id) }),
    })
  }

  if (chores.length === 0) {
    return (
      <div className="text-center py-14 text-slate-400">
        <CheckCircle2 size={36} className="mx-auto mb-2 opacity-20" />
        <p className="text-sm">No chores yet</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">

        {/* ── Transient action error ─────────────────────────────────────── */}
        {actionError && (
          <div className="bg-amber-50 border-l-4 border-amber-400 rounded-2xl px-4 py-3 shadow-card" role="alert">
            <p className="text-sm font-medium text-amber-800">{actionError}</p>
          </div>
        )}

        {/* ── Active chores ──────────────────────────────────────────────── */}
        {due.length > 0 ? (
          <SortableSection
            items={due}
            canManage={canManage}
            userId={userId}
            completing={completing}
            deleting={deleting}
            onComplete={completeChore}
            onDelete={(id) => {
              const chore = chores.find((c) => c.id === id)
              if (chore) setConfirmingDelete(chore)
            }}
            onEdit={setEditingChore}
            onReorder={(newDue) => { setChores([...newDue, ...done]); saveOrder(newDue, done) }}
          />
        ) : (
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 rounded-2xl px-4 py-5 text-center border border-emerald-200/60 shadow-card">
            <p className="text-xl mb-1">🎉</p>
            <p className="text-sm font-bold text-emerald-700">All chores done!</p>
            <p className="text-xs text-emerald-600 mt-0.5 opacity-80">Nothing left to do right now.</p>
          </div>
        )}

        {/* ── Completed — collapsible, grouped by month ─────────────────── */}
        {done.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            {/* Outer header */}
            <button
              onClick={() => setShowDone((v) => !v)}
              className="w-full flex items-center gap-3 px-4 py-3"
              aria-expanded={showDone}
            >
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={12} className="text-emerald-600" />
              </div>
              <span className="flex-1 text-left">
                <span className="block text-sm font-semibold text-slate-700">Completed</span>
                {doneThisMonth.length > 0 && (
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {doneThisMonth.length} this month · {starsThisMonth} <Star size={9} className="inline text-amber-500 -mt-0.5" fill="currentColor" /> earned
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-400 mr-1">{done.length}</span>
              <ChevronDown
                size={14}
                className={cn("text-slate-400 transition-transform flex-shrink-0", showDone && "rotate-180")}
                aria-hidden="true"
              />
            </button>

            {/* Month sections */}
            {showDone && (
              <div className="border-t border-slate-100">
                {groupByMonth(done).map((group, i) => {
                  const isOpen = expandedMonths.has(group.key)
                  return (
                    <div key={group.key} className={cn(i > 0 && "border-t border-slate-100")}>
                      {/* Month header */}
                      <button
                        onClick={() => toggleMonth(group.key)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                        aria-expanded={isOpen}
                      >
                        <span className="flex-1 text-left text-xs font-semibold text-slate-500">
                          {group.label}
                        </span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          {group.items.length}
                        </span>
                        <ChevronDown
                          size={13}
                          className={cn("text-slate-300 transition-transform flex-shrink-0", isOpen && "rotate-180")}
                          aria-hidden="true"
                        />
                      </button>

                      {/* Chore rows for this month */}
                      {isOpen && (
                        <div className="divide-y divide-slate-50">
                          {group.items.map((chore) => (
                            <DoneChoreRow
                              key={chore.id}
                              chore={chore}
                              canManage={canManage}
                              canUndo={canManage || chore.completedById === userId}
                              undoing={undoing}
                              onUndo={undoChore}
                              onEdit={setEditingChore}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ChoreEditModal
        key={editingChore?.id ?? "none"}
        chore={editingChore}
        users={users}
        onClose={() => setEditingChore(null)}
        onSaved={handleSaved}
      />

      <ConfirmSheet
        open={!!confirmingDelete}
        title={confirmingDelete ? `Delete "${confirmingDelete.title}"?` : ""}
        message="Its completion history goes with it. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => confirmingDelete && deleteChore(confirmingDelete.id)}
        onCancel={() => setConfirmingDelete(null)}
      />
    </>
  )
}
