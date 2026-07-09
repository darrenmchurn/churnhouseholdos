import { redirect } from "next/navigation"
import { getSessionUserTheme } from "@/lib/user-theme"
import { BottomNav } from "@/components/BottomNav"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Deduped with the root layout's call via React cache()
  const user = await getSessionUserTheme()
  if (!user) redirect("/login")

  const { role, theme } = user

  return (
    <div className="flex flex-col min-h-screen">
      {/* pb accounts for fixed bottom nav height (5rem) + iPhone home-indicator safe area */}
      <main className="flex-1 overflow-y-auto scroll-container pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      {role !== "KIOSK" && <BottomNav role={role} theme={theme} />}
    </div>
  )
}
