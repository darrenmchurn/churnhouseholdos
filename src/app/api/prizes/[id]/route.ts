import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await props.params
  await prisma.prize.update({ where: { id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
