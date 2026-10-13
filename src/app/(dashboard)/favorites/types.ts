export type FavCategory = {
  id: string
  label: string
  emoji: string
  group: string
  sortOrder: number
}

export type FavEntry = {
  id: string
  userId: string
  categoryId: string | null
  customLabel: string | null
  customEmoji: string | null
  value: string
  note: string | null
  updatedAt: string
  updatedByName: string | null
}

export type FavPerson = {
  id: string
  name: string
  avatarColor: string
  canEdit: boolean
}
