"use client"

import { useState } from "react"
import { Trophy, ShoppingBag, Clock, Plus, Trash2, Star } from "lucide-react"
import { cn, avatarTextColor } from "@/lib/utils"
import { Modal } from "@/components/Modal"

type Prize = { id: string; title: string; description: string | null; pointCost: number; emoji: string }
type LeaderEntry = { id: string; name: string; avatarColor: string; role: string; balance: number; earnedMonth: number; totalSpent: number }
type Redemption = { id: string; userName: string; avatarColor: string; prizeTitle: string; prizeEmoji: string; pointsSpent: number; createdAt: string }

type Props = {
  prizes: Prize[]
  leaderboard: LeaderEntry[]
  recentRedemptions: Redemption[]
  myUserId: string
  myBalance: number
  isAdmin: boolean
}

type Tab = "store" | "leaderboard" | "feed"

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

export function PrizesClient({ prizes: initial, leaderboard, recentRedemptions: initialFeed, myUserId, myBalance: initialBalance, isAdmin }: Props) {
  const [tab, setTab]                 = useState<Tab>("store")
  const [prizes, setPrizes]           = useState(initial)
  const [feed, setFeed]               = useState(initialFeed)
  const [balance, setBalance]         = useState(initialBalance)
  const [redeeming, setRedeeming]     = useState<string | null>(null)
  const [redeemError, setRedeemError] = useState<Record<string, string>>({})

  // Admin: new prize form
  const [showAddPrize, setShowAddPrize] = useState(false)
  const [newTitle, setNewTitle]         = useState("")
  const [newDesc, setNewDesc]           = useState("")
  const [newCost, setNewCost]           = useState("")
  const [newEmoji, setNewEmoji]         = useState("🎁")
  const [addingPrize, setAddingPrize]   = useState(false)

  async function redeemPrize(prize: Prize) {
    setRedeeming(prize.id)
    setRedeemError((e) => ({ ...e, [prize.id]: "" }))
    try {
      const res = await fetch(`/api/prizes/${prize.id}/redeem`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setBalance((b) => b - prize.pointCost)
      setFeed((f) => [{
        id: data.id,
        userName: data.user.name,
        avatarColor: data.user.avatarColor,
        prizeTitle: data.prize.title,
        prizeEmoji: data.prize.emoji,
        pointsSpent: prize.pointCost,
        createdAt: new Date().toISOString(),
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
      const res = await fetch("/api/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc || undefined, pointCost: Number(newCost), emoji: newEmoji }),
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

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "store",       label: "Store",       icon: ShoppingBag },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy      },
    { id: "feed",        label: "Feed",        icon: Clock       },
  ]

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Prizes</h1>
          <p className="text-slate-500 text-sm mt-0.5">Earn points by completing chores</p>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2">
          <Star size={16} className="text-amber-500" fill="currentColor" />
          <span className="font-bold text-amber-700 text-lg leading-none">{balance}</span>
          <span className="text-xs text-amber-600 font-medium">pts</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-sm font-medium transition-all",
              tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── STORE ── */}
      {tab === "store" && (
        <div className="space-y-3">
          {isAdmin && (
            <button
              onClick={() => setShowAddPrize(true)}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border-2 border-dashed border-indigo-300 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition-colors"
            >
              <Plus size={16} /> Add Prize
            </button>
          )}

          {prizes.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No prizes yet</p>
              {isAdmin && <p className="text-xs mt-1">Add one above to get started</p>}
            </div>
          )}

          {prizes.map((prize) => {
            const canAfford = balance >= prize.pointCost
            const isRedeeming = redeeming === prize.id
            return (
              <div key={prize.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl flex-shrink-0">
                  {prize.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{prize.title}</p>
                  {prize.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{prize.description}</p>}
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={11} className="text-amber-500" fill="currentColor" />
                    <span className="text-xs font-bold text-amber-600">{prize.pointCost} pts</span>
                  </div>
                  {redeemError[prize.id] && (
                    <p className="text-xs text-red-500 mt-0.5">{redeemError[prize.id]}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => redeemPrize(prize)}
                    disabled={!canAfford || isRedeeming}
                    className={cn(
                      "h-9 px-4 rounded-xl text-sm font-semibold transition-all",
                      canAfford
                        ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    {isRedeeming ? "…" : canAfford ? "Redeem" : "Need more"}
                  </button>
                  {isAdmin && (
                    <button onClick={() => deletePrize(prize.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── LEADERBOARD ── */}
      {tab === "leaderboard" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">
            <span>This Month</span>
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
                <p className="text-[10px] text-slate-400">{MONTH_NAME}</p>
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
            <p className="text-center text-slate-400 text-sm py-8">No points earned yet. Complete chores to get started!</p>
          )}
        </div>
      )}

      {/* ── FEED ── */}
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
                  <span className="text-xs text-amber-600 font-medium">{r.pointsSpent} pts · {timeAgo(r.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Prize Modal */}
      <Modal open={showAddPrize} onClose={() => setShowAddPrize(false)} title="New Prize">
        <form onSubmit={addPrize} className="space-y-4">
          <div className="flex gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Emoji</label>
              <input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)}
                className="w-16 h-11 text-center text-2xl rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
              <input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Movie night"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Point cost *</label>
            <input required type="number" min={1} value={newCost} onChange={(e) => setNewCost(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Description</label>
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Optional details…" />
          </div>
          <button type="submit" disabled={addingPrize || !newTitle || !newCost}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50">
            {addingPrize ? "Adding…" : "Add Prize"}
          </button>
        </form>
      </Modal>
    </div>
  )
}
