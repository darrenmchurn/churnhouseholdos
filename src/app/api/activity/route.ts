import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entity = searchParams.get("entity") // optional filter
  const cursor = searchParams.get("cursor")  // for pagination (createdAt ISO string)
  const limit = 40

  const logs = await prisma.activityLog.findMany({
    where: {
      ...(entity && entity !== "all" ? { entity } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { name: true, avatarColor: true } },
    },
  })

  return NextResponse.json({
    logs,
    nextCursor: logs.length === limit ? logs[logs.length - 1].createdAt.toISOString() : null,
  })
}
