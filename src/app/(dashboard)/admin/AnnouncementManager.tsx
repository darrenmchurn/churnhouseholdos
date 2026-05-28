"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Megaphone, Plus, Trash2 } from "lucide-react"
import { chicagoToUTC } from "@/lib/utils"

type Announcement = {
  id: string
  title: string
  body: string
  expiresAt: string | null
  createdAt: string
  creator: { name: string; avatarColor: string }
}

export function AnnouncementManager({ announcements }: { announcements: Announcement[] }) {
  const router = useRouter()
  const [items, setItems] = useState<Announcement[]>(announcements)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [expiresDate, setExpiresDate] = useState("")
  const [expiresTime, setExpiresTime] = useState("08:00")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function handleDateChange(d: string) {
    setExpiresDate(d)
    // Only reset time to 08:00 when a date is first picked (time still at default)
    // If user already changed the time, leave it alone — we just update the date part.
  }

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")

    const expiresAt = expiresDate ? chicagoToUTC(expiresDate, expiresTime) : null

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, expiresAt }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to post")
      }
      const created = await res.json()
      setItems((prev) => [created, ...prev])
      setTitle("")
      setBody("")
      setExpiresDate("")
      setExpiresTime("08:00")
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  async function deleteAnnouncement(id: string) {
    setItems((prev) => prev.filter((a) => a.id !== id))
    try {
      await fetch(`/api/announcements/${id}`, { method: "DELETE" })
    } catch {}
    router.refresh()
  }

  const now = new Date().toISOString()

  return (
    <div className="space-y-3">
      {/* Add form */}
      {showForm ? (
        <form onSubmit={createAnnouncement} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-900 text-sm">New Announcement</p>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. School closed tomorrow"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Message *</label>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Details…"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Expires (optional)</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={expiresDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="time"
                value={expiresTime}
                onChange={(e) => setExpiresTime(e.target.value)}
                disabled={!expiresDate}
                className="w-28 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          <button
            type="submit"
            disabled={saving || !title.trim() || !body.trim()}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {saving ? "Posting…" : "Post Announcement"}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full h-11 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-medium hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          New Announcement
        </button>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <Megaphone size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const expired = a.expiresAt && a.expiresAt < now
            return (
              <div
                key={a.id}
                className={`bg-white rounded-2xl border p-4 flex gap-3 ${expired ? "border-slate-200 opacity-50" : "border-indigo-100"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-slate-900 text-sm">{a.title}</p>
                    {expired && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Expired
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{a.body}</p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    By {a.creator.name}
                    {a.expiresAt && !expired && (
                      <> · expires {new Date(a.expiresAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" })} at {new Date(a.expiresAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })}</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => deleteAnnouncement(a.id)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 self-start"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
