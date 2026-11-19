import { Router } from 'express';
import { GitHubClient, repositoryActivity } from '@make-it-ai/github-integration';
import type { AppContext } from '../../context';
import { requireAuth } from '../../middleware';

export function createAnalyticsRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.get('/overview', async (request, response) => {
    const organizationId = request.actor!.organizationId;
    const repositories = context.db.repositories;
    const [projects, tasks, connections, scans, reviews, runs, usage, conversations] = await Promise.all([
      repositories.projects.find({ where: { organizationId }, limit: 200 }),
      repositories.agentTasks.find({ where: { organizationId }, limit: 500 }),
      repositories.repositories.find({ where: { organizationId }, limit: 200 }),
      repositories.securityScans.find({ where: { organizationId }, sort: { field: 'createdAt', direction: 'desc' }, limit: 20 }),
      repositories.codeReviews.find({ where: { organizationId }, limit: 200 }),
      repositories.testRuns.find({ where: { organizationId }, sort: { field: 'createdAt', direction: 'desc' }, limit: 20 }),
      repositories.modelUsage.find({ where: { organizationId }, limit: 2000 }),
      repositories.conversations.find({ where: { organizationId }, sort: { field: 'updatedAt', direction: 'desc' }, limit: 5 }),
    ]);

    const taskStatuses = tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    }, {});
    const providerUsage = usage.reduce<Record<string, number>>((acc, record) => {
      acc[record.provider] = (acc[record.provider] ?? 0) + record.promptTokens + record.completionTokens;
      return acc;
    }, {});

    let recentCommits: ReturnType<typeof repositoryActivity>['recentCommits'] = [];
    if (context.env.GITHUB_TOKEN && connections[0]) {
      try {
        const client = new GitHubClient(context.env.GITHUB_TOKEN);
        const commits = await client.listCommits(connections[0].owner, connections[0].name);
        recentCommits = repositoryActivity(commits, []).recentCommits;
      } catch {
        recentCommits = [];
      }
    }

    response.json({
      overview: {
        totalProjects: projects.length,
        activeAgentTasks: (taskStatuses.running ?? 0) + (taskStatuses.awaiting_approval ?? 0) + (taskStatuses.planning ?? 0),
        completedTasks: taskStatuses.completed ?? 0,
        failedTasks: taskStatuses.failed ?? 0,
        connectedRepositories: connections.length,
        recentCommits,
        codeReviews: reviews.length,
        securityFindings: scans[0]?.summary ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        testRuns: runs.length,
        aiRequests: usage.length,
        tokensUsed: usage.reduce((total, record) => total + record.promptTokens + record.completionTokens, 0),
        providerUsage,
        recentConversations: conversations.map((conversation) => ({ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt })),
        storageMode: context.db.mode,
      },
    });
  });

  router.get('/usage', async (request, response) => {
    const usage = await context.db.repositories.modelUsage.find({
      where: { organizationId: request.actor!.organizationId },
      sort: { field: 'createdAt', direction: 'desc' },
      limit: 200,
    });
    response.json({ usage });
  });

  return router;
}
