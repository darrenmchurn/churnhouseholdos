"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type Member = {
  name: string
  password: string
  role: "ADMIN" | "PARENT" | "CHILD" | "KIOSK"
  avatarColor: string
}

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#f97316",
]

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin (Full access)" },
  { value: "PARENT", label: "Parent" },
  { value: "CHILD", label: "Child" },
  { value: "KIOSK", label: "Kiosk (Display mode)" },
]

const DEFAULT_MEMBERS: Member[] = [
  { name: "Dad", password: "", role: "ADMIN", avatarColor: "#6366f1" },
  { name: "Mom", password: "", role: "PARENT", avatarColor: "#8b5cf6" },
  { name: "Kid", password: "", role: "CHILD", avatarColor: "#10b981" },
  { name: "Kiosk", password: "kiosk", role: "KIOSK", avatarColor: "#f59e0b" },
]

export function SetupForm() {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function updateMember(index: number, updates: Partial<Member>) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...updates } : m)))
  }

  function addMember() {
    setMembers((prev) => [
      ...prev,
      {
        name: "",
        password: "",
        role: "CHILD",
        avatarColor: AVATAR_COLORS[prev.length % AVATAR_COLORS.length],
      },
    ])
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Setup failed")
      }

      router.push("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {members.map((member, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: member.avatarColor }}
              >
                {member.name[0]?.toUpperCase() ?? "?"}
              </div>
              <span className="font-semibold text-slate-700 text-sm">Member {i + 1}</span>
            </div>
            {members.length > 1 && (
              <button
                type="button"
                onClick={() => removeMember(i)}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Name</label>
              <input
                type="text"
                required
                value={member.name}
                onChange={(e) => updateMember(i, { name: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Role</label>
              <select
                value={member.role}
                onChange={(e) => updateMember(i, { role: e.target.value as Member["role"] })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Password</label>
            <input
              type="password"
              required
              value={member.password}
              onChange={(e) => updateMember(i, { password: e.target.value })}
              placeholder={member.role === "KIOSK" ? "Simple PIN recommended" : "Family password"}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Color</label>
            <div className="flex gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateMember(i, { avatarColor: color })}
                  className={cn(
                    "w-7 h-7 rounded-full transition-transform",
                    member.avatarColor === color && "scale-125 ring-2 ring-offset-1 ring-slate-400"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addMember}
        className="w-full h-11 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-medium hover:border-indigo-300 hover:text-indigo-500 transition-colors"
      >
        + Add family member
      </button>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-base disabled:opacity-50"
      >
        {loading ? "Creating accounts…" : "Create Churn Household OS"}
      </button>
    </form>
  )
}
