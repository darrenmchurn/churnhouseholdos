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

// Only show a due-date badge when an explicit date is actually set.
// A missing due date is not an error — don't flag it in red.
function getDueBadge(dueBy: string | null): { label: string; cls: string } | null {
  if (!dueBy) return null

  const nowMidnight = new Date()
  nowMidnight.setHours(0, 0, 0, 0)
  const dueMidnight = new Date(dueBy)
  dueMidnight.setHours(0, 0, 0, 0)
  const diffDays = (dueMidnight.getTime() - nowMidnight.getTime()) / 86_400_000

  const label = new Date(dueBy).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "America/Chicago",
  })

  if (diffDays <= 0)  return { label, cls: "bg-red-100 text-red-600" }
  if (diffDays <= 3)  return { label, cls: "bg-amber-100 text-amber-700" }
  return               { label, cls: "bg-emerald-100 text-emerald-700" }
}

// ─── Compact done row (for history section) ───────────────────────────────────

function DoneChoreRow({
  chore,
  canUndo,
  undoing,
  onUndo,
}: {
  chore: Chore
  canUndo: boolean
  undoing: string | null
  onUndo: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[3rem]">
      <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 truncate">{chore.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {chore.completedBy && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span
                className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                style={{ backgroundColor: chore.completedBy.avatarColor }}
                aria-hidden="true"
              >
                {chore.completedBy.name[0]}
              </span>
              {chore.completedBy.name}
            </span>
          )}
          <span className="text-xs text-slate-400">{lastCompletedLabel(chore.lastCompleted)}</span>
          <span className="flex items-center gap-0.5 text-xs text-amber-500">
            <Star size={10} fill="currentColor" />
            {chore.pointValue}
          </span>
        </div>
      </div>
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

// ─── Active sortable card ─────────────────────────────────────────────────────

function SortableChoreCard({
  chore,
  canManage,
  canComplete,
  completing,
  deleting,
  onComplete,
  onDelete,
  onEdit,
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
  const color = chore.assignee?.avatarColor ?? "#6366f1"
  const badge = getDueBadge(chore.dueBy)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "bg-white rounded-2xl p-4 flex gap-3 transition-all shadow-card-md",
        isDragging && "shadow-card-lg scale-[1.02] opacity-95"
      )}
    >
      {/* Drag handle */}
      {canManage && (
        <button
          {...listeners}
          className="flex-shrink-0 touch-none text-slate-200 hover:text-slate-400 cursor-grab active:cursor-grabbing pt-0.5 self-start"
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <GripVertical size={16} />
        </button>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-2.5">

        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm leading-snug">
              {chore.title}
            </p>
            {/* Only render badge when an actual due date is set */}
            {badge && (
              <span className={cn("inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 tracking-wide", badge.cls)}>
                Due {badge.label}
              </span>
            )}
          </div>
          {canManage && (
            <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
              <button
                onClick={() => onEdit(chore)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-indigo-400 hover:bg-indigo-50 transition-colors"
                aria-label="Edit chore"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onDelete(chore.id)}
                disabled={deleting === chore.id}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                aria-label="Delete chore"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {FREQ_LABEL[chore.frequency] ?? chore.frequency}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-amber-500">
            <Star size={10} fill="currentColor" />
            {chore.pointValue}
          </span>
          {chore.lastCompleted ? (
            <span className="text-xs text-slate-400">{lastCompletedLabel(chore.lastCompleted)}</span>
          ) : (
            <span className="text-xs text-slate-400">Never done</span>
          )}
          {chore.assignee && (
            <span className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
              <span
                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold"
                style={{ backgroundColor: chore.assignee.avatarColor }}
                aria-hidden="true"
              >
                {chore.assignee.name[0]}
              </span>
              {chore.assignee.name}
            </span>
          )}
        </div>

        {/* Mark Done — only when the user can complete this chore */}
        {canComplete && (
          <button
            onClick={() => onComplete(chore.id)}
            disabled={completing === chore.id}
            className={cn(
              "w-full h-9 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all active:scale-[0.98]",
              completing === chore.id && "opacity-60"
            )}
            style={{ backgroundColor: color }}
          >
            <CheckCircle2 size={15} />
            {completing === chore.id ? "Marking…" : "Mark Done"}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sortable section (due chores only) ──────────────────────────────────────

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
        <div className="space-y-2.5">
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
  const [chores, setChores]   = useState(initial)
  const [completing, setCompleting] = useState<string | null>(null)
  const [undoing,    setUndoing]    = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [editingChore, setEditingChore] = useState<Chore | null>(null)
  const [showDone, setShowDone] = useState(() => initial.filter((c) => !isDue(c)).length <= 2)

  useEffect(() => {
    setChores((prev) => {
      const existingIds = new Set(prev.map((c) => c.id))
      const newItems = initial.filter((c) => !existingIds.has(c.id))
      return newItems.length > 0 ? [...prev, ...newItems] : prev
    })
  }, [initial])

  const due  = chores.filter(isDue)
  const done = chores.filter((c) => !isDue(c))

  async function completeChore(id: string) {
    setCompleting(id)
    setChores((prev) => prev.map((c) =>
      c.id === id ? { ...c, lastCompleted: new Date().toISOString(), completedById: userId } : c
    ))
    await fetch(`/api/chores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    })
    setCompleting(null)
    router.refresh()
  }

  async function undoChore(id: string) {
    setUndoing(id)
    setChores((prev) => prev.map((c) =>
      c.id === id ? { ...c, lastCompleted: null, completedById: null } : c
    ))
    await fetch(`/api/chores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ undo: true }),
    })
    setUndoing(null)
    router.refresh()
  }

  async function deleteChore(id: string) {
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
      <div className="space-y-5">

        {/* ── Active chores ── */}
        {due.length > 0 ? (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
              To Do · {due.length}
            </p>
            <SortableSection
              items={due}
              canManage={canManage}
              userId={userId}
              completing={completing}
              deleting={deleting}
              onComplete={completeChore}
              onDelete={deleteChore}
              onEdit={setEditingChore}
              onReorder={(newDue) => { setChores([...newDue, ...done]); saveOrder(newDue, done) }}
            />
          </div>
        ) : (
          /* All done state */
          <div className="bg-emerald-50 rounded-2xl px-4 py-5 text-center">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-sm font-semibold text-emerald-800">All chores done!</p>
            <p className="text-xs text-emerald-600 mt-0.5">Nothing left to do right now.</p>
          </div>
        )}

        {/* ── Completed history — collapsible summary card ── */}
        {done.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            {/* Header — always visible */}
            <button
              onClick={() => setShowDone((v) => !v)}
              className="w-full flex items-center gap-3 px-4 py-3.5"
              aria-expanded={showDone}
            >
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={13} className="text-emerald-600" />
              </div>
              <span className="flex-1 text-left text-sm font-semibold text-slate-700">
                All Good
              </span>
              <span className="text-xs font-medium text-slate-400 mr-1">{done.length} done</span>
              <ChevronDown
                size={15}
                className={cn("text-slate-400 transition-transform flex-shrink-0", showDone && "rotate-180")}
                aria-hidden="true"
              />
            </button>

            {/* Compact history rows */}
            {showDone && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {done.map((chore) => (
                  <DoneChoreRow
                    key={chore.id}
                    chore={chore}
                    canUndo={canManage || chore.completedById === userId}
                    undoing={undoing}
                    onUndo={undoChore}
                  />
                ))}
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
    </>
  )
}
