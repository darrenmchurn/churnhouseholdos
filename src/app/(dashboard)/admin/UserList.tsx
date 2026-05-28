"use client"

import { useState } from "react"
import { ROLE_LABELS, ROLE_COLORS, avatarTextColor } from "@/lib/utils"
import { UserEditor } from "./UserEditor"

type User = {
  id: string
  name: string
  role: string
  avatarColor: string
  createdAt: string
}

type Props = {
  users: User[]
  currentUserId: string
  isAdmin: boolean
}

export function UserList({ users: initial, currentUserId, isAdmin }: Props) {
  const [users, setUsers] = useState<User[]>(initial)

  function handleSaved(updated: { id: string; name: string; role: string; avatarColor: string }) {
    setUsers((prev) =>
      prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
    )
  }

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <div
          key={user.id}
          className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3"
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${avatarTextColor(user.avatarColor)}${user.avatarColor === "#ffffff" ? " ring-1 ring-slate-200" : ""}`}
            style={{ backgroundColor: user.avatarColor }}
          >
            {user.name[0].toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
              {user.id === currentUserId && (
                <span className="text-[10px] font-medium text-slate-400">(you)</span>
              )}
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <p className="text-xs text-slate-400 hidden sm:block">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
            {isAdmin && (
              <UserEditor
                user={user}
                currentAdminId={currentUserId}
                onSaved={handleSaved}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
