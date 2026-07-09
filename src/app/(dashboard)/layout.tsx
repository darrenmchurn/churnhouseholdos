import { redirect } from "next/navigation"
import { getSessionUserTheme } from "@/lib/user-theme"
import { BottomNav } from "@/components/BottomNav"
import { RefreshOnResume } from "@/components/RefreshOnResume"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Deduped with the root layout's call via React cache()
  const user = await getSessionUserTheme()
  if (!user) redirect("/login")

  const { role, theme } = user

  return (
    <div className="flex flex-col min-h-screen">
      {/* Refetch on PWA resume; kiosk also refreshes every 5 min so the
          wall-mounted display never goes stale */}
      <RefreshOnResume intervalMs={role === "KIOSK" ? 5 * 60_000 : undefined} />
      {/* pb accounts for fixed bottom nav height (5rem) + iPhone home-indicator safe area */}
      <main className="flex-1 overflow-y-auto scroll-container pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      {role !== "KIOSK" && <BottomNav role={role} theme={theme} />}
    </div>
  )
}
