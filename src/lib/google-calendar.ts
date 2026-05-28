import { GoogleAuth } from "google-auth-library"
import { GCAL_COLORS, DEFAULT_COLOR } from "./calendar-constants"
import type { CalEvent } from "./calendar-constants"

// Local types — independent of the Prisma-backed calendar types in calendar-constants.ts
type GCalEvent = {
  id: string
  summary: string
  description?: string
  colorId?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  allDay: boolean
}

type CreateEventInput = {
  summary: string
  description?: string
  colorId?: string
  start: string
  end: string
  allDay: boolean
}

export type { GCalEvent, CreateEventInput }

const SCOPES = ["https://www.googleapis.com/auth/calendar"]

export function isConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_CALENDAR_ID
  )
}

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // Vercel stores newlines as literal \n — convert them back
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token.token) throw new Error("Failed to get Google access token")
  return token.token
}

function calendarUrl(path = ""): string {
  const id = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!)
  return `https://www.googleapis.com/calendar/v3/calendars/${id}/events${path}`
}

function normalizeEvent(raw: Record<string, unknown>): GCalEvent {
  const start = raw.start as { dateTime?: string; date?: string }
  const end = raw.end as { dateTime?: string; date?: string }
  return {
    id: raw.id as string,
    summary: (raw.summary as string) ?? "(No title)",
    description: raw.description as string | undefined,
    colorId: raw.colorId as string | undefined,
    start,
    end,
    allDay: !!start.date && !start.dateTime,
  }
}

export async function getEvents(timeMin: Date, timeMax: Date): Promise<GCalEvent[]> {
  const token = await getAccessToken()
  const url = new URL(calendarUrl())
  url.searchParams.set("timeMin", timeMin.toISOString())
  url.searchParams.set("timeMax", timeMax.toISOString())
  url.searchParams.set("singleEvents", "true")
  url.searchParams.set("orderBy", "startTime")
  url.searchParams.set("maxResults", "250")

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`)
  const data = await res.json() as { items?: Record<string, unknown>[] }
  return (data.items ?? []).map(normalizeEvent)
}

export async function createEvent(input: CreateEventInput): Promise<GCalEvent> {
  const token = await getAccessToken()
  const body = {
    summary: input.summary,
    description: input.description || undefined,
    colorId: input.colorId || undefined,
    start: input.allDay
      ? { date: input.start }
      : { dateTime: input.start, timeZone: "America/Chicago" },
    end: input.allDay
      ? { date: input.end }
      : { dateTime: input.end, timeZone: "America/Chicago" },
  }

  const res = await fetch(calendarUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`)
  return normalizeEvent(await res.json())
}

export async function updateEvent(id: string, input: Partial<CreateEventInput>): Promise<GCalEvent> {
  const token = await getAccessToken()
  const body: Record<string, unknown> = {}
  if (input.summary) body.summary = input.summary
  if (input.description !== undefined) body.description = input.description
  if (input.colorId !== undefined) body.colorId = input.colorId
  if (input.start) body.start = input.allDay
    ? { date: input.start }
    : { dateTime: input.start, timeZone: "America/Chicago" }
  if (input.end) body.end = input.allDay
    ? { date: input.end }
    : { dateTime: input.end, timeZone: "America/Chicago" }

  const res = await fetch(calendarUrl(`/${id}`), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`)
  return normalizeEvent(await res.json())
}

export async function deleteEvent(id: string): Promise<void> {
  const token = await getAccessToken()
  const res = await fetch(calendarUrl(`/${id}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`)
  }
}

/** Convert a raw GCal event to the shared CalEvent format used by the UI */
export function gcalEventToCalEvent(e: GCalEvent): CalEvent {
  const startIso = e.start.dateTime ?? (e.start.date! + "T12:00:00Z")
  const endIso   = e.end.dateTime   ?? (e.end.date   ? e.end.date + "T12:00:00Z" : null)
  return {
    id:          e.id,   // use GCal ID as primary id when reading from GCal
    gcalId:      e.id,
    title:       e.summary,
    description: e.description ?? null,
    startDate:   startIso,
    endDate:     endIso,
    allDay:      e.allDay,
    color:       e.colorId ? (GCAL_COLORS[e.colorId] ?? DEFAULT_COLOR) : DEFAULT_COLOR,
  }
}

/** Fetch the next N upcoming events from Google Calendar as CalEvent[] */
export async function getUpcomingCalEvents(limit = 5): Promise<CalEvent[]> {
  const token = await getAccessToken()
  const url = new URL(calendarUrl())
  url.searchParams.set("timeMin", new Date().toISOString())
  url.searchParams.set("singleEvents", "true")
  url.searchParams.set("orderBy", "startTime")
  url.searchParams.set("maxResults", String(limit))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`)
  const data = await res.json() as { items?: Record<string, unknown>[] }
  return (data.items ?? []).map(normalizeEvent).map(gcalEventToCalEvent)
}

/** Fetch events for a month range from Google Calendar as CalEvent[] */
export async function getMonthCalEvents(timeMin: Date, timeMax: Date): Promise<CalEvent[]> {
  const events = await getEvents(timeMin, timeMax)
  return events.map(gcalEventToCalEvent)
}
