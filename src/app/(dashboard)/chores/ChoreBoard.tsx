"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Trash2, Star, GripVertical } from "lucide-react"
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
  ONE_TIME: "One-time",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
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
  if (days === 0) return "Done today"
  if (days === 1) return "Done yesterday"
  return `Done ${days}d ago`
}

// ─── Individual sortable card ────────────────────────────────────────────────

function SortableChoreCard({
  chore,
  overdue,
  canManage,
  canComplete,
  completing,
  deleting,
  onComplete,
  onDelete,
}: {
  chore: Chore
  overdue: boolean
  canManage: boolean
  canComplete: boolean
  completing: string | null
  deleting: string | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chore.id, disabled: !canManage })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const color = chore.assignee?.avatarColor ?? "#6366f1"

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "bg-white rounded-2xl border-2 p-4 flex gap-3 transition-shadow",
        overdue ? "border-slate-200" : "border-slate-100 opacity-60",
        isDragging && "shadow-xl opacity-80 scale-[1.01]"
      )}
    >
      {/* Drag handle — only rendered for admins/parents */}
      {canManage && (
        <button
          {...listeners}
          className="flex-shrink-0 touch-none text-slate-300 hover:text-slate-400 cursor-grab active:cursor-grabbing pt-0.5 self-start"
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <GripVertical size={16} />
        </button>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-2">

        {/* Title + delete */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            {overdue && (
              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-600 uppercase tracking-wide mt-0.5">
                Due
              </span>
            )}
            <p className="font-semibold text-slate-900 text-sm leading-snug">
              {chore.title}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => onDelete(chore.id)}
              disabled={deleting === chore.id}
              className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Meta chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {FREQ_LABEL[chore.frequency] ?? chore.frequency}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-amber-500">
            <Star size={11} fill="currentColor" />
            {chore.pointValue}
          </span>
          {chore.assignee && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <span
                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {chore.assignee.name[0]}
              </span>
              {chore.assignee.name}
            </span>
          )}
          <span className="text-xs text-slate-400">{lastCompletedLabel(chore.lastCompleted)}</span>
        </div>

        {/* Mark Done button — full width, only when due and user can complete */}
        {canComplete && overdue && (
          <button
            onClick={() => onComplete(chore.id)}
            disabled={completing === chore.id}
            className={cn(
              "w-full h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white transition-opacity",
              completing === chore.id && "opacity-50"
            )}
            style={{ backgroundColor: color }}
          >
            <CheckCircle2 size={16} />
            Mark Done
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sortable section (wraps one group in its own DnD context) ───────────────

function SortableSection({
  items,
  overdue,
  canManage,
  userId,
  completing,
  deleting,
  onComplete,
  onDelete,
  onReorder,
}: {
  items: Chore[]
  overdue: boolean
  canManage: boolean
  userId: string
  completing: string | null
  deleting: string | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onReorder: (newItems: Chore[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((c) => c.id === active.id)
    const newIndex = items.findIndex((c) => c.id === over.id)
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {items.map((chore) => (
            <SortableChoreCard
              key={chore.id}
              chore={chore}
              overdue={overdue}
              canManage={canManage}
              canComplete={canManage || chore.assignee?.id === userId}
              completing={completing}
              deleting={deleting}
              onComplete={onComplete}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ─── Main board ──────────────────────────────────────────────────────────────

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

  function saveOrder(newDue: Chore[], newDone: Chore[]) {
    const order = [...newDue, ...newDone].map((c) => c.id)
    fetch("/api/chores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    })
  }

  function handleDueReorder(newDue: Chore[]) {
    setChores([...newDue, ...done])
    saveOrder(newDue, done)
  }

  function handleDoneReorder(newDone: Chore[]) {
    setChores([...due, ...newDone])
    saveOrder(due, newDone)
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
    <div className="space-y-6">
      {due.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Needs Doing · {due.length}
          </h2>
          <SortableSection
            items={due}
            overdue={true}
            canManage={canManage}
            userId={userId}
            completing={completing}
            deleting={deleting}
            onComplete={completeChore}
            onDelete={deleteChore}
            onReorder={handleDueReorder}
          />
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            All Good · {done.length}
          </h2>
          <SortableSection
            items={done}
            overdue={false}
            canManage={canManage}
            userId={userId}
            completing={completing}
            deleting={deleting}
            onComplete={completeChore}
            onDelete={deleteChore}
            onReorder={handleDoneReorder}
          />
        </div>
      )}
    </div>
  )
}
