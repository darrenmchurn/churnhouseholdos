"use client"

import { useEffect } from "react"
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
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/*
        Panel — uses dvh so the modal shrinks when the iOS keyboard opens.
        flex-col lets the header stay fixed while only the body scrolls,
        ensuring the submit button (inside the body) is always reachable.
      */}
      <div
        className={cn(
          "relative w-full bg-white rounded-t-3xl sm:rounded-2xl shadow-xl",
          "flex flex-col",
          // dvh = dynamic viewport height: recalculates when keyboard appears on iOS 16+
          // 90vh is the fallback for older browsers
          "max-h-[90vh] max-h-[85dvh]",
          "sm:max-w-md sm:mx-4",
          className
        )}
      >
        {/* Fixed header — never scrolls away */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 active:bg-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body — submit buttons live here and scroll into view */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-6 pb-8">
          {children}
        </div>
      </div>
    </div>
  )
}
