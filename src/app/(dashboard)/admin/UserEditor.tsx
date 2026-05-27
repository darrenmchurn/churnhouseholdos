"use client"

import { useState } from "react"
import { Modal } from "@/components/Modal"
import { cn } from "@/lib/utils"
import { Eye, EyeOff, Pencil } from "lucide-react"

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#f97316",
  "#06b6d4", "#84cc16", "#a855f7", "#14b8a6",
]

const ROLES = [
  { value: "ADMIN",  label: "Admin",  desc: "Full access"         },
  { value: "PARENT", label: "Parent", desc: "Manage + view all"   },
  { value: "CHILD",  label: "Child",  desc: "Own tasks & chores"  },
  { value: "KIOSK",  label: "Kiosk",  desc: "Display-only mode"   },
]

type User = {
  id: string
  name: string
  role: string
  avatarColor: string
}

type Props = {
  user: User
  currentAdminId: string
  onSaved: (updated: User) => void
}

export function UserEditor({ user, currentAdminId, onSaved }: Props) {
  const [open, setOpen]             = useState(false)
  const [name, setName]             = useState(user.name)
  const [avatarColor, setColor]     = useState(user.avatarColor)
  const [role, setRole]             = useState(user.role)
  const [newPw, setNewPw]           = useState("")
  const [confirmPw, setConfirmPw]   = useState("")
  const [showPw, setShowPw]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState<{ ok: boolean; text: string } | null>(null)

  const isSelf = user.id === currentAdminId
  const pwMismatch = !!newPw && newPw !== confirmPw

  function openModal() {
    // Reset to current saved values each time
    setName(user.name)
    setColor(user.avatarColor)
    setRole(user.role)
    setNewPw("")
    setConfirmPw("")
    setMsg(null)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (pwMismatch) return
    setSaving(true)
    setMsg(null)

    try {
      const body: Record<string, string> = { name, avatarColor, role }
      if (newPw) body.newPassword = newPw

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")

      setMsg({ ok: true, text: "Saved!" })
      onSaved(data)
      setTimeout(() => setOpen(false), 800)
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
      >
        <Pencil size={12} />
        Edit
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Edit ${user.name}`}>
        <form onSubmit={handleSave} className="space-y-5">

          {/* Avatar preview + name */}
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm"
              style={{ backgroundColor: avatarColor }}
            >
              {name[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs font-medium text-slate-600 block mb-1">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Avatar colour */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">Avatar colour</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    avatarColor === c && "scale-125 ring-2 ring-offset-1 ring-slate-400"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">
              Role
              {isSelf && (
                <span className="ml-2 text-amber-600 font-normal">(this is you — changing your own role will take effect on next login)</span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={cn(
                    "flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all",
                    role === r.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span className={cn(
                    "text-sm font-semibold",
                    role === r.value ? "text-indigo-700" : "text-slate-800"
                  )}>
                    {r.label}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Password reset */}
          <div className="border-t border-slate-100 pt-4">
            <label className="text-xs font-medium text-slate-600 block mb-2">
              Reset password <span className="text-slate-400 font-normal">(leave blank to keep current)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="New password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full h-10 px-3 pr-9 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <input
                type={showPw ? "text" : "password"}
                placeholder="Confirm"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className={cn(
                  "w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500",
                  pwMismatch ? "border-red-300 focus:ring-red-400" : "border-slate-200"
                )}
              />
            </div>
            {pwMismatch && (
              <p className="text-xs text-red-500 mt-1">Passwords don&apos;t match</p>
            )}
          </div>

          {msg && (
            <p className={cn("text-sm font-medium", msg.ok ? "text-green-600" : "text-red-600")}>
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || pwMismatch}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </Modal>
    </>
  )
}
