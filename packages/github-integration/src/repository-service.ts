import type { RepositoryConnection } from '@make-it-ai/shared';
import type { GitHubCommit, GitHubPullRequest, GitHubRepo } from './client';

export function toRepositoryConnection(organizationId: string, repo: GitHubRepo): RepositoryConnection {
  return {
    id: `gh-${repo.id}`,
    organizationId,
    provider: 'github',
    owner: repo.owner.login,
    name: repo.name,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    createdAt: new Date().toISOString(),
  };
}

export function repositoryActivity(
  commits: GitHubCommit[],
  pullRequests: GitHubPullRequest[],
): {
  commitCount: number;
  mergedPullRequests: number;
  openPullRequests: number;
  uniqueAuthors: string[];
  lastCommitAt?: string;
  recentCommits: Array<{ sha: string; message: string; author: string; date: string; url: string }>;
} {
  const authors = new Set(commits.map((commit) => commit.commit.author.name));
  return {
    commitCount: commits.length,
    mergedPullRequests: pullRequests.filter((pr) => Boolean(pr.merged_at)).length,
    openPullRequests: pullRequests.filter((pr) => pr.state === 'open').length,
    uniqueAuthors: [...authors],
    lastCommitAt: commits[0]?.commit.author.date,
    recentCommits: commits.slice(0, 10).map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url,
    })),
  };
}
