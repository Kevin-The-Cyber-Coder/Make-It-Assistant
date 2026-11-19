import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuditLog } from '@make-it-ai/shared';
import type { AppContext } from '../context';

export async function audit(
  context: AppContext,
  request: Request,
  action: string,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const actor = request.actor;
  const entry: AuditLog = {
    id: randomUUID(),
    organizationId: actor?.organizationId,
    actorId: actor?.userId,
    action,
    resource,
    resourceId,
    metadata,
    ip: request.ip,
    createdAt: new Date().toISOString(),
  };
  await context.db.repositories.auditLogs.create(entry);
}
