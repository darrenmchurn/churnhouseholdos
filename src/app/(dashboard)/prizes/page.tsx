export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { PrizesClient } from "./PrizesClient"

export default async function PrizesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "KIOSK") redirect("/dashboard")

  const userId  = session.user.id
  const isAdmin = session.user.role === "ADMIN"

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [prizes, leaderboardData, recentRedemptions, myBalance] = await Promise.all([
    prisma.prize.findMany({
      where: { active: true },
      orderBy: { pointCost: "asc" },
    }),
    // All users with point stats
    prisma.user.findMany({
      where: { role: { not: "KIOSK" } },
      select: { id: true, name: true, avatarColor: true, role: true },
    }),
    prisma.redemption.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user:  { select: { name: true, avatarColor: true } },
        prize: { select: { title: true, emoji: true } },
      },
    }),
    prisma.pointTransaction.aggregate({
      where: { userId },
      _sum: { points: true },
    }),
  ])

  // Point stats for leaderboard
  const [allTimeAgg, monthAgg, spentAgg] = await Promise.all([
    prisma.pointTransaction.groupBy({ by: ["userId"], _sum: { points: true } }),
    prisma.pointTransaction.groupBy({
      by: ["userId"],
      where: { points: { gt: 0 }, createdAt: { gte: monthStart } },
      _sum: { points: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["userId"],
      where: { points: { lt: 0 } },
      _sum: { points: true },
    }),
  ])

  const balMap   = Object.fromEntries(allTimeAgg.map((r) => [r.userId, r._sum.points ?? 0]))
  const monMap   = Object.fromEntries(monthAgg.map((r) => [r.userId, r._sum.points ?? 0]))
  const spentMap = Object.fromEntries(spentAgg.map((r) => [r.userId, Math.abs(r._sum.points ?? 0)]))

  const leaderboard = leaderboardData
    .map((u) => ({
      id:          u.id,
      name:        u.name,
      avatarColor: u.avatarColor,
      role:        u.role,
      balance:     balMap[u.id]   ?? 0,
      earnedMonth: monMap[u.id]   ?? 0,
      totalSpent:  spentMap[u.id] ?? 0,
    }))
    .sort((a, b) => b.balance - a.balance)

  return (
    <PrizesClient
      prizes={prizes}
      leaderboard={leaderboard}
      recentRedemptions={recentRedemptions.map((r) => ({
        id:          r.id,
        userName:    r.user.name,
        avatarColor: r.user.avatarColor,
        prizeTitle:  r.prize.title,
        prizeEmoji:  r.prize.emoji,
        pointsSpent: r.pointsSpent,
        createdAt:   r.createdAt.toISOString(),
      }))}
      myUserId={userId}
      myBalance={myBalance._sum.points ?? 0}
      isAdmin={isAdmin}
    />
  )
}
