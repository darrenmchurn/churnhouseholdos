import { prisma } from "@/lib/prisma"
import { LoginForm } from "./LoginForm"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, avatarColor: true },
    orderBy: [
      { role: "asc" },
      { name: "asc" },
    ],
  })

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600 shadow-lg mb-4">
            <span className="text-4xl">🏠</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Family Hub</h1>
          <p className="text-slate-500 mt-1">Who&apos;s signing in?</p>
        </div>

        {users.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
            <p className="text-slate-600 mb-4">
              No family members found. Set up your family first.
            </p>
            <a
              href="/setup"
              className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
            >
              Set Up Family
            </a>
          </div>
        ) : (
          <LoginForm users={users} />
        )}
      </div>
    </div>
  )
}
