"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

type User = { id: string; name: string; role: string; avatarColor: string }

const ROLE_EMOJI: Record<string, string> = {
  ADMIN: "👨",
  PARENT: "👩",
  CHILD: "🧒",
  KIOSK: "📺",
}

export function LoginForm({ users }: { users: User[] }) {
  const [selected, setSelected] = useState<User | null>(null)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return

    setLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        name: selected.name,
        password,
        redirect: false,
      })

      setLoading(false)

      if (result?.error) {
        setError("Wrong password. Try again.")
        setPassword("")
      } else {
        // Hard redirect ensures the browser sends the fresh session cookie
        window.location.href = "/dashboard"
      }
    } catch {
      setLoading(false)
      setError("Sign-in failed. Please try again.")
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      {/* User picker */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => {
              setSelected(user)
              setPassword("")
              setError("")
            }}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
              selected?.id === user.id
                ? "border-indigo-500 bg-indigo-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
              style={{ backgroundColor: user.avatarColor + "33" }}
            >
              {ROLE_EMOJI[user.role] ?? "👤"}
            </div>
            <span className="font-semibold text-slate-800 text-sm">{user.name}</span>
          </button>
        ))}
      </div>

      {/* Password input — only shown after selecting a user */}
      {selected && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Password for{" "}
              <span className="text-indigo-600">{selected.name}</span>
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-300 text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      )}
    </div>
  )
}
