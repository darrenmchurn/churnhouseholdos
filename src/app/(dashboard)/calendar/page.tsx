export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isConfigured, getEvents } from "@/lib/google-calendar"
import { CalendarView } from "./CalendarView"
import { ExternalLink } from "lucide-react"

export default async function CalendarPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const canManage = session.user.role === "ADMIN" || session.user.role === "PARENT"

  if (!isConfigured()) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Calendar</h1>
        <p className="text-slate-500 text-sm mb-6">Connect Google Calendar to get started</p>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📅</div>
            <div>
              <p className="font-semibold text-slate-900">Google Calendar Setup</p>
              <p className="text-xs text-slate-500">Takes about 10 minutes</p>
            </div>
          </div>

          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
              <span>Go to <strong>console.cloud.google.com</strong> → create a new project (or pick an existing one)</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">2</span>
              <span><strong>APIs &amp; Services → Library</strong> → search <em>Google Calendar API</em> → Enable</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">3</span>
              <span><strong>APIs &amp; Services → Credentials → Create Credentials → Service Account</strong> → give it any name → Done</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">4</span>
              <span>Click the service account → <strong>Keys → Add Key → Create New Key → JSON</strong> → download it</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">5</span>
              <span>Go to <strong>calendar.google.com</strong> → create a new calendar called <em>Churn Household OS</em></span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">6</span>
              <span>In calendar settings → <strong>Share with specific people</strong> → add the service account email → <em>Make changes to events</em></span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">7</span>
              <span>Copy the <strong>Calendar ID</strong> from the Integrate Calendar section</span>
            </li>
          </ol>

          <div className="bg-slate-50 rounded-xl p-4 text-xs font-mono space-y-1 text-slate-700">
            <p className="text-slate-400 font-sans font-medium text-xs mb-2">Add to your .env.local:</p>
            <p>GOOGLE_SERVICE_ACCOUNT_EMAIL=<span className="text-indigo-600">&quot;client_email from JSON&quot;</span></p>
            <p>GOOGLE_PRIVATE_KEY=<span className="text-indigo-600">&quot;private_key from JSON&quot;</span></p>
            <p>GOOGLE_CALENDAR_ID=<span className="text-indigo-600">&quot;your-calendar-id@group.calendar.google.com&quot;</span></p>
          </div>

          <p className="text-xs text-slate-500">
            After adding the env vars, restart the dev server and reload this page.
            On Vercel, add them under <strong>Settings → Environment Variables</strong>.
          </p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const timeMin = new Date(year, month, 1)
  const timeMax = new Date(year, month + 1, 0, 23, 59, 59)

  let events: Awaited<ReturnType<typeof getEvents>> = []
  let calendarError: string | null = null
  try {
    events = await getEvents(timeMin, timeMax)
  } catch (err) {
    calendarError = err instanceof Error ? err.message : String(err)
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        </div>
      </div>

      {calendarError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">Calendar connection error:</p>
          <p className="font-mono text-xs break-all">{calendarError}</p>
        </div>
      )}

      <CalendarView
        initialEvents={events}
        initialYear={year}
        initialMonth={month}
        today={now.toISOString().slice(0, 10)}
        canManage={canManage}
      />
    </div>
  )
}
