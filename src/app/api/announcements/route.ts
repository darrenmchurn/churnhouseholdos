import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

/** Coerce the client-sent audience into a clean string[] (empty = everyone). */
function parseVisibleToIds(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((v): v is string => typeof v === "string" && v.length > 0)
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canManage = session.user.role === "ADMIN" || session.user.role === "PARENT"

  const announcements = await prisma.announcement.findMany({
    // Managers see every note; others only ones addressed to everyone or to them
    where: canManage
      ? {}
      : { OR: [{ visibleToIds: { isEmpty: true } }, { visibleToIds: { has: session.user.id } }] },
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { name: true, avatarColor: true } } },
  })

  return NextResponse.json(announcements)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN" && session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { title, body, expiresAt, visibleToIds } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 })
  if (!body?.trim()) return NextResponse.json({ error: "Body is required" }, { status: 400 })

  const announcement = await prisma.announcement.create({
    data: {
      title: title.trim(),
      body: body.trim(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      visibleToIds: parseVisibleToIds(visibleToIds),
      creatorId: session.user.id,
    },
    include: { creator: { select: { name: true, avatarColor: true } } },
  })

  // Don't leak targeted-note titles into the shared activity feed
  await logActivity(
    session.user.id,
    "posted",
    "note",
    announcement.visibleToIds.length > 0 ? "a private note" : announcement.title
  )

  return NextResponse.json(announcement, { status: 201 })
}
