import { prisma } from "./prisma"

/**
 * Fire-and-forget activity log entry.
 * Errors are swallowed so logging never fails a real operation.
 */
export async function logActivity(
  userId: string,
  action: string,
  entity: string,
  entityTitle: string,
) {
  try {
    await prisma.activityLog.create({
      data: { userId, action, entity, entityTitle },
    })
  } catch {
    // non-critical
  }
}
