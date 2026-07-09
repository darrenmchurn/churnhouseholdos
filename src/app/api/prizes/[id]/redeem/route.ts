import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

class InsufficientStarsError extends Error {
  constructor(public balance: number) {
    super("Not enough points")
  }
}

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role === "KIOSK") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: prizeId } = await props.params
  const userId = session.user.id

  const prize = await prisma.prize.findUnique({ where: { id: prizeId, active: true } })
  if (!prize) return NextResponse.json({ error: "Prize not found" }, { status: 404 })

  // Balance check + redemption + debit in one transaction so two
  // simultaneous redemptions can't both pass the check and overspend
  try {
    const redemption = await prisma.$transaction(async (tx) => {
      const agg = await tx.pointTransaction.aggregate({
        where: { userId },
        _sum: { points: true },
      })
      const balance = agg._sum.points ?? 0
      if (balance < prize.pointCost) {
        throw new InsufficientStarsError(balance)
      }

      const created = await tx.redemption.create({
        data: { userId, prizeId, pointsSpent: prize.pointCost },
        include: { user: { select: { name: true, avatarColor: true } }, prize: true },
      })
      await tx.pointTransaction.create({
        data: { userId, points: -prize.pointCost, reason: `Redeemed: ${prize.title}` },
      })
      return created
    })

    return NextResponse.json(redemption, { status: 201 })
  } catch (err) {
    if (err instanceof InsufficientStarsError) {
      return NextResponse.json(
        { error: "Not enough points", balance: err.balance, needed: prize.pointCost },
        { status: 400 }
      )
    }
    throw err
  }
}
