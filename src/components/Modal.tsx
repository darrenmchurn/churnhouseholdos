"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!mounted || !open) return null

  // Carry the active theme (dark / classy / kids / compact) into the portal so
  // all [data-theme="…"] CSS selectors keep working outside the layout tree.
  const theme = (document.querySelector("[data-theme]") as HTMLElement | null)?.dataset.theme

  return createPortal(
    <div
      data-theme={theme || undefined}
      // z-[100] lives on document.body — no parent stacking context can suppress it.
      // items-center keeps the panel away from the bottom nav / home indicator.
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full bg-white rounded-2xl shadow-xl",
          "flex flex-col",
          // max-h uses dvh (dynamic viewport height) so the panel shrinks when the
          // iOS keyboard opens; the body scrolls independently so the submit button
          // is always reachable.
          "max-h-[85dvh]",
          "sm:max-w-md",
          className
        )}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 active:bg-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-6 pb-8">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
