import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role === "KIOSK") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: prizeId } = await props.params
  const userId = session.user.id

  const prize = await prisma.prize.findUnique({ where: { id: prizeId, active: true } })
  if (!prize) return NextResponse.json({ error: "Prize not found" }, { status: 404 })

  // Check balance
  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  })
  const balance = agg._sum.points ?? 0
  if (balance < prize.pointCost) {
    return NextResponse.json({ error: "Not enough points", balance, needed: prize.pointCost }, { status: 400 })
  }

  // Create redemption + debit transaction atomically
  const [redemption] = await prisma.$transaction([
    prisma.redemption.create({
      data: { userId, prizeId, pointsSpent: prize.pointCost },
      include: { user: { select: { name: true, avatarColor: true } }, prize: true },
    }),
    prisma.pointTransaction.create({
      data: { userId, points: -prize.pointCost, reason: `Redeemed: ${prize.title}` },
    }),
  ])

  return NextResponse.json(redemption, { status: 201 })
}
