"use client"

import { useState } from "react"
import { X, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

type Tile = {
  id: string
  title: string
  url: string
  emoji: string
  category: string
}

const CATEGORY_BADGE: Record<string, string> = {
  GAMES:    "bg-indigo-100 text-indigo-700",
  LEARNING: "bg-emerald-100 text-emerald-700",
  VIDEOS:   "bg-amber-100 text-amber-700",
}
const CATEGORY_LABEL: Record<string, string> = {
  GAMES:    "Games",
  LEARNING: "Learning",
  VIDEOS:   "Videos",
}

export function KidsZoneSection({ tiles }: { tiles: Tile[] }) {
  const [activeTile, setActiveTile] = useState<Tile | null>(null)

  if (tiles.length === 0) return null

  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-slate-700">🎮 Games &amp; Learning</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              onClick={() => setActiveTile(tile)}
              className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform hover:border-indigo-200 hover:shadow-sm"
            >
              <span className="text-4xl leading-none">{tile.emoji}</span>
              <span className="text-sm font-semibold text-slate-800 leading-snug">{tile.title}</span>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", CATEGORY_BADGE[tile.category] ?? "bg-slate-100 text-slate-500")}>
                {CATEGORY_LABEL[tile.category] ?? tile.category}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Full-screen iframe overlay */}
      {activeTile && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header bar */}
          <div className="flex items-center gap-3 px-3 h-12 border-b border-slate-200 flex-shrink-0">
            <button
              onClick={() => setActiveTile(null)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <span className="text-sm font-semibold text-slate-800 truncate flex-1">
              {activeTile.emoji} {activeTile.title}
            </span>
            <a
              href={activeTile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0"
              aria-label="Open in browser"
            >
              <ExternalLink size={16} />
            </a>
          </div>

          {/* iframe wrapper — iOS scroll fix */}
          <div
            className="flex-1 min-h-0"
            style={{ overflow: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            <iframe
              src={activeTile.url}
              title={activeTile.title}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock"
              allow="fullscreen; autoplay"
            />
          </div>

          {/* Fallback hint — always visible at bottom for sites that block iframes */}
          <div className="flex-shrink-0 bg-slate-50 border-t border-slate-100 px-4 py-2 flex items-center justify-between">
            <p className="text-xs text-slate-400">If the page is blank, this site can&apos;t be embedded.</p>
            <a
              href={activeTile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-indigo-600 flex items-center gap-1"
            >
              Open in tab <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}
    </>
  )
}
