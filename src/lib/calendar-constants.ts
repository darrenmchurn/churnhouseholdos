// Shared calendar types and constants — no Node.js dependencies, safe to import in client components

export type GCalEvent = {
  id: string
  summary: string
  description?: string
  colorId?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  allDay: boolean
}

export type CreateEventInput = {
  summary: string
  description?: string
  colorId?: string
  start: string
  end: string
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
