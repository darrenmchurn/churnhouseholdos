"use client"

import { useState } from "react"
import { Pin, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type Announcement = {
  id: string
  title: string
  body: string
  expiresLabel: string | null
}

// Long bodies (packing lists, show lists) get clamped so announcements don't
// swallow the dashboard — tap to expand. Short ones render fully with no chrome.
const CLAMP_LINES = 3

function isLong(body: string): boolean {
  return body.split("\n").length > CLAMP_LINES || body.length > 180
}

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const [expanded, setExpanded] = useState(false)
  const clampable = isLong(announcement.body)

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <button
        onClick={() => clampable && setExpanded((v) => !v)}
        className={cn("w-full text-left p-4", !clampable && "cursor-default")}
        aria-expanded={clampable ? expanded : undefined}
      >
        <div className="flex items-center gap-2">
          <Pin size={14} className="text-indigo-500 flex-shrink-0" />
          <p className="font-semibold text-slate-900 text-sm flex-1 min-w-0 truncate">
            {announcement.title}
          </p>
          {clampable && (
            <ChevronDown
              size={14}
              className={cn("text-slate-300 flex-shrink-0 transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
          )}
        </div>
        <p
          className={cn(
            "text-sm text-slate-600 mt-1.5 whitespace-pre-wrap",
            clampable && !expanded && "line-clamp-3"
          )}
        >
          {announcement.body}
        </p>
        {(clampable && !expanded) ? (
          <p className="text-xs text-indigo-500 font-medium mt-1.5">Show more</p>
        ) : announcement.expiresLabel ? (
          <p className="text-xs text-slate-400 mt-1.5">Expires {announcement.expiresLabel}</p>
        ) : null}
      </button>
    </div>
  )
}
