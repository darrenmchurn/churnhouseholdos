// Shared calendar types and constants — no Node.js dependencies, safe to import in client components

/** Internal Prisma-backed calendar event (dates serialised to ISO strings for the client) */
export type CalEvent = {
  id: string          // Prisma cuid OR GCal event ID when read directly from GCal
  gcalId?: string     // GCal event ID — present when synced to / read from GCal
  title: string
  description?: string | null
  startDate: string   // ISO string
  endDate?: string | null
  allDay: boolean
  color: string
  creatorId?: string
  creator?: { name: string }
}

/** Shape POSTed / PATCHed to /api/calendar */
export type CreateEventInput = {
  title: string
  description?: string
  color?: string
  startDate: string   // ISO string  (date only "YYYY-MM-DD" for allDay)
  endDate?: string
  allDay: boolean
}

export const GCAL_COLORS: Record<string, string> = {
  "1": "#ef4444",
  "2": "#f97316",
  "3": "#f59e0b",
  "4": "#eab308",
  "5": "#84cc16",
  "6": "#16a34a",
  "7": "#0d9488",
  "8": "#3b82f6",
  "9": "#a78bfa",
  "10": "#9333ea",
  "11": "#6b7280",
}

export const DEFAULT_COLOR = "#6366f1"
