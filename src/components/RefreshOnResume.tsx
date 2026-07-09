"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

// Don't hammer the server when the user flips between apps rapidly
const MIN_GAP_MS = 15_000

/**
 * Refetches server-component data when the PWA is resumed from the background
 * (standalone iOS apps resume from memory showing stale data), and optionally
 * on a fixed interval — used by the kiosk so a wall-mounted display stays live.
 * Renders nothing.
 */
export function RefreshOnResume({ intervalMs }: { intervalMs?: number }) {
  const router = useRouter()
  const lastRefresh = useRef(0)

  useEffect(() => {
    // Data is fresh at mount; start the throttle window from here
    lastRefresh.current = Date.now()

    function refresh() {
      if (Date.now() - lastRefresh.current < MIN_GAP_MS) return
      lastRefresh.current = Date.now()
      router.refresh()
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh()
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    const id = intervalMs ? setInterval(refresh, intervalMs) : undefined
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      if (id) clearInterval(id)
    }
  }, [router, intervalMs])

  return null
}
