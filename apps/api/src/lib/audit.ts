import { auditLog, type Database, type Transaction } from '@alvora/db';

export interface AuditEntry {
  actorId?: number | null;
  actorName?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  metadata?: unknown;
  ip?: string | null;
}

/**
 * Append-only trail of everything privileged or money-moving. The legacy admin
 * panel could credit any account with no record of who did it.
 */
export async function audit(db: Database | Transaction, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId ?? null,
    actorName: entry.actorName ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId === null || entry.targetId === undefined ? null : String(entry.targetId),
    metadata: (entry.metadata ?? null) as never,
    ip: entry.ip ?? null,
  });
}
