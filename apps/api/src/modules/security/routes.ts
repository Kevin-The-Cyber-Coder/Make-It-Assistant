import { Router } from 'express';
import { scanSchema } from '@make-it-ai/shared';
import type { ProjectFile } from '@make-it-ai/shared';
import { OWASP_TOP_10, riskLevel, scanSource, scanSourceLive } from '@make-it-ai/security-engine';
import { detectLanguage } from '@make-it-ai/project-intelligence';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import { requireAuth, validate } from '../../middleware';

function toProjectFiles(input: ReturnType<typeof scanSchema.parse>): ProjectFile[] {
  return input.files.map((file) => ({
    path: file.path,
    content: file.content,
    language: detectLanguage(file.path),
    size: file.content.length,
  }));
}

export function createSecurityRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.post('/scan', validate(scanSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof scanSchema.parse>;
    const files = toProjectFiles(input);
    const scan = scanSource(request.actor!.organizationId, files, { projectId: input.projectId });
    await context.db.repositories.securityScans.create(scan);
    await audit(context, request, 'security.scan', 'security_scan', scan.id, {
      files: scan.filesScanned,
      findings: scan.findings.length,
    });
    context.bus.publish({
      type: 'security:scan:completed',
      organizationId: request.actor!.organizationId,
      message: `Security scan completed with ${scan.findings.length} findings`,
      payload: { scanId: scan.id, risk: riskLevel(scan) },
    });
    response.status(201).json({ scan, risk: riskLevel(scan) });
  });

  router.post('/scan/live', validate(scanSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof scanSchema.parse>;
    const files = toProjectFiles(input);
    const { scan, advisory } = await scanSourceLive(request.actor!.organizationId, files, {
      projectId: input.projectId,
      osv: {
        enabled: context.env.OSV_ENABLED,
        baseUrl: context.env.OSV_API_URL,
        timeoutMs: context.env.OSV_TIMEOUT_MS,
        maxPackages: context.env.OSV_MAX_PACKAGES,
      },
    });
    await context.db.repositories.securityScans.create(scan);
    await audit(context, request, 'security.scan.live', 'security_scan', scan.id, {
      files: scan.filesScanned,
      findings: scan.findings.length,
      queriedPackages: advisory?.queriedPackages ?? 0,
      advisorySuccess: advisory?.success ?? false,
    });
    context.bus.publish({
      type: 'security:scan:completed',
      organizationId: request.actor!.organizationId,
      message: `Live dependency scan completed with ${scan.findings.length} findings`,
      payload: { scanId: scan.id, risk: riskLevel(scan), advisory: advisory?.success ?? false },
    });
    response.status(201).json({
      scan,
      risk: riskLevel(scan),
      advisory: advisory
        ? {
            source: advisory.source,
            queriedAt: advisory.queriedAt,
            queriedPackages: advisory.queriedPackages,
            success: advisory.success,
            error: advisory.error,
          }
        : { source: 'osv', success: false, reason: 'OSV integration disabled' },
    });
  });

  router.get('/scans', async (request, response) => {
    const projectId = typeof request.query.projectId === 'string' ? request.query.projectId.trim() : '';
    const where: Record<string, string> = { organizationId: request.actor!.organizationId };
    if (projectId) where.projectId = projectId;
    const scans = await context.db.repositories.securityScans.find({
      where,
      sort: { field: 'createdAt', direction: 'desc' },
      limit: 50,
    });
    response.json({ scans });
  });

  router.get('/metrics', async (request, response) => {
    const scans = await context.db.repositories.securityScans.find({
      where: { organizationId: request.actor!.organizationId },
      sort: { field: 'createdAt', direction: 'desc' },
      limit: 500,
    });
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const cumulative: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    let scansLast24h = 0;
    for (const scan of scans) {
      for (const severity of Object.keys(cumulative)) {
        cumulative[severity] += scan.summary?.[severity as keyof typeof scan.summary] ?? 0;
      }
      if (Date.parse(scan.createdAt) >= dayAgo) scansLast24h += 1;
    }
    const latest = scans[0];
    response.json({
      metrics: {
        totalScans: scans.length,
        scansLast24h,
        cumulativeFindingsBySeverity: cumulative,
        latestScan: latest ? {
          id: latest.id,
          createdAt: latest.createdAt,
          filesScanned: latest.filesScanned,
          findings: latest.findings.length,
          summary: latest.summary,
          risk: riskLevel(latest),
        } : null,
      },
    });
  });

  router.get('/scans/:id/export', async (request, response) => {
    const scan = await context.db.repositories.securityScans.findById(request.params.id);
    if (!scan || scan.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scan not found' } });
      return;
    }
    await audit(context, request, 'security.scan.export', 'security_scan', scan.id, { findings: scan.findings.length });
    response.setHeader('Content-Disposition', `attachment; filename="security-scan-${scan.id}.json"`);
    response.json({ scan, risk: riskLevel(scan), exportedAt: new Date().toISOString() });
  });

  router.get('/scans/:id', async (request, response) => {
    const scan = await context.db.repositories.securityScans.findById(request.params.id);
    if (!scan || scan.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scan not found' } });
      return;
    }
    response.json({ scan, risk: riskLevel(scan) });
  });

  router.delete('/scans/:id', async (request, response) => {
    if (!request.actor!.roles.some((role) => role === 'owner' || role === 'admin')) {
      response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Owner or admin role required' } });
      return;
    }
    const scan = await context.db.repositories.securityScans.findById(request.params.id);
    if (!scan || scan.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scan not found' } });
      return;
    }
    await context.db.repositories.securityScans.delete(scan.id);
    await audit(context, request, 'security.scan.delete', 'security_scan', scan.id, { findings: scan.findings.length });
    response.json({ success: true });
  });

  router.get('/owasp', (_request, response) => {
    response.json({ categories: OWASP_TOP_10 });
  });

  return router;
}
