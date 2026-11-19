import type { ProjectFile, ReviewFinding } from '@make-it-ai/shared';
import { reviewFiles } from '@make-it-ai/dev-engine';
import type { GitHubClient, GitHubPullRequestFile } from './client';

export interface PullRequestReview {
  number: number;
  title: string;
  url: string;
  filesReviewed: number;
  findings: ReviewFinding[];
  summary: string;
  aiSummary?: string;
}

export async function reviewPullRequest(
  client: GitHubClient,
  owner: string,
  name: string,
  number: number,
  options: { summarize?: (diff: string) => Promise<string> } = {},
): Promise<PullRequestReview> {
  const [pullRequest, files] = await Promise.all([
    client.getPullRequest(owner, name, number),
    client.listPullRequestFiles(owner, name, number),
  ]);

  const projectFiles: ProjectFile[] = files
    .filter((file: GitHubPullRequestFile) => file.status !== 'removed' && file.patch)
    .map((file) => ({
      path: file.filename,
      content: file.patch ?? '',
      language: file.filename.split('.').pop() ?? 'text',
      size: file.patch?.length ?? 0,
    }));

  const review = reviewFiles(projectFiles);
  const diff = files.map((file) => `--- ${file.filename}\n${file.patch ?? ''}`).join('\n');
  const aiSummary = options.summarize ? await options.summarize(diff.slice(0, 20_000)) : undefined;

  return {
    number: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.html_url,
    filesReviewed: projectFiles.length,
    findings: review.findings,
    summary: review.summary,
    aiSummary,
  };
}
