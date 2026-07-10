"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Pin, Plus, Trash2, Pencil } from "lucide-react"
import { chicagoToUTC, cn } from "@/lib/utils"
import { Modal } from "@/components/Modal"

type Announcement = {
  id: string
  title: string
  body: string
  expiresAt: string | null
  createdAt: string
  visibleToIds: string[]
  creator: { name: string; avatarColor: string }
}

type FamilyUser = { id: string; name: string; avatarColor: string }

/** Chip row for choosing who a note is for. Empty selection = everyone. */
function AudiencePicker({
  users, selected, onChange,
}: {
  users: FamilyUser[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const everyone = selected.length === 0

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id]
    // Hand-picking every member is the same as Everyone
    onChange(next.length === users.length ? [] : next)
  }

  const chipCls = (active: boolean) =>
    cn(
      "h-8 px-3 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5",
      active
        ? "bg-indigo-600 border-indigo-600 text-white"
        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
    )

  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange([])} className={chipCls(everyone)} aria-pressed={everyone}>
        Everyone
      </button>
      {users.map((u) => {
        const active = !everyone && selected.includes(u.id)
        return (
          <button key={u.id} type="button" onClick={() => toggle(u.id)} className={chipCls(active)} aria-pressed={active}>
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: u.avatarColor }}
              aria-hidden="true"
            />
            {u.name}
          </button>
        )
      })}
    </div>
  )
}

/** "Everyone" or a short name list for the note row meta line. */
function audienceLabel(visibleToIds: string[], users: FamilyUser[]): string {
  if (visibleToIds.length === 0) return "Everyone"
  const names = visibleToIds
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter(Boolean)
  return names.length > 0 ? names.join(", ") : "Everyone"
}

/** Convert a UTC ISO string back to Chicago-local date ("YYYY-MM-DD") and time ("HH:MM"). */
function utcToChicago(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  const h = get("hour") === "24" ? "00" : get("hour")
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${h}:${get("minute")}`,
  }
}

export function AnnouncementManager({ announcements, users }: { announcements: Announcement[]; users: FamilyUser[] }) {
  const router = useRouter()
  const [items, setItems] = useState<Announcement[]>(announcements)

  // ── Create form ──────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [expiresDate, setExpiresDate] = useState("")
  const [expiresTime, setExpiresTime] = useState("08:00")
  const [visibleTo, setVisibleTo] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // ── Edit modal ───────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [editExpiresDate, setEditExpiresDate] = useState("")
  const [editExpiresTime, setEditExpiresTime] = useState("08:00")
  const [editVisibleTo, setEditVisibleTo] = useState<string[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")

  function openEdit(a: Announcement) {
    setEditTitle(a.title)
    setEditBody(a.body)
    if (a.expiresAt) {
      const { date, time } = utcToChicago(a.expiresAt)
      setEditExpiresDate(date)
      setEditExpiresTime(time)
    } else {
      setEditExpiresDate("")
      setEditExpiresTime("08:00")
    }
    setEditVisibleTo(a.visibleToIds ?? [])
    setEditError("")
    setEditingId(a.id)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const expiresAt = expiresDate ? chicagoToUTC(expiresDate, expiresTime) : null
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, expiresAt, visibleToIds: visibleTo }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to post")
      }
      const created = await res.json()
      setItems((prev) => [created, ...prev])
      setTitle(""); setBody(""); setExpiresDate(""); setExpiresTime("08:00"); setVisibleTo([])
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setEditSaving(true)
    setEditError("")
    const expiresAt = editExpiresDate ? chicagoToUTC(editExpiresDate, editExpiresTime) : null
    try {
      const res = await fetch(`/api/announcements/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody, expiresAt, visibleToIds: editVisibleTo }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Save failed")
      }
      const updated = await res.json()
      setItems((prev) => prev.map((a) => (a.id === editingId ? updated : a)))
      setEditingId(null)
      router.refresh()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setEditSaving(false)
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
      {/* Create form */}
      {showForm ? (
        <form onSubmit={createAnnouncement} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-900 text-sm">New Note</p>
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
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Who can see it</label>
            <AudiencePicker users={users} selected={visibleTo} onChange={setVisibleTo} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Expires (optional)</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
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
            {saving ? "Posting…" : "Post to Board"}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full h-11 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-medium hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          New Note
        </button>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <Pin size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Nothing on the board yet</p>
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
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.body}</p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    By {a.creator.name}
                    {" · for "}
                    <span className={a.visibleToIds.length > 0 ? "font-semibold text-indigo-500" : undefined}>
                      {audienceLabel(a.visibleToIds, users)}
                    </span>
                    {a.expiresAt && !expired && (
                      <> · expires {new Date(a.expiresAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" })} at {new Date(a.expiresAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })}</>
                    )}
                  </p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(a)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteAnnouncement(a.id)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit Note"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Message *</label>
            <textarea
              required
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Who can see it</label>
            <AudiencePicker users={users} selected={editVisibleTo} onChange={setEditVisibleTo} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Expires (optional)</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={editExpiresDate}
                onChange={(e) => setEditExpiresDate(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="time"
                value={editExpiresTime}
                onChange={(e) => setEditExpiresTime(e.target.value)}
                disabled={!editExpiresDate}
                className="w-28 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
              />
            </div>
            {editExpiresDate && (
              <button
                type="button"
                onClick={() => { setEditExpiresDate(""); setEditExpiresTime("08:00") }}
                className="text-xs text-slate-400 hover:text-red-500 mt-1.5"
              >
                Clear expiry
              </button>
            )}
          </div>
          {editError && <p className="text-xs text-red-600 font-medium">{editError}</p>}
          <button
            type="submit"
            disabled={editSaving || !editTitle.trim() || !editBody.trim()}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {editSaving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </Modal>
    </div>
  )
}
