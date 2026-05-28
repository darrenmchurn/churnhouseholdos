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
