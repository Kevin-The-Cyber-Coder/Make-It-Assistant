import { Router } from 'express';
import { AppError, githubConnectSchema } from '@make-it-ai/shared';
import { GitHubClient, repositoryActivity, reviewPullRequest, toRepositoryConnection } from '@make-it-ai/github-integration';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import { requireAuth, validate } from '../../middleware';

function clientFor(context: AppContext, request: Parameters<typeof audit>[1]): GitHubClient {
  const token = request.header('x-github-token') || context.env.GITHUB_TOKEN;
  if (!token) throw new AppError('UNAUTHORIZED', 'No GitHub token configured. Send X-GitHub-Token or set GITHUB_TOKEN.');
  return new GitHubClient(token);
}

export function createGithubRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.get('/repos', async (request, response) => {
    const client = clientFor(context, request);
    const repos = await client.listRepositories();
    response.json({
      repositories: repos.map((repo) => toRepositoryConnection(request.actor!.organizationId, repo)),
    });
  });

  router.post('/connect', validate(githubConnectSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof githubConnectSchema.parse>;
    const client = clientFor(context, request);
    const repo = await client.getRepository(input.owner, input.name);
    const connection = toRepositoryConnection(request.actor!.organizationId, repo);
    const existing = await context.db.repositories.repositories.findById(connection.id);
    if (!existing) await context.db.repositories.repositories.create(connection);
    await audit(context, request, 'github.connect', 'repository', connection.id);
    response.json({ repository: connection });
  });

  router.get('/connections', async (request, response) => {
    const repositories = await context.db.repositories.repositories.find({
      where: { organizationId: request.actor!.organizationId },
      sort: { field: 'createdAt', direction: 'desc' },
    });
    response.json({ repositories });
  });

  router.get('/repos/:owner/:name/commits', async (request, response) => {
    const client = clientFor(context, request);
    const commits = await client.listCommits(request.params.owner, request.params.name, request.query.branch as string | undefined);
    response.json({ commits });
  });

  router.get('/repos/:owner/:name/pulls', async (request, response) => {
    const client = clientFor(context, request);
    const pulls = await client.listPullRequests(request.params.owner, request.params.name);
    response.json({ pullRequests: pulls });
  });

  router.post('/repos/:owner/:name/pulls/:number/review', async (request, response) => {
    const client = clientFor(context, request);
    const review = await reviewPullRequest(client, request.params.owner, request.params.name, Number(request.params.number), {
      summarize: async (diff) => {
        const result = await context.gateway.chat({
          messages: [{ role: 'user', content: `Summarize this pull request diff for a defensive code review:\n${diff}` }],
          taskType: 'general',
          metadata: { organizationId: request.actor!.organizationId, userId: request.actor!.userId },
        });
        return result.content;
      },
    });
    await audit(context, request, 'github.review', 'pull_request', `${request.params.owner}/${request.params.name}#${request.params.number}`);
    response.json({ review });
  });

  router.get('/activity', async (request, response) => {
    const client = clientFor(context, request);
    const owner = String(request.query.owner ?? '');
    const name = String(request.query.name ?? '');
    if (!owner || !name) throw new AppError('BAD_REQUEST', 'owner and name are required');
    const [commits, pulls, issues, contributors] = await Promise.all([
      client.listCommits(owner, name),
      client.listPullRequests(owner, name),
      client.listIssues(owner, name),
      client.listContributors(owner, name),
    ]);
    response.json({
      activity: repositoryActivity(commits, pulls),
      issues: issues.slice(0, 20),
      contributors,
    });
  });

  return router;
}
