export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ProfileForm } from "./ProfileForm"
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/utils"

export default async function ProfilePage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "KIOSK") redirect("/dashboard")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, role: true, avatarColor: true, theme: true, createdAt: true },
  })

  if (!user) redirect("/login")

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-sm flex-shrink-0"
          style={{ backgroundColor: user.avatarColor }}
        >
          {user.name[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </span>
            <span className="text-xs text-slate-400">
              Since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      <ProfileForm
        initialName={user.name}
        initialAvatarColor={user.avatarColor}
        initialTheme={user.theme}
      />
    </div>
  )
}
