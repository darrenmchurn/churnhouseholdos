"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Circle, Trash2, CalendarDays, Flag } from "lucide-react"
import { cn } from "@/lib/utils"

type Assignee = { id: string; name: string; avatarColor: string }
type Task = {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  priority: "LOW" | "MEDIUM" | "HIGH"
  completed: boolean
  assignee: Assignee | null
  creator: { id: string; name: string }
}

const PRIORITY_DOT: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-green-500",
}

const PRIORITY_LABEL: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
}

type Filter = "active" | "mine" | "done"

export function TaskList({
  tasks: initial,
  userId,
  canManage,
}: {
  tasks: Task[]
  userId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initial)
  const [filter, setFilter] = useState<Filter>("active")
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = tasks.filter((t) => {
    if (filter === "active") return !t.completed
    if (filter === "mine") return !t.completed && t.assignee?.id === userId
    if (filter === "done") return t.completed
    return true
  })

  async function toggleComplete(task: Task) {
    setToggling(task.id)
    const next = !task.completed
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t))
    )
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: next }),
    })
    setToggling(null)
    router.refresh()
  }

  async function deleteTask(id: string) {
    setDeleting(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    setDeleting(null)
    router.refresh()
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "mine", label: "Mine" },
    { key: "done", label: "Done" },
  ]

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "flex-1 h-8 rounded-lg text-sm font-medium transition-colors",
              filter === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CheckCircle2 size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {filter === "done" ? "No completed tasks" : "No tasks here"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div
              key={task.id}
              className={cn(
                "bg-white rounded-2xl border border-slate-200 p-4 flex gap-3",
                task.completed && "opacity-60"
              )}
            >
              {/* Complete toggle */}
              <button
                onClick={() => toggleComplete(task)}
                disabled={toggling === task.id}
                className="flex-shrink-0 mt-0.5 text-slate-300 hover:text-indigo-500 transition-colors"
              >
                {task.completed ? (
                  <CheckCircle2 size={22} className="text-indigo-500" />
                ) : (
                  <Circle size={22} />
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p className={cn(
                    "font-medium text-slate-900 text-sm leading-snug flex-1",
                    task.completed && "line-through text-slate-400"
                  )}>
                    {task.title}
                  </p>
                  <span className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0 mt-1.5",
                    PRIORITY_DOT[task.priority]
                  )} title={PRIORITY_LABEL[task.priority]} />
                </div>

                {task.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
                )}

                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {task.dueDate && (
                    <span className={cn(
                      "flex items-center gap-1 text-xs",
                      new Date(task.dueDate) < new Date() && !task.completed
                        ? "text-red-500 font-medium"
                        : "text-slate-400"
                    )}>
                      <CalendarDays size={11} />
                      {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {task.assignee && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <span
                        className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ backgroundColor: task.assignee.avatarColor }}
                      >
                        {task.assignee.name[0]}
                      </span>
                      {task.assignee.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              {canManage && (
                <button
                  onClick={() => deleteTask(task.id)}
                  disabled={deleting === task.id}
                  className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
