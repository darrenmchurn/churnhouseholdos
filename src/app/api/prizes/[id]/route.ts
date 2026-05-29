import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await props.params
  const body = await req.json()

  const updated = await prisma.prize.update({
    where: { id },
    data: {
      ...("title"       in body && { title:       body.title }),
      ...("description" in body && { description: body.description }),
      ...("pointCost"   in body && { pointCost:   Number(body.pointCost) }),
      ...("emoji"       in body && { emoji:       body.emoji }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await props.params
  await prisma.prize.update({ where: { id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
