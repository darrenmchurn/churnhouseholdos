import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { BottomNav } from "@/components/BottomNav"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const role = session.user.role

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 overflow-y-auto scroll-container pb-20">
        {children}
      </main>
      {role !== "KIOSK" && <BottomNav role={role} />}
    </div>
  )
}
