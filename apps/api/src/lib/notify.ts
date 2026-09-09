import { notifications, type Database, type Transaction } from '@alvora/db';
import type { NOTIFICATION_KINDS } from '@alvora/shared';

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationInput {
  userId: number;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string | null;
}

type Emitter = (userId: number, notification: Record<string, unknown>) => void;

let emitter: Emitter | null = null;

/** Wired by the realtime gateway at startup so notifications also push live. */
export function setNotificationEmitter(fn: Emitter | null): void {
  emitter = fn;
}

export async function notify(db: Database | Transaction, input: NotificationInput): Promise<void> {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? '',
      href: input.href ?? null,
    })
    .returning();
  if (row && emitter) {
    emitter(input.userId, {
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      href: row.href,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    });
  }
}

export async function notifyMany(db: Database | Transaction, inputs: NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const rows = await db
    .insert(notifications)
    .values(
      inputs.map((input) => ({
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? '',
        href: input.href ?? null,
      })),
    )
    .returning();
  if (!emitter) return;
  for (const row of rows) {
    emitter(row.userId, {
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      href: row.href,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    });
  }
}
