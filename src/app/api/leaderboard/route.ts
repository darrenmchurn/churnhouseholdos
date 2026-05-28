import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [users, allTime, thisMonth, spent, recentRedemptions] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "KIOSK" } },
      select: { id: true, name: true, avatarColor: true, role: true },
    }),
    // Current balance per user (all-time net)
    prisma.pointTransaction.groupBy({
      by: ["userId"],
      _sum: { points: true },
    }),
    // Points earned this month (positive only)
    prisma.pointTransaction.groupBy({
      by: ["userId"],
      where: { points: { gt: 0 }, createdAt: { gte: monthStart } },
      _sum: { points: true },
    }),
    // Total spent (negative transactions, return as positive)
    prisma.pointTransaction.groupBy({
      by: ["userId"],
      where: { points: { lt: 0 } },
      _sum: { points: true },
    }),
    // Recent redemptions feed
    prisma.redemption.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true, avatarColor: true } },
        prize: { select: { title: true, emoji: true } },
      },
    }),
  ])

  const balanceMap = Object.fromEntries(allTime.map((r) => [r.userId, r._sum.points ?? 0]))
  const monthMap   = Object.fromEntries(thisMonth.map((r) => [r.userId, r._sum.points ?? 0]))
  const spentMap   = Object.fromEntries(spent.map((r) => [r.userId, Math.abs(r._sum.points ?? 0)]))

  const leaderboard = users
    .map((u) => ({
      id:           u.id,
      name:         u.name,
      avatarColor:  u.avatarColor,
      role:         u.role,
      balance:      balanceMap[u.id] ?? 0,
      earnedMonth:  monthMap[u.id]   ?? 0,
      totalSpent:   spentMap[u.id]   ?? 0,
    }))
    .sort((a, b) => b.balance - a.balance)

  return NextResponse.json({
    leaderboard,
    recentRedemptions: recentRedemptions.map((r) => ({
      id:         r.id,
      userName:   r.user.name,
      avatarColor: r.user.avatarColor,
      prizeTitle: r.prize.title,
      prizeEmoji: r.prize.emoji,
      pointsSpent: r.pointsSpent,
      createdAt:  r.createdAt.toISOString(),
    })),
  })
}
