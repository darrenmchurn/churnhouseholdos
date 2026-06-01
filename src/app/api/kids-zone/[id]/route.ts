import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  const body = await req.json()

  const tile = await prisma.kidsZoneTile.findUnique({ where: { id } })
  if (!tile) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (body.url !== undefined) {
    try { new URL(body.url) } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }
  }

  const updated = await prisma.kidsZoneTile.update({
    where: { id },
    data: {
      ...("title"     in body && { title:     String(body.title).trim() }),
      ...("url"       in body && { url:       String(body.url).trim() }),
      ...("emoji"     in body && { emoji:     String(body.emoji).trim() || "🎮" }),
      ...("category"  in body && { category:  body.category }),
      ...("active"    in body && { active:    Boolean(body.active) }),
      ...("sortOrder" in body && { sortOrder: Number(body.sortOrder) }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role } = session.user
  if (role !== "ADMIN" && role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  const tile = await prisma.kidsZoneTile.findUnique({ where: { id } })
  if (!tile) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.kidsZoneTile.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
