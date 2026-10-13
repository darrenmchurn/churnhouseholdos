// Client-safe (no prisma import) so browser components can share it.
export const FAVORITE_GROUPS = [
  { value: "BASICS",   label: "Favorites",          emoji: "⭐" },
  { value: "FUN",      label: "Just for Fun",       emoji: "🎈" },
  { value: "DISLIKES", label: "Dislikes & Allergies", emoji: "🚫" },
  { value: "SIZES",    label: "Sizes",              emoji: "👕" },
] as const

export const groupLabel = (g: string) => FAVORITE_GROUPS.find((x) => x.value === g)?.label ?? g
