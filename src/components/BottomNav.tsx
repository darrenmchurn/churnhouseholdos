"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  CheckSquare,
  Sparkles,
  CalendarDays,
  ShoppingCart,
  History,
  Settings,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, roles: ["ADMIN", "PARENT", "CHILD"] },
  { href: "/chores", label: "Chores", icon: Sparkles },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/grocery", label: "Grocery", icon: ShoppingCart, roles: ["ADMIN", "PARENT", "CHILD"] },
  { href: "/activity", label: "History", icon: History, roles: ["ADMIN", "PARENT", "CHILD"] },
  { href: "/admin", label: "Admin", icon: Settings, roles: ["ADMIN", "PARENT"] },
]

export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname()

  const visible = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-pb">
      <div className="flex items-stretch h-16">
        {visible.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-indigo-600" : "text-slate-500"
              )}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={cn(active && "scale-110 transition-transform")}
              />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
