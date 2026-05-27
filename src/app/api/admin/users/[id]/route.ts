import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const VALID_ROLES = ["ADMIN", "PARENT", "CHILD", "KIOSK"]

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const { id } = await props.params
  const body = await req.json()
  const { name, avatarColor, role, newPassword } = body

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const updates: Record<string, string> = {}

  if (name !== undefined) {
    const trimmed = String(name).trim()
    if (!trimmed) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
    const conflict = await prisma.user.findFirst({
      where: { name: trimmed, NOT: { id } },
    })
    if (conflict) return NextResponse.json({ error: "That name is already taken" }, { status: 409 })
    updates.name = trimmed
  }

  if (avatarColor !== undefined) updates.avatarColor = avatarColor

  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    updates.role = role
  }

  if (newPassword !== undefined) {
    if (!newPassword || String(newPassword).length < 1) {
      return NextResponse.json({ error: "Password cannot be empty" }, { status: 400 })
    }
    updates.passwordHash = await bcrypt.hash(String(newPassword), 10)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, avatarColor: true, role: true },
  })

  return NextResponse.json(updated)
}
