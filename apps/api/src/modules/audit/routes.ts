import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { AppError, type AuditLog } from '@make-it-ai/shared';
import type { AppContext } from '../../context';
import { requireAuth } from '../../middleware';
import { audit } from '../../lib/audit';

const auditQuerySchema = z.object({
  action: z.string().trim().max(120).optional(),
  resource: z.string().trim().max(120).optional(),
  actorId: z.string().trim().max(120).optional(),
  resourceId: z.string().trim().max(200).optional(),
  q: z.string().trim().max(160).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

type AuditQuery = z.infer<typeof auditQuerySchema>;

function searchableText(entry: AuditLog): string {
  return [
    entry.action,
    entry.resource,
    entry.resourceId ?? '',
    entry.actorId ?? '',
    entry.ip ?? '',
    entry.metadata ? JSON.stringify(entry.metadata) : '',
  ].join(' ').toLowerCase();
}

function countBy(entries: AuditLog[], key: (entry: AuditLog) => string | undefined) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const name = key(entry) ?? 'unknown';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request, response, next) => {
    handler(request, response).catch(next);
  };
}

export function createAuditRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.get('/', asyncRoute(async (request, response) => {
    const parsed = auditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid audit log query', parsed.error.flatten());
    }
    const query: AuditQuery = parsed.data;
    const organizationId = request.actor!.organizationId;
    const where: Record<string, unknown> = { organizationId };
    if (query.action) where.action = query.action;
    if (query.resource) where.resource = query.resource;
    if (query.actorId) where.actorId = query.actorId;
    if (query.resourceId) where.resourceId = query.resourceId;

    const sort = { field: 'createdAt', direction: 'desc' as const };
    let total: number;
    let entries: AuditLog[];

    if (query.q) {
      const needle = query.q.toLowerCase();
      const matches = (await context.db.repositories.auditLogs.find({ where, sort }))
        .filter((entry) => searchableText(entry).includes(needle));
      total = matches.length;
      entries = matches.slice(query.offset, query.offset + query.limit);
    } else {
      total = await context.db.repositories.auditLogs.count({ where });
      entries = await context.db.repositories.auditLogs.find({ where, sort, limit: query.limit, offset: query.offset });
    }

    await audit(context, request, 'audit.read', 'audit_log', undefined, {
      filters: Object.keys(query).filter((key) => query[key as keyof AuditQuery] !== undefined),
      results: entries.length,
    });

    response.json({ entries, total, limit: query.limit, offset: query.offset });
  }));

  router.get('/summary', asyncRoute(async (request, response) => {
    const entries = await context.db.repositories.auditLogs.find({
      where: { organizationId: request.actor!.organizationId },
    });
    response.json({
      total: entries.length,
      byAction: countBy(entries, (entry) => entry.action),
      byResource: countBy(entries, (entry) => entry.resource),
      byActor: countBy(entries, (entry) => entry.actorId),
    });
  }));

  return router;
}
