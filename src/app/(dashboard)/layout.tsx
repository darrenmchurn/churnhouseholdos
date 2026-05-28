import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BottomNav } from "@/components/BottomNav"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, theme: true },
  })

  const role = user?.role ?? session.user.role
  const theme = user?.theme ?? "default"

  return (
    <div
      className="flex flex-col min-h-screen"
      data-theme={theme !== "default" ? theme : undefined}
    >
      {/* pb accounts for fixed bottom nav height (5rem) + iPhone home-indicator safe area */}
      <main className="flex-1 overflow-y-auto scroll-container pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      {role !== "KIOSK" && <BottomNav role={role} theme={theme} />}
    </div>
  )
}
