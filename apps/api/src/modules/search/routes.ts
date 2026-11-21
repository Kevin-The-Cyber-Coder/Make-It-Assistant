import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { AppError } from '@make-it-ai/shared';
import type { AppContext } from '../../context';
import { requireAuth } from '../../middleware';

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(160),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

type ResultType = 'project' | 'conversation' | 'task' | 'repository' | 'scan' | 'review' | 'test-run' | 'message' | 'audit';

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle: string;
  path: string;
  score: number;
  updatedAt?: string;
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request, response, next) => {
    handler(request, response).catch(next);
  };
}

function textScore(value: unknown, needle: string): number {
  if (typeof value !== 'string' && typeof value !== 'number') return 0;
  const text = String(value).toLowerCase();
  if (!text) return 0;
  if (text === needle) return 100;
  if (text.startsWith(needle)) return 60;
  const index = text.indexOf(needle);
  return index >= 0 ? Math.max(10, 30 - Math.min(index, 20)) : 0;
}

function timestampOf(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.updatedAt === 'string') return record.updatedAt;
  if (typeof record.createdAt === 'string') return record.createdAt;
  return undefined;
}

function subtitle(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, 160) : fallback;
}

function collect<T>(items: T[], make: (item: T) => SearchResult | null): SearchResult[] {
  return items.flatMap((item) => {
    const result = make(item);
    return result ? [result] : [];
  });
}

export function createSearchRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.get('/', asyncRoute(async (request, response) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid search query', parsed.error.flatten());
    }
    const needle = parsed.data.q.toLowerCase();
    const organizationId = request.actor!.organizationId;
    const repositories = context.db.repositories;
    const recent = { field: 'createdAt', direction: 'desc' as const };

    const [projects, conversations, tasks, connections, scans, reviews, runs, messages, audits] = await Promise.all([
      repositories.projects.find({ where: { organizationId }, limit: 500 }),
      repositories.conversations.find({ where: { organizationId }, sort: recent, limit: 500 }),
      repositories.agentTasks.find({ where: { organizationId }, sort: recent, limit: 500 }),
      repositories.repositories.find({ where: { organizationId }, limit: 500 }),
      repositories.securityScans.find({ where: { organizationId }, sort: recent, limit: 200 }),
      repositories.codeReviews.find({ where: { organizationId }, sort: recent, limit: 500 }),
      repositories.testRuns.find({ where: { organizationId }, sort: recent, limit: 500 }),
      repositories.messages.find({ where: { organizationId }, sort: recent, limit: 1000 }),
      repositories.auditLogs.find({ where: { organizationId }, sort: recent, limit: 500 }),
    ]);

    const results = [
      ...collect(projects, (item) => {
        const score = textScore(item.name, needle) * 3
          + textScore(item.description, needle)
          + textScore(item.languages.join(' '), needle)
          + textScore(item.frameworks.join(' '), needle);
        return score ? {
          type: 'project' as const,
          id: item.id,
          title: item.name,
          subtitle: subtitle(item.description, 'Project'),
          path: `/projects?project=${encodeURIComponent(item.id)}`,
          score,
          updatedAt: timestampOf(item),
        } : null;
      }),
      ...collect(conversations, (item) => {
        const score = textScore(item.title, needle) * 2 + textScore(item.id, needle);
        return score ? {
          type: 'conversation' as const,
          id: item.id,
          title: item.title || 'Untitled conversation',
          subtitle: 'AI conversation',
          path: `/assistant?conversation=${encodeURIComponent(item.id)}`,
          score,
          updatedAt: timestampOf(item),
        } : null;
      }),
      ...collect(tasks, (item) => {
        const score = textScore(item.objective, needle) * 2 + textScore(item.status, needle) + textScore(item.id, needle);
        return score ? {
          type: 'task' as const,
          id: item.id,
          title: subtitle(item.objective, item.id),
          subtitle: `Agent task · ${item.status}`,
          path: `/agents?task=${encodeURIComponent(item.id)}`,
          score,
          updatedAt: timestampOf(item),
        } : null;
      }),
      ...collect(connections, (item) => {
        const score = textScore(item.name, needle) * 2 + textScore(item.owner, needle) + textScore(item.htmlUrl, needle);
        return score ? {
          type: 'repository' as const,
          id: item.id,
          title: `${item.owner}/${item.name}`,
          subtitle: `GitHub repository · ${item.defaultBranch}`,
          path: `/github?repository=${encodeURIComponent(item.id)}`,
          score,
          updatedAt: timestampOf(item),
        } : null;
      }),
      ...collect(scans, (item) => {
        const findings = item.findings.map((finding) => `${finding.title} ${finding.filePath ?? ''}`).join(' ');
        const score = textScore(item.id, needle) + textScore(item.status, needle) + textScore(findings, needle);
        return score ? {
          type: 'scan' as const,
          id: item.id,
          title: `Security scan · ${item.status}`,
          subtitle: subtitle(findings, `${item.findings.length} findings`),
          path: `/security?scan=${encodeURIComponent(item.id)}`,
          score,
          updatedAt: timestampOf(item),
        } : null;
      }),
      ...collect(reviews, (item) => {
        const findings = item.findings.map((finding) => `${finding.title} ${finding.filePath}`).join(' ');
        const score = textScore(item.title, needle) * 2 + textScore(item.summary, needle) + textScore(findings, needle);
        return score ? {
          type: 'review' as const,
          id: item.id,
          title: item.title || 'Code review',
          subtitle: subtitle(item.summary, `${item.findings.length} findings`),
          path: `/reviews?review=${encodeURIComponent(item.id)}`,
          score,
          updatedAt: timestampOf(item),
        } : null;
      }),
      ...collect(runs, (item) => {
        const score = textScore(item.command, needle) * 2 + textScore(item.framework, needle) + textScore(item.status, needle);
        return score ? {
          type: 'test-run' as const,
          id: item.id,
          title: `${item.framework} · ${item.status}`,
          subtitle: subtitle(item.command, 'Generated test run'),
          path: `/testing?run=${encodeURIComponent(item.id)}`,
          score,
          updatedAt: timestampOf(item),
        } : null;
      }),
      ...collect(messages, (item) => {
        const score = textScore(item.content, needle);
        return score ? {
          type: 'message' as const,
          id: item.id,
          title: subtitle(item.content, 'Conversation message'),
          subtitle: `Message · ${item.role}`,
          path: `/assistant?conversation=${encodeURIComponent(item.conversationId)}`,
          score,
          updatedAt: timestampOf(item),
        } : null;
      }),
      ...collect(audits, (item) => {
        const score = textScore(item.action, needle) * 2 + textScore(item.resource, needle) + textScore(item.resourceId, needle);
        return score ? {
          type: 'audit' as const,
          id: item.id,
          title: item.action,
          subtitle: subtitle(item.resourceId, `${item.resource} event`),
          path: `/audit?event=${encodeURIComponent(item.id)}`,
          score,
          updatedAt: timestampOf(item),
        } : null;
      }),
    ].sort((a, b) => b.score - a.score || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

    const limited = results.slice(0, parsed.data.limit);
    const byType = limited.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, {});

    response.json({ query: parsed.data.q, results: limited, total: results.length, byType });
  }));

  return router;
}
