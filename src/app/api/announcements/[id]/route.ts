import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

type Props = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, props: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN" && session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  const body = await req.json()
  const { title, body: text, expiresAt } = body

  if (!title?.trim() || !text?.trim()) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 })
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      title: title.trim(),
      body: text.trim(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: { creator: { select: { name: true, avatarColor: true } } },
  })

  await logActivity(session.user.id, "updated", "announcement", updated.title)

  return NextResponse.json({
    ...updated,
    expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
    createdAt: updated.createdAt.toISOString(),
  })
}

export async function DELETE(_req: NextRequest, props: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN" && session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  const a = await prisma.announcement.findUnique({ where: { id }, select: { title: true } })
  await prisma.announcement.delete({ where: { id } })

  if (a) await logActivity(session.user.id, "deleted", "announcement", a.title)

  return NextResponse.json({ ok: true })
}
