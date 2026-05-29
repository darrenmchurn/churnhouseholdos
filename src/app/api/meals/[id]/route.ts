import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await props.params
  const body = await req.json()
  const { title, description, servings, prepMins, cookMins, ingredients } = body

  const meal = await prisma.meal.findUnique({ where: { id } })
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const canEdit =
    session.user.role === "ADMIN" ||
    session.user.role === "PARENT" ||
    meal.createdById === session.user.id

  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (title !== undefined && !title.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 })
  }

  const updated = await prisma.meal.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() || null }),
      ...(servings !== undefined && { servings: Number(servings) }),
      ...(prepMins !== undefined && { prepMins: Number(prepMins) }),
      ...(cookMins !== undefined && { cookMins: Number(cookMins) }),
      ...(ingredients !== undefined && {
        ingredients: {
          deleteMany: {},
          create: ingredients
            .filter((ing: { name?: string }) => ing.name?.trim())
            .map((ing: { name: string; quantity?: string; category?: string }) => ({
              name: ing.name.trim(),
              quantity: ing.quantity?.trim() || null,
              category: ing.category?.trim() || null,
            })),
        },
      }),
    },
    include: {
      ingredients: { orderBy: { name: "asc" } },
      createdBy: { select: { name: true, avatarColor: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await props.params
  const meal = await prisma.meal.findUnique({ where: { id } })
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const canDelete =
    session.user.role === "ADMIN" ||
    session.user.role === "PARENT" ||
    meal.createdById === session.user.id

  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.meal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
