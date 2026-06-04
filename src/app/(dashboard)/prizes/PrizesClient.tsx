"use client"

import { useState } from "react"
import { Trophy, ShoppingBag, Clock, Plus, Trash2, Star, Pencil } from "lucide-react"
import { cn, avatarTextColor } from "@/lib/utils"
import { Modal } from "@/components/Modal"

type Prize = {
  id: string
  title: string
  description: string | null
  pointCost: number
  emoji: string
}
type LeaderEntry = {
  id: string
  name: string
  avatarColor: string
  role: string
  balance: number
  earnedMonth: number
  totalSpent: number
}
type Redemption = {
  id: string
  userName: string
  avatarColor: string
  prizeTitle: string
  prizeEmoji: string
  pointsSpent: number
  createdAt: string
}

type Props = {
  prizes: Prize[]
  leaderboard: LeaderEntry[]
  recentRedemptions: Redemption[]
  myUserId: string
  myBalance: number
  isAdmin: boolean
}

type Tab = "store" | "leaderboard" | "feed"

// ─── Tier definitions ────────────────────────────────────────────────────────

const TIER_MILESTONES = [
  {
    pts: 25, label: "Bronze", emoji: "🥉",
    barColor: "bg-amber-400", textColor: "text-amber-700",
    bgColor: "bg-amber-50", borderColor: "border-amber-200",
  },
  {
    pts: 75, label: "Silver", emoji: "🥈",
    barColor: "bg-slate-400", textColor: "text-slate-600",
    bgColor: "bg-slate-50", borderColor: "border-slate-200",
  },
  {
    pts: 200, label: "Gold", emoji: "🥇",
    barColor: "bg-yellow-400", textColor: "text-yellow-700",
    bgColor: "bg-yellow-50", borderColor: "border-yellow-200",
  },
]

const TIER_BUCKETS = [
  {
    key: "bronze", label: "Bronze", emoji: "🥉", minCost: 1, maxCost: 50,
    sectionBg: "bg-amber-50/60", headerText: "text-amber-800", borderColor: "border-amber-200",
    tagBg: "bg-amber-100", tagText: "text-amber-700",
  },
  {
    key: "silver", label: "Silver", emoji: "🥈", minCost: 51, maxCost: 150,
    sectionBg: "bg-slate-50", headerText: "text-slate-700", borderColor: "border-slate-200",
    tagBg: "bg-slate-100", tagText: "text-slate-600",
  },
  {
    key: "gold", label: "Gold", emoji: "🥇", minCost: 151, maxCost: Infinity,
    sectionBg: "bg-yellow-50/60", headerText: "text-yellow-800", borderColor: "border-yellow-200",
    tagBg: "bg-yellow-100", tagText: "text-yellow-700",
  },
]

function getBucketForCost(cost: number) {
  return TIER_BUCKETS.find((b) => cost >= b.minCost && cost <= b.maxCost) ?? TIER_BUCKETS[2]
}

function getTierProgress(balance: number) {
  const reached = TIER_MILESTONES.filter((m) => balance >= m.pts)
  const current = reached.at(-1) ?? null
  const nextIdx = current
    ? TIER_MILESTONES.findIndex((m) => m.label === current.label) + 1
    : 0
  const next = TIER_MILESTONES[nextIdx] ?? null
  if (!next) return { current, next: null, pct: 100, needed: 0, segPct: [100, 100, 100] }

  const from = current?.pts ?? 0
  const pct  = Math.min(100, Math.round(((balance - from) / (next.pts - from)) * 100))

  // Fill for each of the 3 segments independently
  const segPct = TIER_MILESTONES.map((_m, i) => {
    const segFrom = i === 0 ? 0 : TIER_MILESTONES[i - 1].pts
    const segTo   = TIER_MILESTONES[i].pts
    return Math.min(100, Math.max(0, Math.round(((balance - segFrom) / (segTo - segFrom)) * 100)))
  })

  return { current, next, pct, needed: next.pts - balance, segPct }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const MONTH_NAME = new Date().toLocaleDateString("en-US", { month: "long" })

// ─── Component ───────────────────────────────────────────────────────────────

export function PrizesClient({
  prizes: initial,
  leaderboard,
  recentRedemptions: initialFeed,
  myUserId,
  myBalance: initialBalance,
  isAdmin,
}: Props) {
  const [tab, setTab]                 = useState<Tab>("store")
  const [prizes, setPrizes]           = useState(initial)
  const [feed, setFeed]               = useState(initialFeed)
  const [balance, setBalance]         = useState(initialBalance)
  const [redeeming, setRedeeming]     = useState<string | null>(null)
  const [redeemError, setRedeemError] = useState<Record<string, string>>({})
  const [seeding, setSeeding]         = useState(false)

  // Add prize
  const [showAddPrize, setShowAddPrize] = useState(false)
  const [newTitle, setNewTitle]         = useState("")
  const [newDesc, setNewDesc]           = useState("")
  const [newCost, setNewCost]           = useState("")
  const [newEmoji, setNewEmoji]         = useState("🎁")
  const [addingPrize, setAddingPrize]   = useState(false)

  // Edit prize
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null)
  const [editTitle, setEditTitle]       = useState("")
  const [editDesc, setEditDesc]         = useState("")
  const [editCost, setEditCost]         = useState("")
  const [editEmoji, setEditEmoji]       = useState("🎁")
  const [editSaving, setEditSaving]     = useState(false)

  const progress = getTierProgress(balance)

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function redeemPrize(prize: Prize) {
    setRedeeming(prize.id)
    setRedeemError((e) => ({ ...e, [prize.id]: "" }))
    try {
      const res  = await fetch(`/api/prizes/${prize.id}/redeem`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setBalance((b) => b - prize.pointCost)
      setFeed((f) => [{
        id:          data.id,
        userName:    data.user.name,
        avatarColor: data.user.avatarColor,
        prizeTitle:  data.prize.title,
        prizeEmoji:  data.prize.emoji,
        pointsSpent: prize.pointCost,
        createdAt:   new Date().toISOString(),
      }, ...f])
    } catch (err) {
      setRedeemError((e) => ({ ...e, [prize.id]: err instanceof Error ? err.message : "Error" }))
    } finally {
      setRedeeming(null)
    }
  }

  async function deletePrize(id: string) {
    await fetch(`/api/prizes/${id}`, { method: "DELETE" })
    setPrizes((p) => p.filter((x) => x.id !== id))
  }

  async function addPrize(e: React.FormEvent) {
    e.preventDefault()
    setAddingPrize(true)
    try {
      const res  = await fetch("/api/prizes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: newTitle, description: newDesc || undefined, pointCost: Number(newCost), emoji: newEmoji }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPrizes((p) => [...p, data].sort((a, b) => a.pointCost - b.pointCost))
      setNewTitle(""); setNewDesc(""); setNewCost(""); setNewEmoji("🎁")
      setShowAddPrize(false)
    } finally {
      setAddingPrize(false)
    }
  }

  function openEdit(prize: Prize) {
    setEditTitle(prize.title)
    setEditDesc(prize.description ?? "")
    setEditCost(String(prize.pointCost))
    setEditEmoji(prize.emoji)
    setEditingPrize(prize)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPrize) return
    setEditSaving(true)
    try {
      const res  = await fetch(`/api/prizes/${editingPrize.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: editTitle, description: editDesc || null, pointCost: Number(editCost), emoji: editEmoji }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPrizes((p) => p.map((x) => x.id === editingPrize.id ? data : x).sort((a, b) => a.pointCost - b.pointCost))
      setEditingPrize(null)
    } finally {
      setEditSaving(false)
    }
  }

  async function seedDefaults() {
    setSeeding(true)
    try {
      await fetch("/api/prizes/seed", { method: "POST" })
      const res  = await fetch("/api/prizes")
      const data = await res.json()
      setPrizes(data)
    } finally {
      setSeeding(false)
    }
  }

  // ── Layout ──────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "store",       label: "Store",       icon: ShoppingBag },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy      },
    { id: "feed",        label: "Feed",        icon: Clock       },
  ]

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto space-y-4">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Prizes</h1>
        <p className="text-slate-500 text-sm mt-0.5">Earn stars by completing chores, redeem for rewards</p>
      </div>

      {/* ── Tier Progress Card ── */}
      <div className="bg-gradient-to-br from-white via-white to-indigo-50/40 rounded-2xl p-5 space-y-3 shadow-card-lg">
        {/* Balance row */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <Star size={20} className="text-amber-500 self-center" fill="currentColor" />
            <span className="text-3xl font-bold text-slate-900 leading-none">{balance}</span>
            <span className="text-sm text-slate-500">stars</span>
          </div>
          <div className="text-right">
            {progress.current ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xl">{progress.current.emoji}</span>
                <span className={cn("text-sm font-bold", progress.current.textColor)}>{progress.current.label}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-medium">No tier yet</span>
            )}
          </div>
        </div>

        {/* Segmented progress track */}
        <div>
          <div className="flex gap-1">
            {TIER_MILESTONES.map((m, i) => (
              <div key={m.label} className="flex-1 space-y-1">
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", m.barColor)}
                    style={{ width: `${progress.segPct[i]}%` }}
                  />
                </div>
                <div className="flex justify-end pr-0.5">
                  <span className="text-[9px] text-slate-400">{m.emoji} {m.pts}⭐</span>
                </div>
              </div>
            ))}
          </div>

          {/* Next milestone text */}
          {progress.next ? (
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-slate-700">{progress.needed} more ⭐</span>
              {" "}to unlock {progress.next.emoji} {progress.next.label} rewards
            </p>
          ) : (
            <p className="text-xs font-semibold text-yellow-700 mt-1">🥇 Max tier reached!</p>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-sm font-medium transition-all",
              tab === id ? "bg-white text-slate-900 shadow-card-md font-semibold" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ STORE ══ */}
      {tab === "store" && (
        <div className="space-y-4">
          {/* Admin actions */}
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddPrize(true)}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl border-2 border-dashed border-indigo-300 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition-colors"
              >
                <Plus size={16} /> Add Prize
              </button>
            </div>
          )}

          {/* First-run: seed defaults */}
          {isAdmin && prizes.length === 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 text-center space-y-3">
              <p className="text-sm font-semibold text-indigo-900">No prizes yet</p>
              <p className="text-xs text-indigo-700">Load the recommended starter prizes based on your chore tiers?</p>
              <div className="text-xs text-indigo-600 space-y-0.5">
                <p>🥉 Bronze (25 ⭐): Choose a TV Episode · Extra Screen Time</p>
                <p>🥈 Silver (75 ⭐): Late Night Pass · Pick Dinner Night</p>
                <p>🥇 Gold (200 ⭐): Movie Night · Eat Out</p>
              </div>
              <button
                onClick={seedDefaults}
                disabled={seeding}
                className="h-10 px-6 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {seeding ? "Loading…" : "Load Default Prizes"}
              </button>
            </div>
          )}

          {/* Empty for non-admin */}
          {!isAdmin && prizes.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No prizes available yet</p>
            </div>
          )}

          {/* Prizes grouped by tier */}
          {TIER_BUCKETS.map((bucket) => {
            const bucketPrizes = prizes.filter(
              (p) => p.pointCost >= bucket.minCost && p.pointCost <= bucket.maxCost
            )
            if (bucketPrizes.length === 0) return null
            return (
              <div key={bucket.key} className="space-y-2">
                {/* Tier header */}
                <div className={cn("rounded-xl px-4 py-2.5 flex items-center gap-2", bucket.sectionBg)}>
                  <span className="text-lg">{bucket.emoji}</span>
                  <span className={cn("font-bold text-sm", bucket.headerText)}>{bucket.label} Tier</span>
                  <span className={cn("ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full", bucket.tagBg, bucket.tagText)}>
                    {bucketPrizes[0].pointCost === bucketPrizes.at(-1)?.pointCost
                      ? `${bucketPrizes[0].pointCost} ⭐`
                      : `${bucketPrizes[0].pointCost}–${bucketPrizes.at(-1)?.pointCost} ⭐`}
                  </span>
                </div>

                {/* Prize cards */}
                {bucketPrizes.map((prize) => {
                  const canAfford  = balance >= prize.pointCost
                  const isRedeeming = redeeming === prize.id
                  return (
                    <div key={prize.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-card-md">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100/80 flex items-center justify-center text-2xl flex-shrink-0">
                        {prize.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{prize.title}</p>
                        {prize.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{prize.description}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Star size={11} className="text-amber-500" fill="currentColor" />
                          <span className="text-xs font-bold text-amber-600">{prize.pointCost} ⭐</span>
                          {!canAfford && (
                            <span className="text-xs text-slate-400 ml-1">
                              · need {prize.pointCost - balance} more ⭐
                            </span>
                          )}
                        </div>
                        {redeemError[prize.id] && (
                          <p className="text-xs text-red-500 mt-0.5">{redeemError[prize.id]}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => redeemPrize(prize)}
                          disabled={!canAfford || !!isRedeeming}
                          className={cn(
                            "h-9 px-4 rounded-xl text-sm font-semibold transition-all",
                            canAfford
                              ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          )}
                        >
                          {isRedeeming ? "…" : canAfford ? "Redeem" : "Locked"}
                        </button>
                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(prize)}
                              className="text-slate-300 hover:text-indigo-400 transition-colors"
                              aria-label="Edit prize"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => deletePrize(prize.id)}
                              className="text-slate-300 hover:text-red-400 transition-colors"
                              aria-label="Delete prize"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ LEADERBOARD ══ */}
      {tab === "leaderboard" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-12">
            <span>{MONTH_NAME}</span>
            <span>Balance</span>
            <span>Spent</span>
          </div>
          {leaderboard.map((u, i) => (
            <div
              key={u.id}
              className={cn(
                "bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3",
                u.id === myUserId && "border-indigo-300 bg-indigo-50/40"
              )}
            >
              <span className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                i === 0 ? "bg-amber-400 text-white" :
                i === 1 ? "bg-slate-300 text-white" :
                i === 2 ? "bg-orange-300 text-white" : "bg-slate-100 text-slate-500"
              )}>
                {i + 1}
              </span>
              <div
                className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0", avatarTextColor(u.avatarColor))}
                style={{ backgroundColor: u.avatarColor }}
              >
                {u.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">
                  {u.name} {u.id === myUserId && <span className="text-slate-400 font-normal text-xs">(you)</span>}
                </p>
                {/* Tier badge */}
                {(() => {
                  const tier = [...TIER_MILESTONES].reverse().find((m) => u.balance >= m.pts)
                  return tier ? (
                    <span className={cn("text-[10px] font-semibold", tier.textColor)}>
                      {tier.emoji} {tier.label}
                    </span>
                  ) : <span className="text-[10px] text-slate-400">No tier yet</span>
                })()}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center flex-shrink-0">
                <div>
                  <p className="font-bold text-green-600 text-sm">{u.earnedMonth}</p>
                </div>
                <div>
                  <p className="font-bold text-indigo-600 text-sm">{u.balance}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 text-sm">{u.totalSpent}</p>
                </div>
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">
              No stars earned yet. Complete chores to get started!
            </p>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ FEED ══ */}
      {tab === "feed" && (
        <div className="space-y-2">
          {feed.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">No redemptions yet. Be the first!</p>
          )}
          {feed.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div
                className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0", avatarTextColor(r.avatarColor))}
                style={{ backgroundColor: r.avatarColor }}
              >
                {r.userName[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900">
                  <span className="font-semibold">{r.userName}</span> redeemed{" "}
                  <span className="font-semibold">{r.prizeEmoji} {r.prizeTitle}</span>
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={10} className="text-amber-500" fill="currentColor" />
                  <span className="text-xs text-amber-600 font-medium">{r.pointsSpent} ⭐</span>
                  <span className="text-xs text-slate-400">· {timeAgo(r.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Prize Modal ── */}
      <Modal open={showAddPrize} onClose={() => setShowAddPrize(false)} title="New Prize">
        <form onSubmit={addPrize} className="space-y-4">
          <div className="flex gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Emoji</label>
              <input
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                className="w-16 h-11 text-center text-2xl rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Movie Night"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Point Cost *</label>
            <input
              required
              type="number"
              min={1}
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              placeholder="e.g. 25"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              1–50 ⭐ = 🥉 Bronze · 51–150 ⭐ = 🥈 Silver · 151+ ⭐ = 🥇 Gold
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Description</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              placeholder="Optional details…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={addingPrize || !newTitle || !newCost}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {addingPrize ? "Adding…" : "Add Prize"}
          </button>
        </form>
      </Modal>

      {/* ── Edit Prize Modal ── */}
      <Modal open={!!editingPrize} onClose={() => setEditingPrize(null)} title="Edit Prize">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="flex gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Emoji</label>
              <input
                value={editEmoji}
                onChange={(e) => setEditEmoji(e.target.value)}
                className="w-16 h-11 text-center text-2xl rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
              <input
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Point Cost *</label>
            <input
              required
              type="number"
              min={1}
              value={editCost}
              onChange={(e) => setEditCost(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              1–50 ⭐ = 🥉 Bronze · 51–150 ⭐ = 🥈 Silver · 151+ ⭐ = 🥇 Gold
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Description</label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={editSaving || !editTitle || !editCost}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {editSaving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </Modal>
    </div>
  )
}
