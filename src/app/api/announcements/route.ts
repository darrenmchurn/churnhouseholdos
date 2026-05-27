import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const announcements = await prisma.announcement.findMany({
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

  const { title, body, expiresAt } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 })
  if (!body?.trim()) return NextResponse.json({ error: "Body is required" }, { status: 400 })

  const announcement = await prisma.announcement.create({
    data: {
      title: title.trim(),
      body: body.trim(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      creatorId: session.user.id,
    },
    include: { creator: { select: { name: true, avatarColor: true } } },
  })

  await logActivity(session.user.id, "posted", "announcement", announcement.title)

  return NextResponse.json(announcement, { status: 201 })
}
