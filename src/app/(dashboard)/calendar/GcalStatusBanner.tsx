"use client"

import { useEffect, useState } from "react"
import { CheckCircle, XCircle, Loader, ChevronDown, ChevronUp } from "lucide-react"

type Status = {
  configured: boolean
  connected: boolean
  calendarName?: string
  message: string
}

export function GcalStatusBanner({ configured }: { configured: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function check() {
    setLoading(true)
    try {
      const res = await fetch("/api/calendar/status")
      setStatus(await res.json())
    } catch {
      setStatus({ configured, connected: false, message: "Could not reach status endpoint" })
    } finally {
      setLoading(false)
    }
  }

  // Auto-check on mount if configured
  useEffect(() => {
    if (configured) check()
    else setStatus({ configured: false, connected: false, message: "Google Calendar env vars not set" })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!status && !loading) return null

  const isOk = status?.connected
  const isPending = loading || !status

  return (
    <div className={`mb-4 rounded-2xl border text-sm overflow-hidden ${
      isPending ? "bg-slate-50 border-slate-200" :
      isOk     ? "bg-green-50 border-green-200" :
                 "bg-red-50 border-red-200"
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
      >
        {isPending ? (
          <Loader size={16} className="animate-spin text-slate-400 flex-shrink-0" />
        ) : isOk ? (
          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
        ) : (
          <XCircle size={16} className="text-red-500 flex-shrink-0" />
        )}

        <span className={`font-medium flex-1 ${
          isPending ? "text-slate-500" : isOk ? "text-green-800" : "text-red-700"
        }`}>
          {isPending
            ? "Checking Google Calendar…"
            : isOk
            ? `Google Calendar syncing to "${status.calendarName}"`
            : "Google Calendar sync unavailable"}
        </span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isPending && (
            <button
              onClick={(e) => { e.stopPropagation(); check() }}
              className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                isOk ? "bg-green-100 text-green-700 hover:bg-green-200"
                     : "bg-red-100 text-red-700 hover:bg-red-200"
              }`}
            >
              Re-test
            </button>
          )}
          {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {expanded && status && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-2 space-y-1.5">
          <p className={`text-xs ${isOk ? "text-green-700" : "text-red-600"}`}>
            {status.message}
          </p>
          {!status.configured && (
            <p className="text-xs text-slate-500">
              Add <code className="bg-slate-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
              <code className="bg-slate-100 px-1 rounded">GOOGLE_PRIVATE_KEY</code>, and{" "}
              <code className="bg-slate-100 px-1 rounded">GOOGLE_CALENDAR_ID</code> to your Vercel environment variables.
            </p>
          )}
          {status.configured && !status.connected && (
            <p className="text-xs text-slate-500">
              Events are still saved to the app. Check that the service account has been shared on the Google Calendar with &ldquo;Make changes to events&rdquo; permission.
            </p>
          )}
          {status.connected && (
            <p className="text-xs text-green-700">
              New events created here will automatically appear in Google Calendar. Deletes sync too.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
