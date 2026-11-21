import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { debugSchema, reviewSchema, testRunSchema } from '@make-it-ai/shared';
import type { CodeReview, ProjectFile, TestRun } from '@make-it-ai/shared';
import { analyzeError, generateTests, reviewFiles } from '@make-it-ai/dev-engine';
import { detectLanguage } from '@make-it-ai/project-intelligence';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import { requireAuth, validate } from '../../middleware';

function toFiles(files: Array<{ path: string; content: string }>): ProjectFile[] {
  return files.map((file) => ({
    path: file.path,
    content: file.content,
    language: detectLanguage(file.path),
    size: file.content.length,
  }));
}

export function createDevRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.post('/debug/analyze', validate(debugSchema), (request, response) => {
    const input = request.body as ReturnType<typeof debugSchema.parse>;
    const report = analyzeError({ error: input.error, stackTrace: input.stackTrace });
    audit(context, request, 'debug.analyze', 'debug', undefined, { summary: report.summary.slice(0, 120) }).catch(() => undefined);
    response.json({ report });
  });

  router.post('/code/review', validate(reviewSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof reviewSchema.parse>;
    const review = reviewFiles(toFiles(input.files));
    const record: CodeReview = {
      id: `rev_${randomUUID()}`,
      organizationId: request.actor!.organizationId,
      projectId: input.projectId,
      title: input.title ?? 'Source review',
      findings: review.findings,
      summary: review.summary,
      createdAt: new Date().toISOString(),
    };
    await context.db.repositories.codeReviews.create(record);
    await audit(context, request, 'code.review', 'code_review', record.id);
    response.status(201).json({ review: record });
  });

  router.get('/reviews', async (request, response) => {
    const projectId = typeof request.query.projectId === 'string' ? request.query.projectId.trim() : '';
    const q = typeof request.query.q === 'string' ? request.query.q.trim().toLowerCase() : '';
    const where: Record<string, string> = { organizationId: request.actor!.organizationId };
    if (projectId) where.projectId = projectId;
    let reviews = await context.db.repositories.codeReviews.find({
      where,
      sort: { field: 'createdAt', direction: 'desc' },
      limit: q ? 500 : 50,
    });
    if (q) reviews = reviews.filter((review) => `${review.title} ${review.summary}`.toLowerCase().includes(q)).slice(0, 50);
    response.json({ reviews });
  });

  router.get('/reviews/metrics', async (request, response) => {
    const reviews = await context.db.repositories.codeReviews.find({
      where: { organizationId: request.actor!.organizationId },
      sort: { field: 'createdAt', direction: 'desc' },
      limit: 500,
    });
    const bySeverity: Record<string, number> = {};
    let totalFindings = 0;
    for (const review of reviews) {
      for (const finding of review.findings) {
        bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
        totalFindings += 1;
      }
    }
    const latest = reviews[0];
    response.json({
      metrics: {
        totalReviews: reviews.length,
        totalFindings,
        bySeverity,
        latestReview: latest ? { id: latest.id, title: latest.title, findings: latest.findings.length, createdAt: latest.createdAt } : null,
      },
    });
  });

  router.get('/reviews/:id', async (request, response) => {
    const review = await context.db.repositories.codeReviews.findById(request.params.id);
    if (!review || review.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Review not found' } });
      return;
    }
    response.json({ review });
  });

  router.get('/reviews/:id/export', async (request, response) => {
    const review = await context.db.repositories.codeReviews.findById(request.params.id);
    if (!review || review.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Review not found' } });
      return;
    }
    await audit(context, request, 'review.export', 'code_review', review.id, { findings: review.findings.length });
    response.setHeader('Content-Disposition', `attachment; filename="code-review-${review.id}.json"`);
    response.json({ review, exportedAt: new Date().toISOString() });
  });

  router.delete('/reviews/:id', async (request, response) => {
    if (!request.actor!.roles.some((role) => role === 'owner' || role === 'admin')) {
      response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Owner or admin role required' } });
      return;
    }
    const review = await context.db.repositories.codeReviews.findById(request.params.id);
    if (!review || review.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Review not found' } });
      return;
    }
    await context.db.repositories.codeReviews.delete(review.id);
    await audit(context, request, 'review.delete', 'code_review', review.id, { findings: review.findings.length });
    response.json({ success: true });
  });

  router.post('/testing/run', validate(testRunSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof testRunSchema.parse>;
    const generatedTests = generateTests(toFiles(input.files), input.framework);
    const started = Date.now();
    const run: TestRun = {
      id: `tst_${randomUUID()}`,
      organizationId: request.actor!.organizationId,
      projectId: input.projectId,
      status: 'skipped',
      framework: input.framework,
      command: input.command ?? '(no command executed)',
      passed: 0,
      failed: 0,
      durationMs: Date.now() - started,
      output: generatedTests.length
        ? `Generated ${generatedTests.length} test skeleton(s). Execution requires an approved isolated sandbox worker; none is attached.`
        : 'No test skeletons generated. No command was executed.',
      generatedTests,
      createdAt: new Date().toISOString(),
    };
    await context.db.repositories.testRuns.create(run);
    await audit(context, request, 'testing.generate', 'test_run', run.id);
    response.status(201).json({ run });
  });

  router.get('/testing/runs', async (request, response) => {
    const projectId = typeof request.query.projectId === 'string' ? request.query.projectId.trim() : '';
    const status = typeof request.query.status === 'string' ? request.query.status.trim() : '';
    const where: Record<string, string> = { organizationId: request.actor!.organizationId };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    const runs = await context.db.repositories.testRuns.find({
      where,
      sort: { field: 'createdAt', direction: 'desc' },
      limit: 50,
    });
    response.json({ runs });
  });

  router.get('/testing/metrics', async (request, response) => {
    const runs = await context.db.repositories.testRuns.find({
      where: { organizationId: request.actor!.organizationId },
      sort: { field: 'createdAt', direction: 'desc' },
      limit: 500,
    });
    const byStatus: Record<string, number> = {};
    let generatedTests = 0;
    for (const run of runs) {
      byStatus[run.status] = (byStatus[run.status] ?? 0) + 1;
      generatedTests += run.generatedTests.length;
    }
    const latest = runs[0];
    response.json({
      metrics: {
        totalRuns: runs.length,
        byStatus,
        generatedTests,
        latestRun: latest ? { id: latest.id, status: latest.status, framework: latest.framework, createdAt: latest.createdAt } : null,
      },
    });
  });

  router.get('/testing/runs/:id', async (request, response) => {
    const run = await context.db.repositories.testRuns.findById(request.params.id);
    if (!run || run.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Test run not found' } });
      return;
    }
    response.json({ run });
  });

  router.get('/testing/runs/:id/export', async (request, response) => {
    const run = await context.db.repositories.testRuns.findById(request.params.id);
    if (!run || run.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Test run not found' } });
      return;
    }
    await audit(context, request, 'testing.export', 'test_run', run.id, { generatedTests: run.generatedTests.length });
    response.setHeader('Content-Disposition', `attachment; filename="test-run-${run.id}.json"`);
    response.json({ run, exportedAt: new Date().toISOString() });
  });

  router.delete('/testing/runs/:id', async (request, response) => {
    if (!request.actor!.roles.some((role) => role === 'owner' || role === 'admin')) {
      response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Owner or admin role required' } });
      return;
    }
    const run = await context.db.repositories.testRuns.findById(request.params.id);
    if (!run || run.organizationId !== request.actor!.organizationId) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Test run not found' } });
      return;
    }
    await context.db.repositories.testRuns.delete(run.id);
    await audit(context, request, 'testing.delete', 'test_run', run.id, { generatedTests: run.generatedTests.length });
    response.json({ success: true });
  });

  return router;
}
