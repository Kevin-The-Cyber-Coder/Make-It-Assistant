import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Github, Link2, RefreshCw } from 'lucide-react';
import { api, apiRequest } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface Repository {
  id: string;
  owner: string;
  name: string;
  htmlUrl: string;
  defaultBranch: string;
  createdAt: string;
}

interface PullRequest {
  number: number;
  title: string;
  state: string;
  html_url: string;
}

interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface ActivityData {
  commitCount: number;
  mergedPullRequests: number;
  openPullRequests: number;
  uniqueAuthors: string[];
  lastCommitAt?: string;
  recentCommits: Commit[];
}

export function GitHubPage() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [repos, setRepos] = useState<Repository[]>([]);
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const connections = useQuery({ queryKey: ['github-connections'], queryFn: () => api.get<{ repositories: Repository[] }>('/github/connections') });

  function headers(): Record<string, string> {
    return token.trim() ? { 'X-GitHub-Token': token.trim() } : {};
  }

  async function loadRepositories() {
    setBusy(true);
    setNotice('');
    try {
      const result = await apiRequest<{ repositories: Repository[] }>('/github/repos', { headers: headers() });
      setRepos(result.repositories);
      setNotice(`${result.repositories.length} repositories available from GitHub.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not load repositories');
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (!owner.trim() || !repoName.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      await apiRequest('/github/connect', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ owner: owner.trim(), name: repoName.trim() }),
      });
      await queryClient.invalidateQueries({ queryKey: ['github-connections'] });
      setNotice(`Connected ${owner}/${repoName}.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Connection failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadActivity(target: Repository) {
    setBusy(true);
    setNotice('');
    try {
      const [activityResult, pullResult] = await Promise.all([
        apiRequest<{ activity: ActivityData }>(`/github/activity?owner=${encodeURIComponent(target.owner)}&name=${encodeURIComponent(target.name)}`, { headers: headers() }),
        apiRequest<{ pullRequests: PullRequest[] }>(`/github/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/pulls`, { headers: headers() }),
      ]);
      setActivity(activityResult.activity);
      setPulls(pullResult.pullRequests);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not load repository activity');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="GitHub workspace"
        description="Connect repositories, inspect genuine commit and pull-request activity, and run defensive reviews on pull requests."
        actions={<Badge className="border-accent-400/30 bg-accent-500/10 text-accent-400"><Github className="mr-1 h-3 w-3" /> REST integration</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="label mb-3">Access</div>
            <Input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="GitHub token (session only)" />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">Leave blank to use the server-configured GITHUB_TOKEN. Tokens entered here are not persisted.</p>
            <Button className="mt-3 w-full" variant="outline" onClick={() => void loadRepositories()} disabled={busy}>
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Load repositories
            </Button>
          </Card>

          <Card className="p-5">
            <div className="label mb-3">Connect repository</div>
            <div className="space-y-2">
              <Input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="owner" />
              <Input value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder="repository" />
              <Button className="w-full" onClick={() => void connect()} disabled={busy || !owner.trim() || !repoName.trim()}>
                <Link2 className="h-4 w-4" /> Connect
              </Button>
            </div>
          </Card>

          <Card>
            <div className="panel-header"><div className="label">Connections</div><Badge>{connections.data?.repositories.length ?? 0}</Badge></div>
            {connections.data?.repositories.length ? (
              <div className="divide-y divide-white/5">
                {connections.data.repositories.map((repository) => (
                  <button key={repository.id} onClick={() => void loadActivity(repository)} className="block w-full px-5 py-3 text-left transition hover:bg-white/[0.02]">
                    <div className="text-sm text-slate-200">{repository.owner}/{repository.name}</div>
                    <div className="mt-1 text-[11px] text-slate-600">{repository.defaultBranch} · connected {formatDate(repository.createdAt)}</div>
                  </button>
                ))}
              </div>
            ) : <EmptyState title="No connections" description="Connect a repository to begin." icon={<Github className="h-5 w-5" />} />}
          </Card>
        </div>

        <div className="space-y-5">
          {notice && <div className="rounded-lg border border-accent-400/20 bg-accent-500/10 px-4 py-3 text-xs text-accent-300">{notice}</div>}
          {repos.length > 0 && (
            <Card>
              <div className="panel-header"><div className="label">Available repositories</div><Badge>{repos.length}</Badge></div>
              <div className="max-h-64 divide-y divide-white/5 overflow-y-auto">
                {repos.map((repository) => (
                  <button key={repository.id} onClick={() => { setOwner(repository.owner); setRepoName(repository.name); void loadActivity(repository); }} className="flex w-full items-center gap-3 px-5 py-3 text-left text-xs text-slate-300 hover:bg-white/[0.02]">
                    <Github className="h-3.5 w-3.5 text-slate-600" />
                    <span className="truncate">{repository.owner}/{repository.name}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-600">{repository.defaultBranch}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {busy && !repos.length && !activity && <Card className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6" /></Card>}

          {activity && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="p-5"><div className="label">Commits</div><div className="mt-2 text-3xl font-semibold text-white">{activity.commitCount ?? 0}</div></Card>
                <Card className="p-5"><div className="label">Open pull requests</div><div className="mt-2 text-3xl font-semibold text-accent-400">{activity.openPullRequests ?? 0}</div></Card>
                <Card className="p-5"><div className="label">Merged</div><div className="mt-2 text-3xl font-semibold text-mint">{activity.mergedPullRequests ?? 0}</div></Card>
              </div>
              <Card>
                <div className="panel-header"><div className="label">Recent commits</div><Activity className="h-4 w-4 text-slate-600" /></div>
                <div className="divide-y divide-white/5">
                  {(activity.recentCommits ?? []).slice(0, 10).map((commit) => (
                    <a key={commit.sha} href={commit.url} target="_blank" rel="noreferrer" className="block px-5 py-3 transition hover:bg-white/[0.02]">
                      <div className="truncate text-sm text-slate-200">{commit.message}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-600">{commit.sha.slice(0, 7)} · {commit.author} · {formatDate(commit.date)}</div>
                    </a>
                  ))}
                </div>
              </Card>
              <Card>
                <div className="panel-header"><div className="label">Pull requests</div><Badge>{pulls.length}</Badge></div>
                <div className="divide-y divide-white/5">
                  {pulls.slice(0, 10).map((pull) => (
                    <a key={pull.number} href={pull.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-5 py-3 text-sm text-slate-300 transition hover:bg-white/[0.02]">
                      <Badge>#{pull.number}</Badge>
                      <span className="truncate">{pull.title}</span>
                      <span className="ml-auto text-[11px] text-slate-600">{pull.state}</span>
                    </a>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
