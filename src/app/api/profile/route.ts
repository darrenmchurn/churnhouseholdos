import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const VALID_THEMES = ["default", "kids", "compact", "dark", "classy"]

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, avatarColor: true, theme: true },
  })

  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, avatarColor, theme, currentPassword, newPassword,
          dailyCalorieGoal, dailyProteinGoal, dailyCarbsGoal, dailyFatGoal,
          weightGoalLbs } = body

  // Password change
  if (newPassword !== undefined) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 400 })
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: "New password must be at least 4 characters" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } })
    return NextResponse.json({ ok: true, changed: "password" })
  }

  // Profile update
  const updates: Record<string, string | number | null> = {}

  // Nutrition goals (sent as dedicated save, not part of profile form)
  if (dailyCalorieGoal !== undefined) updates.dailyCalorieGoal = dailyCalorieGoal !== null ? Number(dailyCalorieGoal) : null
  if (dailyProteinGoal !== undefined) updates.dailyProteinGoal = dailyProteinGoal !== null ? Number(dailyProteinGoal) : null
  if (dailyCarbsGoal   !== undefined) updates.dailyCarbsGoal   = dailyCarbsGoal   !== null ? Number(dailyCarbsGoal)   : null
  if (dailyFatGoal     !== undefined) updates.dailyFatGoal     = dailyFatGoal     !== null ? Number(dailyFatGoal)     : null
  if (weightGoalLbs    !== undefined) updates.weightGoalLbs    = weightGoalLbs    !== null ? Number(weightGoalLbs)    : null

  if (name !== undefined) {
    const trimmed = name.trim()
    if (!trimmed) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
    // Check uniqueness (exclude self)
    const existing = await prisma.user.findFirst({
      where: { name: trimmed, NOT: { id: session.user.id } },
    })
    if (existing) return NextResponse.json({ error: "That name is already taken" }, { status: 409 })
    updates.name = trimmed
  }

  if (avatarColor !== undefined) updates.avatarColor = avatarColor
  if (theme !== undefined) {
    if (!VALID_THEMES.includes(theme)) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 })
    }
    updates.theme = theme
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updates,
    select: { id: true, name: true, avatarColor: true, theme: true },
  })

  return NextResponse.json(updated)
}
