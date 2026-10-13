"use client"

import { useState } from "react"
import Link from "next/link"
import { Pencil, Users, LayoutList } from "lucide-react"
import { cn, avatarTextColor, relTime } from "@/lib/utils"
import { FAVORITE_GROUPS } from "@/lib/favorites-groups"
import type { FavCategory, FavEntry, FavPerson } from "./types"

const PREVIEW_COUNT = 6

function Avatar({ person, size = "md" }: { person: FavPerson; size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center font-bold flex-shrink-0",
        size === "md" ? "w-10 h-10 text-base" : "w-7 h-7 text-xs rounded-lg",
        avatarTextColor(person.avatarColor),
        person.avatarColor === "#ffffff" && "ring-1 ring-slate-200",
      )}
      style={{ backgroundColor: person.avatarColor }}
      aria-hidden="true"
    >
      {person.name[0]?.toUpperCase()}
    </div>
  )
}

export function FavoritesBrowser({
  people, categories, entries, viewerId,
}: {
  people: FavPerson[]
  categories: FavCategory[]
  entries: FavEntry[]
  viewerId: string
}) {
  const [view, setView] = useState<"people" | "compare">("people")

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl">
        {([
          { v: "people",  label: "By Person",   Icon: Users },
          { v: "compare", label: "Compare",     Icon: LayoutList },
        ] as const).map(({ v, label, Icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "h-9 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors",
              view === v ? "bg-white text-slate-900 shadow-card" : "text-slate-500",
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {view === "people"
        ? <PeopleView people={people} categories={categories} entries={entries} viewerId={viewerId} />
        : <CompareView people={people} categories={categories} entries={entries} />}
    </div>
  )
}

function PeopleView({
  people, categories, entries, viewerId,
}: {
  people: FavPerson[]
  categories: FavCategory[]
  entries: FavEntry[]
  viewerId: string
}) {
  return (
    <div className="space-y-3">
      {people.map((p) => (
        <PersonCard
          key={p.id}
          person={p}
          categories={categories}
          entries={entries.filter((e) => e.userId === p.id)}
          isViewer={p.id === viewerId}
        />
      ))}
    </div>
  )
}

function PersonCard({
  person, categories, entries, isViewer,
}: {
  person: FavPerson
  categories: FavCategory[]
  entries: FavEntry[]
  isViewer: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  // Presets in admin order, grouped; custom answers last
  const rows = [
    ...FAVORITE_GROUPS.flatMap((g) =>
      categories
        .filter((c) => c.group === g.value)
        .flatMap((c) => {
          const e = entries.find((x) => x.categoryId === c.id)
          return e ? [{ entry: e, emoji: c.emoji, label: c.label }] : []
        }),
    ),
    ...entries
      .filter((e) => !e.categoryId)
      .map((e) => ({ entry: e, emoji: e.customEmoji ?? "⭐", label: e.customLabel ?? "" })),
  ]

  const latest = entries.reduce<string | null>((m, e) => (!m || e.updatedAt > m ? e.updatedAt : m), null)
  const shown = expanded ? rows : rows.slice(0, PREVIEW_COUNT)

  return (
    <div className="bg-white rounded-2xl shadow-card-md overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
        <Avatar person={person} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{person.name}{isViewer && <span className="text-slate-400 font-normal"> (you)</span>}</p>
          <p className="text-xs text-slate-400">
            {rows.length} favorite{rows.length === 1 ? "" : "s"}
            {latest && <> · updated {relTime(latest)}</>}
          </p>
        </div>
        {person.canEdit && (
          <Link
            href={`/favorites/${person.id}`}
            className="h-9 px-3 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <Pencil size={13} />
            Edit
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-sm text-slate-400">No favorites yet</p>
          {person.canEdit && (
            <Link href={`/favorites/${person.id}`} className="text-sm text-indigo-600 font-medium mt-1 inline-block">
              {isViewer ? "Add yours →" : `Add ${person.name}'s →`}
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {shown.map(({ entry, emoji, label }) => (
              <li key={entry.id} className="px-4 py-2.5 flex items-start gap-3">
                <span className="text-lg leading-6 w-6 text-center flex-shrink-0">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 leading-tight">{label}</p>
                  <p className="text-sm font-medium text-slate-800 break-words">{entry.value}</p>
                  {entry.note && <p className="text-xs text-slate-500 break-words">{entry.note}</p>}
                </div>
              </li>
            ))}
          </ul>
          {rows.length > PREVIEW_COUNT && (
            <button
              onClick={() => setExpanded((x) => !x)}
              className="w-full py-2.5 text-xs font-semibold text-indigo-600 border-t border-slate-100"
            >
              {expanded ? "Show less" : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function CompareView({
  people, categories, entries,
}: {
  people: FavPerson[]
  categories: FavCategory[]
  entries: FavEntry[]
}) {
  const [group, setGroup] = useState<string>("BASICS")
  const groups = FAVORITE_GROUPS.filter((g) => categories.some((c) => c.group === g.value))
  const visible = categories.filter((c) => c.group === group)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {groups.map((g) => (
          <button
            key={g.value}
            onClick={() => setGroup(g.value)}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors",
              group === g.value
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white border-slate-200 text-slate-600",
            )}
          >
            {g.emoji} {g.label}
          </button>
        ))}
      </div>

      {visible.map((c) => {
        const answers = people.map((p) => ({
          person: p,
          entry: entries.find((e) => e.userId === p.id && e.categoryId === c.id),
        }))
        const missing = answers.filter((a) => !a.entry)
        return (
          <div key={c.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
            <p className="px-4 pt-3 pb-2 text-sm font-semibold text-slate-700">
              <span className="mr-1.5">{c.emoji}</span>{c.label}
            </p>
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {answers.filter((a) => a.entry).map(({ person, entry }) => (
                <li key={person.id} className="px-4 py-2 flex items-start gap-3">
                  <Avatar person={person} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 break-words">
                      <span className="font-medium">{entry!.value}</span>
                    </p>
                    {entry!.note && <p className="text-xs text-slate-500 break-words">{entry!.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
            {missing.length === answers.length ? (
              <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">No answers yet</p>
            ) : missing.length > 0 && (
              <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
                Not answered yet: {missing.map((m) => m.person.name).join(", ")}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
