import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Creates the initial family accounts. Only works if no users exist yet.
export async function POST(req: Request) {
  const existing = await prisma.user.count()
  if (existing > 0) {
    return NextResponse.json({ error: "Users already exist" }, { status: 400 })
  }

  const body = await req.json()
  const members: Array<{
    name: string
    password: string
    role: "ADMIN" | "PARENT" | "CHILD" | "KIOSK"
    avatarColor: string
  }> = body.members

  if (!Array.isArray(members) || members.length === 0) {
    return NextResponse.json({ error: "No members provided" }, { status: 400 })
  }

  const created = await Promise.all(
    members.map(async (m) => {
      const passwordHash = await bcrypt.hash(m.password, 12)
      return prisma.user.create({
        data: {
          name: m.name,
          passwordHash,
          role: m.role,
          avatarColor: m.avatarColor,
        },
        select: { id: true, name: true, role: true, avatarColor: true },
      })
    })
  )

  return NextResponse.json({ created })
}
