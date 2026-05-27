export const dynamic = "force-dynamic"

import { SetupForm } from "./SetupForm"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function SetupPage() {
  const count = await prisma.user.count()
  if (count > 0) redirect("/login")

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600 shadow-lg mb-4">
            <span className="text-4xl">🏠</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome to Churn Household OS</h1>
          <p className="text-slate-500 mt-1">Let&apos;s set up your household</p>
        </div>
        <SetupForm />
      </div>
    </div>
  )
}
