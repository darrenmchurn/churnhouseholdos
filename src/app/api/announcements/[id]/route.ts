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
  const { title, body: text, expiresAt, visibleToIds } = body

  if (!title?.trim() || !text?.trim()) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 })
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      title: title.trim(),
      body: text.trim(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      // Audience: array of user ids; empty = everyone. Only touch it when sent.
      ...(Array.isArray(visibleToIds)
        ? { visibleToIds: visibleToIds.filter((v: unknown): v is string => typeof v === "string" && v.length > 0) }
        : {}),
    },
    include: { creator: { select: { name: true, avatarColor: true } } },
  })

  // Don't leak targeted-note titles into the shared activity feed
  await logActivity(
    session.user.id,
    "updated",
    "note",
    updated.visibleToIds.length > 0 ? "a private note" : updated.title
  )

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
  const a = await prisma.announcement.findUnique({ where: { id }, select: { title: true, visibleToIds: true } })
  await prisma.announcement.delete({ where: { id } })

  if (a) {
    await logActivity(
      session.user.id,
      "deleted",
      "note",
      a.visibleToIds.length > 0 ? "a private note" : a.title
    )
  }

  return NextResponse.json({ ok: true })
}
