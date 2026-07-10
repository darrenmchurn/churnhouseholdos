"use client"

import { useState } from "react"
import { Trophy, ShoppingBag, Clock, Plus, Trash2, Star, Pencil } from "lucide-react"
import { cn, avatarTextColor, relTime } from "@/lib/utils"
import { Modal } from "@/components/Modal"
import { ConfirmSheet } from "@/components/ConfirmSheet"

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
  const [confirmingRedeem, setConfirmingRedeem] = useState<Prize | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<Prize | null>(null)

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
      setConfirmingRedeem(null)
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
    setConfirmingDelete(null)
    setPrizes((p) => p.filter((x) => x.id !== id))
    await fetch(`/api/prizes/${id}`, { method: "DELETE" })
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
      <div className="bg-gradient-to-br from-white via-indigo-50/20 to-indigo-100/40 rounded-2xl p-5 space-y-3 shadow-card-lg border border-indigo-100/50">
        {/* Balance row */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <Star size={20} className="text-amber-500 self-center" fill="currentColor" />
            <span className="text-3xl font-bold text-slate-900 leading-none">{balance}</span>
            <span className="text-sm text-slate-500">stars</span>
          </div>
          <div className="text-right">
            {progress.current ? (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center shadow-card flex-shrink-0">
                  <span className="text-lg leading-none">{progress.current.emoji}</span>
                </div>
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
                <div className="h-2.5 rounded-full bg-slate-200/70 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", m.barColor)}
                    style={{ width: `${progress.segPct[i]}%` }}
                  />
                </div>
                <div className="flex justify-end pr-0.5">
                  <span className="text-[9px] text-slate-400">{m.emoji} {m.pts}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Next milestone text */}
          {progress.next ? (
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-slate-700">{progress.needed} more stars</span>
              {" "}to unlock {progress.next.label} rewards
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

          {/* Seed defaults — a proper empty state when the store is empty;
              once prizes exist it shrinks to a quiet link at the bottom */}
          {isAdmin && prizes.length === 0 && (
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-2.5">
              <div>
                <p className="text-sm font-semibold text-indigo-900">No prizes yet</p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  Load the starter set — 22 prizes across Bronze, Silver, and Gold tiers.
                </p>
              </div>
              <button
                onClick={seedDefaults}
                disabled={seeding}
                className="h-9 px-5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {seeding ? "Adding…" : "Load Default Prizes"}
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
                  <span className={cn("ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1", bucket.tagBg, bucket.tagText)}>
                    <Star size={9} fill="currentColor" />
                    {bucketPrizes[0].pointCost === bucketPrizes.at(-1)?.pointCost
                      ? bucketPrizes[0].pointCost
                      : `${bucketPrizes[0].pointCost}–${bucketPrizes.at(-1)?.pointCost}`}
                  </span>
                </div>

                {/* Prize cards */}
                {bucketPrizes.map((prize) => {
                  const canAfford  = balance >= prize.pointCost
                  const isRedeeming = redeeming === prize.id
                  return (
                    <div key={prize.id} className={cn(
                      "bg-white rounded-2xl p-4 flex items-center gap-4 shadow-card-md",
                      bucket.key === "bronze" ? "border-l-[3px] border-amber-400" :
                      bucket.key === "silver" ? "border-l-[3px] border-slate-400" :
                      "border-l-[3px] border-yellow-400"
                    )}>
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
                          <span className="text-xs font-bold text-amber-600">{prize.pointCost}</span>
                          {!canAfford && (
                            <span className="text-xs text-slate-400 ml-1">
                              · need {prize.pointCost - balance} more
                            </span>
                          )}
                        </div>
                        {redeemError[prize.id] && (
                          <p className="text-xs text-red-500 mt-0.5">{redeemError[prize.id]}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setConfirmingRedeem(prize)}
                          disabled={!canAfford || !!isRedeeming}
                          className={cn(
                            "h-9 px-4 rounded-xl text-sm font-semibold transition-all",
                            canAfford
                              ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                              : "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
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
                              onClick={() => setConfirmingDelete(prize)}
                              className="w-8 h-8 -m-2 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors"
                              aria-label={`Delete ${prize.title}`}
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

          {/* Quiet admin utility — replaces the old always-visible defaults panel */}
          {isAdmin && prizes.length > 0 && (
            <button
              onClick={seedDefaults}
              disabled={seeding}
              className="w-full py-2 text-center text-xs text-slate-400 hover:text-indigo-500 transition-colors disabled:opacity-50"
            >
              {seeding ? "Adding missing defaults…" : "Restore missing default prizes"}
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ LEADERBOARD ══ */}
      {tab === "leaderboard" && (
        <div className="space-y-2">
          {leaderboard.map((u, i) => {
            const tier = [...TIER_MILESTONES].reverse().find((m) => u.balance >= m.pts)
            return (
            <div
              key={u.id}
              className={cn(
                "bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-card",
                u.id === myUserId
                  ? "border border-indigo-300 bg-gradient-to-r from-indigo-50/60 to-transparent shadow-card-md"
                  : ""
              )}
            >
              {/* Rank badge */}
              <span className={cn(
                "flex items-center justify-center font-bold flex-shrink-0 transition-all",
                i === 0
                  ? "w-8 h-8 rounded-xl text-base bg-gradient-to-br from-amber-400 to-amber-500 text-white scale-110"
                  : i === 1
                  ? "w-7 h-7 rounded-xl text-sm bg-gradient-to-br from-slate-400 to-slate-500 text-white"
                  : i === 2
                  ? "w-7 h-7 rounded-xl text-sm bg-gradient-to-br from-orange-400 to-orange-500 text-white"
                  : "w-6 h-6 rounded-lg text-xs bg-slate-100 text-slate-500"
              )}
              style={i === 0 ? { boxShadow: "0 2px 8px rgba(245,158,11,.40)" } :
                     i === 1 ? { boxShadow: "0 2px 6px rgba(100,116,139,.30)" } :
                     i === 2 ? { boxShadow: "0 2px 6px rgba(249,115,22,.30)" } : undefined}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>

              {/* Avatar */}
              <div
                className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0", avatarTextColor(u.avatarColor))}
                style={{ backgroundColor: u.avatarColor }}
              >
                {u.name[0].toUpperCase()}
              </div>

              {/* Name + secondary stats */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">
                  {u.name}
                  {u.id === myUserId && (
                    <span className="text-slate-400 font-normal text-xs ml-1">(you)</span>
                  )}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {tier ? (
                    <span className={cn("text-[10px] font-semibold", tier.textColor)}>
                      {tier.emoji} {tier.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">No tier</span>
                  )}
                  {u.earnedMonth > 0 && (
                    <>
                      <span className="text-slate-300 text-[10px]">·</span>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        +{u.earnedMonth} in {MONTH_NAME}
                      </span>
                    </>
                  )}
                  {u.totalSpent > 0 && (
                    <>
                      <span className="text-slate-300 text-[10px]">·</span>
                      <span className="text-[10px] text-slate-400">
                        {u.totalSpent} spent
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Star balance — the primary ranking metric, displayed prominently */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star size={13} className="text-amber-500" fill="currentColor" />
                <span className="text-base font-extrabold text-slate-900 leading-none">
                  {u.balance}
                </span>
              </div>
            </div>
            )
          })}
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
            <div key={r.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-card">
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
                  <span className="text-xs text-amber-600 font-medium">{r.pointsSpent}</span>
                  <span className="text-xs text-slate-400">· {relTime(r.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Redeem confirmation ── */}
      <ConfirmSheet
        open={!!confirmingRedeem}
        title={confirmingRedeem ? `Redeem ${confirmingRedeem.emoji} ${confirmingRedeem.title}?` : ""}
        message={confirmingRedeem ? `This will spend ${confirmingRedeem.pointCost} of your ${balance} stars.` : undefined}
        confirmLabel="Redeem"
        tone="primary"
        busy={!!redeeming}
        onConfirm={() => confirmingRedeem && redeemPrize(confirmingRedeem)}
        onCancel={() => setConfirmingRedeem(null)}
      />

      {/* ── Delete prize confirmation ── */}
      <ConfirmSheet
        open={!!confirmingDelete}
        title={confirmingDelete ? `Delete "${confirmingDelete.title}"?` : ""}
        message="It will disappear from the store for everyone."
        confirmLabel="Delete"
        onConfirm={() => confirmingDelete && deletePrize(confirmingDelete.id)}
        onCancel={() => setConfirmingDelete(null)}
      />

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
              1–50 stars = Bronze · 51–150 = Silver · 151+ = Gold
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
              1–50 stars = Bronze · 51–150 = Silver · 151+ = Gold
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
