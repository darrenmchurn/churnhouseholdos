import { Role } from "@/generated/prisma/enums"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email?: string | null
      role: Role
      avatarColor: string
    }
  }

  interface User {
    role: Role
    avatarColor: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    avatarColor: string
  }
}
