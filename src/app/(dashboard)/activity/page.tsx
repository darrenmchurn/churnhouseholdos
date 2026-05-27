export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ActivityFeed } from "./ActivityFeed"

const PAGE_SIZE = 40

export default async function ActivityPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "KIOSK") redirect("/dashboard")

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: {
      user: { select: { name: true, avatarColor: true } },
    },
  })

  const nextCursor =
    logs.length === PAGE_SIZE ? logs[logs.length - 1].createdAt.toISOString() : null

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Activity</h1>
        <p className="text-slate-500 text-sm mt-0.5">Everything happening in the household</p>
      </div>

      <ActivityFeed
        initialLogs={logs.map((l) => ({
          ...l,
          createdAt: l.createdAt.toISOString(),
        }))}
        initialCursor={nextCursor}
      />
    </div>
  )
}
