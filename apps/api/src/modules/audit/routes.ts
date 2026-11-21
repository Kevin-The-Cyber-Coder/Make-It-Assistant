import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { AppError, type AuditLog } from '@make-it-ai/shared';
import type { AppContext } from '../../context';
import { requireAuth } from '../../middleware';
import { audit } from '../../lib/audit';

const auditFilterSchema = z.object({
  action: z.string().trim().max(120).optional(),
  resource: z.string().trim().max(120).optional(),
  actorId: z.string().trim().max(120).optional(),
  resourceId: z.string().trim().max(200).optional(),
  q: z.string().trim().max(160).optional(),
});

const auditQuerySchema = auditFilterSchema.extend({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

const auditExportSchema = auditFilterSchema.extend({
  format: z.enum(['json', 'csv']).default('json'),
  limit: z.coerce.number().int().min(1).max(5_000).default(1_000),
});

type AuditQuery = z.infer<typeof auditQuerySchema>;
type AuditExportQuery = z.infer<typeof auditExportSchema>;

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

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toAuditCsv(entries: AuditLog[]): string {
  const header = ['id', 'createdAt', 'action', 'resource', 'resourceId', 'actorId', 'organizationId', 'ip', 'metadata'];
  const rows = entries.map((entry) => [
    entry.id,
    entry.createdAt,
    entry.action,
    entry.resource,
    entry.resourceId ?? '',
    entry.actorId ?? '',
    entry.organizationId ?? '',
    entry.ip ?? '',
    entry.metadata ? JSON.stringify(entry.metadata) : '',
  ].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\n');
}

function buildAuditWhere(query: z.infer<typeof auditFilterSchema>, organizationId: string): Record<string, unknown> {
  const where: Record<string, unknown> = { organizationId };
  if (query.action) where.action = query.action;
  if (query.resource) where.resource = query.resource;
  if (query.actorId) where.actorId = query.actorId;
  if (query.resourceId) where.resourceId = query.resourceId;
  return where;
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
    const where = buildAuditWhere(query, request.actor!.organizationId);

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

  router.get('/export', asyncRoute(async (request, response) => {
    const parsed = auditExportSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid audit export query', parsed.error.flatten());
    }
    const query: AuditExportQuery = parsed.data;
    const where = buildAuditWhere(query, request.actor!.organizationId);
    const sort = { field: 'createdAt', direction: 'desc' as const };
    let entries = await context.db.repositories.auditLogs.find({ where, sort, limit: query.limit });
    if (query.q) {
      const needle = query.q.toLowerCase();
      entries = entries.filter((entry) => searchableText(entry).includes(needle));
    }

    await audit(context, request, 'audit.export', 'audit_log', undefined, {
      format: query.format,
      results: entries.length,
      filters: Object.keys(query).filter((key) => query[key as keyof AuditExportQuery] !== undefined),
    });

    if (query.format === 'csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
      response.send(toAuditCsv(entries));
      return;
    }

    response.setHeader('Content-Disposition', 'attachment; filename="audit-log.json"');
    response.json({ entries, total: entries.length, format: 'json' });
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

  router.get('/:id', asyncRoute(async (request, response) => {
    const entry = await context.db.repositories.auditLogs.findById(request.params.id);
    if (!entry || entry.organizationId !== request.actor!.organizationId) {
      throw new AppError('NOT_FOUND', 'Audit log entry not found');
    }
    response.json({ entry });
  }));

  return router;
}
