import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DEFAULTS = [
  // ── 🥉 Bronze (25 ⭐) ──────────────────────────────────────────
  { title: "Choose a TV Episode",      description: "Pick one show or episode for the evening",              pointCost: 25,  emoji: "📺" },
  { title: "Extra Screen Time",        description: "15 extra minutes of screen time today",                 pointCost: 25,  emoji: "⏱️" },
  { title: "Homework Pass",            description: "Start homework 30 minutes later, one time",             pointCost: 25,  emoji: "📚" },
  { title: "Bed Skip",                 description: "Skip making your bed for one day",                      pointCost: 25,  emoji: "🛏️" },
  { title: "Game Pick",                description: "You choose the family game for game night",             pointCost: 25,  emoji: "🎲" },
  { title: "Chore Swap",               description: "Trade one chore with a sibling or parent, one time",   pointCost: 25,  emoji: "🔄" },
  { title: "30 Min Bonus Screen Time", description: "Extra 30 minutes on top of your regular limit",        pointCost: 25,  emoji: "📱" },
  { title: "Stay Up 30 Minutes Later", description: "One night, no questions asked",                        pointCost: 25,  emoji: "🌟" },
  // ── 🥈 Silver (75 ⭐) ──────────────────────────────────────────
  { title: "Late Night Pass",          description: "Stay up 30 extra minutes on a weekend night",          pointCost: 75,  emoji: "🌙" },
  { title: "Pick Dinner Night",        description: "Choose what the family has for dinner one night",      pointCost: 75,  emoji: "🍽️" },
  { title: "Restaurant Pick",          description: "Choose where the family eats out",                     pointCost: 75,  emoji: "🍔" },
  { title: "Chore-Free Saturday",      description: "Sleep in — no chores until noon on Saturday",         pointCost: 75,  emoji: "😴" },
  { title: "Pick the Family Show",     description: "Choose what everyone watches this week",               pointCost: 75,  emoji: "🎬" },
  { title: "Ice Cream Run",            description: "Trip to the ice cream shop, your pick",                pointCost: 75,  emoji: "🍦" },
  { title: "Day Trip Vote",            description: "You pick the destination for the next family day trip", pointCost: 75,  emoji: "🗺️" },
  // ── 🥇 Gold (200 ⭐) ───────────────────────────────────────────
  { title: "Movie Night",              description: "You pick the movie for family movie night",             pointCost: 200, emoji: "🍿" },
  { title: "Eat Out",                  description: "Choose the restaurant for a family dinner out",        pointCost: 200, emoji: "🍕" },
  { title: "Laser Tag / Bowling",      description: "The whole family goes — your choice of activity",      pointCost: 200, emoji: "🎳" },
  { title: "New Game or App",          description: "Pick one within a set budget",                         pointCost: 200, emoji: "🎮" },
  { title: "Shopping Trip",            description: "Set budget, you pick the store",                       pointCost: 200, emoji: "🛍️" },
  { title: "Movie Theater Outing",     description: "Opening weekend, your pick, snacks included",          pointCost: 200, emoji: "🎟️" },
  { title: "Living Room Camp Night",   description: "Pull-out mattress, movies, snacks — the works",        pointCost: 200, emoji: "⛺" },
]

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  // Upsert by title — adds any defaults not already present, skips existing ones
  const existingTitles = new Set(
    (await prisma.prize.findMany({ select: { title: true } })).map((p) => p.title)
  )

  const toAdd = DEFAULTS.filter((d) => !existingTitles.has(d.title))

  if (toAdd.length === 0) {
    return NextResponse.json({ added: 0, message: "All default prizes already exist" })
  }

  const created = await prisma.$transaction(
    toAdd.map((d) =>
      prisma.prize.create({
        data: { ...d, createdById: session.user.id },
      })
    )
  )

  return NextResponse.json({ added: created.length, prizes: created }, { status: 201 })
}
