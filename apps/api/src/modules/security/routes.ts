import { Router } from 'express';
import { scanSchema } from '@make-it-ai/shared';
import type { ProjectFile } from '@make-it-ai/shared';
import { OWASP_TOP_10, riskLevel, scanSource } from '@make-it-ai/security-engine';
import { detectLanguage } from '@make-it-ai/project-intelligence';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import { requireAuth, validate } from '../../middleware';

export function createSecurityRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.post('/scan', validate(scanSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof scanSchema.parse>;
    const files: ProjectFile[] = input.files.map((file) => ({
      path: file.path,
      content: file.content,
      language: detectLanguage(file.path),
      size: file.content.length,
    }));
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

  router.get('/scans', async (request, response) => {
    const scans = await context.db.repositories.securityScans.find({
      where: { organizationId: request.actor!.organizationId },
      sort: { field: 'createdAt', direction: 'desc' },
      limit: 50,
    });
    response.json({ scans });
  });

  router.get('/scans/:id', async (request, response) => {
    const scan = await context.db.repositories.securityScans.findById(request.params.id);
    if (!scan || scan.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scan not found' } });
      return;
    }
    response.json({ scan, risk: riskLevel(scan) });
  });

  router.get('/owasp', (_request, response) => {
    response.json({ categories: OWASP_TOP_10 });
  });

  return router;
}
