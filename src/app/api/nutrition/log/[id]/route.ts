import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await props.params
  const entry = await prisma.foodLog.findUnique({ where: { id } })
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Users can only delete their own entries; admins can delete anyone's
  const canDelete =
    entry.userId === session.user.id ||
    session.user.role === "ADMIN" ||
    session.user.role === "PARENT"

  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.foodLog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
