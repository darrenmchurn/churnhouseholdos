import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prizes = await prisma.prize.findMany({
    where: { active: true },
    orderBy: { pointCost: "asc" },
    include: { _count: { select: { redemptions: true } } },
  })
  return NextResponse.json(prizes)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { title, description, pointCost, emoji } = await req.json()
  if (!title || !pointCost) return NextResponse.json({ error: "title and pointCost required" }, { status: 400 })

  const prize = await prisma.prize.create({
    data: { title, description, pointCost: Number(pointCost), emoji: emoji || "🎁", createdById: session.user.id },
  })
  return NextResponse.json(prize, { status: 201 })
}
