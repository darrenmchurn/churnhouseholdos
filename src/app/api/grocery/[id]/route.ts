import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type Props = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, props: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role === "KIOSK") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await props.params
  const body = await req.json()

  const item = await prisma.groceryItem.update({
    where: { id },
    data: {
      ...(typeof body.completed === "boolean" && { completed: body.completed }),
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.quantity !== undefined && { quantity: body.quantity?.trim() || null }),
      ...(body.category !== undefined && { category: body.category?.trim() || null }),
    },
    include: { addedBy: { select: { name: true, avatarColor: true } } },
  })

  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, props: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN" && session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  await prisma.groceryItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
