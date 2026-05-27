import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.groceryItem.findMany({
    orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
    include: { addedBy: { select: { name: true, avatarColor: true } } },
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role === "KIOSK") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name, quantity, category } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const item = await prisma.groceryItem.create({
    data: {
      name: name.trim(),
      quantity: quantity?.trim() || null,
      category: category?.trim() || null,
      addedById: session.user.id,
    },
    include: { addedBy: { select: { name: true, avatarColor: true } } },
  })

  return NextResponse.json(item, { status: 201 })
}

export async function DELETE() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN" && session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.groceryItem.deleteMany({ where: { completed: true } })
  return NextResponse.json({ ok: true })
}
