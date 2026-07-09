import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the Tailwind text-color class that provides the best contrast
 * on the given hex background (dark text on light colors, white on dark).
 */
export function avatarTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "text-slate-800" : "text-white"
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Convert a date string ("YYYY-MM-DD") + time string ("HH:MM") that the user
 * entered as America/Chicago local time into a proper UTC ISO string for storage.
 * Uses Intl to probe the DST-correct offset for that specific date so it works
 * correctly for both CST (UTC-6) and CDT (UTC-5) automatically.
 */
export function chicagoToUTC(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi]    = time.split(":").map(Number)
  // Probe noon UTC on that date — tells us what hour it is in Chicago at that moment,
  // which gives us the local→UTC offset without any hardcoded DST logic.
  const probe    = new Date(Date.UTC(y, mo - 1, d, 12))
  const chicagoH = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    })
      .formatToParts(probe)
      .find((p) => p.type === "hour")?.value ?? "6"
  )
  // chicagoH === 24 is Intl's representation of midnight; treat as 0.
  const offsetH = 12 - (chicagoH === 24 ? 0 : chicagoH)  // 5 for CDT, 6 for CST
  return new Date(Date.UTC(y, mo - 1, d, h + offsetH, mi)).toISOString()
}

/**
 * Convert a UTC ISO string back to Chicago-local date ("YYYY-MM-DD") and
 * 24-hour time ("HH:MM") for pre-populating date/time inputs.
 */
export function utcToChicago(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  const h = get("hour") === "24" ? "00" : get("hour")
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${h}:${get("minute")}`,
  }
}

/**
 * Today's date ("YYYY-MM-DD") in America/Chicago — the family's timezone.
 * Server code must use this instead of the server's local date (UTC on Vercel),
 * otherwise "today" flips to tomorrow at 6–7 PM Chicago time.
 */
export function chicagoTodayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" })
}

/**
 * The UTC instants spanning one Chicago-local calendar day (defaults to today).
 * DST-safe: derives both boundaries from chicagoToUTC's offset probing.
 */
export function chicagoDayRange(dateStr: string = chicagoTodayStr()): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number)
  const nextStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  const start = new Date(chicagoToUTC(dateStr, "00:00"))
  const end = new Date(new Date(chicagoToUTC(nextStr, "00:00")).getTime() - 1)
  return { start, end }
}

/** Master list of selectable avatar background colors — shared by Profile and Admin */
export const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#f97316",
  "#06b6d4", "#84cc16", "#a855f7", "#14b8a6",
  "#374151", "#ffffff",
]

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PARENT: "Parent",
  CHILD: "Child",
  KIOSK: "Kiosk",
}

export const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  PARENT: "bg-blue-100 text-blue-700",
  CHILD: "bg-green-100 text-green-700",
  KIOSK: "bg-orange-100 text-orange-700",
}
