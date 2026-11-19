import { AppError } from '@make-it-ai/shared';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  html_url: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

export interface GitHubCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  html_url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  user: { login: string };
  html_url: string;
  created_at: string;
}

export interface GitHubPullRequestFile {
  filename: string;
  status: string;
  patch?: string;
  additions: number;
  deletions: number;
}

export interface GitHubContributor {
  login: string;
  contributions: number;
  type: string;
}

export class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl = 'https://api.github.com',
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.token) throw new AppError('UNAUTHORIZED', 'GitHub token is not configured');
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'make-it-ai',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404) throw new AppError('NOT_FOUND', `GitHub resource not found: ${path}`);
    if (response.status === 401 || response.status === 403) {
      throw new AppError('FORBIDDEN', `GitHub denied access (${response.status})`);
    }
    if (response.status === 429) throw new AppError('RATE_LIMITED', 'GitHub API rate limit exceeded');
    if (!response.ok) throw new AppError('BAD_REQUEST', `GitHub request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }

  listRepositories(perPage = 100): Promise<GitHubRepo[]> {
    return this.request<GitHubRepo[]>(`/user/repos?per_page=${perPage}&sort=updated`);
  }

  getRepository(owner: string, name: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${name}`);
  }

  listBranches(owner: string, name: string): Promise<Array<{ name: string; commit: { sha: string } }>> {
    return this.request(`/repos/${owner}/${name}/branches?per_page=100`);
  }

  listCommits(owner: string, name: string, branch?: string, perPage = 30): Promise<GitHubCommit[]> {
    const query = branch ? `?sha=${encodeURIComponent(branch)}&per_page=${perPage}` : `?per_page=${perPage}`;
    return this.request<GitHubCommit[]>(`/repos/${owner}/${name}/commits${query}`);
  }

  listPullRequests(owner: string, name: string, state: 'open' | 'closed' | 'all' = 'all'): Promise<GitHubPullRequest[]> {
    return this.request<GitHubPullRequest[]>(`/repos/${owner}/${name}/pulls?state=${state}&per_page=100`);
  }

  getPullRequest(owner: string, name: string, number: number): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/repos/${owner}/${name}/pulls/${number}`);
  }

  listPullRequestFiles(owner: string, name: string, number: number): Promise<GitHubPullRequestFile[]> {
    return this.request<GitHubPullRequestFile[]>(`/repos/${owner}/${name}/pulls/${number}/files?per_page=100`);
  }

  listIssues(owner: string, name: string): Promise<Array<{ number: number; title: string; state: string; html_url: string }>> {
    return this.request(`/repos/${owner}/${name}/issues?state=all&per_page=100`);
  }

  listContributors(owner: string, name: string): Promise<GitHubContributor[]> {
    return this.request<GitHubContributor[]>(`/repos/${owner}/${name}/contributors?per_page=100`);
  }

  createReviewComment(
    owner: string,
    name: string,
    number: number,
    body: string,
    event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES' = 'COMMENT',
  ): Promise<{ id: number }> {
    return this.request(`/repos/${owner}/${name}/pulls/${number}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ body, event }),
    });
  }
}
