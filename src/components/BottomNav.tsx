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
  Trophy,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  emoji: string
  icon: React.ElementType
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home",     emoji: "🏠", icon: LayoutDashboard },
  { href: "/tasks",     label: "Tasks",    emoji: "✅", icon: CheckSquare,  roles: ["ADMIN", "PARENT", "CHILD"] },
  { href: "/chores",    label: "Chores",   emoji: "✨", icon: Sparkles },
  { href: "/calendar",  label: "Calendar", emoji: "📅", icon: CalendarDays },
  { href: "/grocery",   label: "Grocery",  emoji: "🛒", icon: ShoppingCart, roles: ["ADMIN", "PARENT", "CHILD"] },
  { href: "/prizes",    label: "Prizes",   emoji: "🏆", icon: Trophy,       roles: ["ADMIN", "PARENT", "CHILD"] },
  { href: "/activity",  label: "History",  emoji: "📋", icon: History,      roles: ["ADMIN", "PARENT", "CHILD"] },
  { href: "/admin",     label: "Admin",    emoji: "⚙️", icon: Settings,     roles: ["ADMIN", "PARENT"] },
]

export function BottomNav({ role, theme }: { role: string; theme: string }) {
  const pathname = usePathname()
  const isKids    = theme === "kids"
  const isCompact = theme === "compact"

  const visible = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  const iconSize    = isKids ? 24 : isCompact ? 19 : 22
  const navHeight   = isKids ? "h-[4.5rem]" : "h-16"
  const labelSize   = isCompact ? "text-[9px]" : "text-[10px]"

  return (
    <nav className={cn("fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-pb", navHeight)}>
      <div className="flex items-stretch h-full">
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
                size={iconSize}
                strokeWidth={active ? 2.5 : 1.8}
                className={cn(active && "scale-110 transition-transform")}
              />
              <span className={cn("font-medium leading-none", labelSize)}>
                {isKids ? `${item.emoji} ${item.label}` : item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
