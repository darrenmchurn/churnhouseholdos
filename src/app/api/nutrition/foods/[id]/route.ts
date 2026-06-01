import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// PATCH — bump lastUsedAt when an existing food is re-logged
export async function PATCH(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await props.params
  const item = await prisma.foodItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (item.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.foodItem.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  })

  return NextResponse.json(updated)
}

// DELETE — remove a saved food from the library
export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await props.params
  const item = await prisma.foodItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (item.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.foodItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
