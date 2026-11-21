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
    const reviews = await context.db.repositories.codeReviews.find({
      where: { organizationId: request.actor!.organizationId },
      sort: { field: 'createdAt', direction: 'desc' },
      limit: 50,
    });
    response.json({ reviews });
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
    const runs = await context.db.repositories.testRuns.find({
      where: { organizationId: request.actor!.organizationId },
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

  return router;
}
