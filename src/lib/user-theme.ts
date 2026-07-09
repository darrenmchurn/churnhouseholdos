import { cache } from "react"
import { auth } from "./auth"
import { prisma } from "./prisma"

/**
 * The signed-in user's role + theme, read from the DB so profile changes take
 * effect immediately (the session JWT is only refreshed on re-login).
 * Wrapped in React cache() so the root layout and dashboard layout share one
 * query per request.
 */
export const getSessionUserTheme = cache(async () => {
  const session = await auth()
  if (!session) return null
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, theme: true },
  })
  return {
    role: user?.role ?? session.user.role,
    theme: user?.theme ?? "default",
  }
})
