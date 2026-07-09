"use client"

import { useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

// SSR-safe "is client" check without a setState-in-effect cascade
const emptySubscribe = () => () => {}
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false)

interface ConfirmSheetProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  /** "danger" (red, deletes) or "primary" (indigo, spends/commits) */
  tone?: "danger" | "primary"
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Small confirmation dialog for destructive or spending actions.
 * Portals to document.body at z-[110] so it stacks above Modal (z-[100])
 * and the bottom-sheet modals (z-[60]).
 */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const mounted = useMounted()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, busy, onCancel])

  if (!mounted || !open) return null

  // Carry the active theme into the portal (matches Modal.tsx)
  const theme = (document.querySelector("[data-theme]") as HTMLElement | null)?.dataset.theme

  return createPortal(
    <div
      data-theme={theme || undefined}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />
      <div className="relative w-full sm:max-w-xs bg-white rounded-2xl shadow-xl p-5">
        <p className="font-bold text-slate-900 text-base">{title}</p>
        {message && <p className="text-sm text-slate-500 mt-1.5">{message}</p>}
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "flex-1 h-11 rounded-xl text-white text-sm font-semibold disabled:opacity-50",
              tone === "danger" ? "bg-red-500 active:bg-red-600" : "bg-indigo-600 active:bg-indigo-700"
            )}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
