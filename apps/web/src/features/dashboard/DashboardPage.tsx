import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { ArrowUpRight, Bot, FileClock, FolderGit2, GitPullRequest, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import type { AuditSummary, Overview } from '@/lib/types';
import { Badge, Card, EmptyState, PageHeader, StatCard, Spinner } from '@/components/ui';
import { formatDate, severityClass, timeAgo } from '@/lib/utils';

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['overview'], queryFn: () => api.get<{ overview: Overview }>('/analytics/overview'), refetchInterval: 20_000 });
  const audit = useQuery({ queryKey: ['audit-summary-dashboard'], queryFn: () => api.get<AuditSummary>('/audit/summary'), refetchInterval: 30_000 });

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6" /></div>;
  if (error || !data) return <EmptyState title="Dashboard unavailable" description={error instanceof Error ? error.message : 'Could not load metrics.'} />;

  const overview = data.overview;
  const providerData = Object.entries(overview.providerUsage ?? {}).map(([name, value]) => ({ name, tokens: value }));
  const severityData = Object.entries(overview.securityFindings ?? {}).filter(([, value]) => value > 0).map(([name, value]) => ({ name, value }));
  const severityColors: Record<string, string> = { critical: '#fb7185', high: '#fb923c', medium: '#fbbf24', low: '#38bdf8', info: '#94a3b8' };

  return (
    <>
      <PageHeader
        eyebrow="Command center"
        title="Engineering overview"
        description="Live project, agent, security and AI usage signals from your connected workspace."
        actions={<Badge className="border-mint/30 bg-mint/10 text-mint">Storage: {overview.storageMode}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Projects" value={overview.totalProjects} hint="Indexed workspaces" />
        <StatCard label="Active agents" value={overview.activeAgentTasks} hint={`${overview.completedTasks} completed tasks`} tone="accent" />
        <StatCard label="Security findings" value={Object.values(overview.securityFindings ?? {}).reduce((a, b) => a + b, 0)} hint="Latest scan" tone="rose" />
        <StatCard label="AI requests" value={overview.aiRequests} hint={`${overview.tokensUsed.toLocaleString()} tokens`} tone="mint" />
        <StatCard label="Audit events" value={audit.data?.total ?? 0} hint={audit.data?.byAction[0] ? `Top: ${audit.data.byAction[0].name}` : 'Org activity'} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="panel-header -mx-5 -mt-5 mb-4">
            <div><div className="label">AI usage</div><div className="mt-1 text-sm font-medium text-white">Tokens by provider</div></div>
            <Sparkles className="h-4 w-4 text-accent-400" />
          </div>
          {providerData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={providerData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2740" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#11172a', border: '1px solid #222c49', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="tokens" fill="#5b7cfa" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No usage yet" description="Send an AI request to populate provider analytics." />}
        </Card>

        <Card className="p-5">
          <div className="label mb-1">Risk profile</div>
          <div className="mb-3 text-sm font-medium text-white">Latest security scan</div>
          {severityData.length ? (
            <div className="flex h-64 items-center gap-3">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3}>
                    {severityData.map((entry) => <Cell key={entry.name} fill={severityColors[entry.name] ?? '#64748b'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#11172a', border: '1px solid #222c49', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {severityData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: severityColors[item.name] }} />
                    <span className="capitalize text-slate-400">{item.name}</span>
                    <span className="ml-auto font-mono text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="flex h-64 items-center justify-center text-sm text-slate-600">No findings recorded</div>}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="panel-header">
            <div><div className="label">Activity</div><div className="mt-1 text-sm font-medium text-white">Recent commits</div></div>
            <GitPullRequest className="h-4 w-4 text-slate-500" />
          </div>
          {overview.recentCommits?.length ? (
            <div className="divide-y divide-white/5">
              {overview.recentCommits.slice(0, 6).map((commit) => (
                <a key={commit.sha} href={commit.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 px-5 py-3 transition hover:bg-white/[0.02]">
                  <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-slate-200">{commit.message}</div>
                    <div className="mt-0.5 text-[11px] text-slate-600">{commit.author} · {timeAgo(commit.date)} · <span className="font-mono">{commit.sha.slice(0, 7)}</span></div>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-700" />
                </a>
              ))}
            </div>
          ) : <EmptyState title="No repositories connected" description="Connect a GitHub repository to see genuine commit activity." icon={<FolderGit2 className="h-5 w-5" />} />}
        </Card>

        <Card>
          <div className="panel-header">
            <div><div className="label">Sessions</div><div className="mt-1 text-sm font-medium text-white">Recent conversations</div></div>
            <Bot className="h-4 w-4 text-slate-500" />
          </div>
          {overview.recentConversations?.length ? (
            <div className="divide-y divide-white/5">
              {overview.recentConversations.map((conversation) => (
                <Link key={conversation.id} to="/assistant" className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.02]">
                  <MessageDot />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{conversation.title}</span>
                  <span className="text-[11px] text-slate-600">{formatDate(conversation.updatedAt)}</span>
                </Link>
              ))}
            </div>
          ) : <EmptyState title="No conversations yet" description="Start a session in the AI Assistant to build project context." icon={<Bot className="h-5 w-5" />} />}
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Badge className={severityClass(overview.securityFindings?.critical ? 'critical' : 'info')}>Critical {overview.securityFindings?.critical ?? 0}</Badge>
        <Badge className={severityClass('high')}>High {overview.securityFindings?.high ?? 0}</Badge>
        <Badge className={severityClass('medium')}>Medium {overview.securityFindings?.medium ?? 0}</Badge>
        <Badge className={severityClass('low')}>Low {overview.securityFindings?.low ?? 0}</Badge>
        <Link to="/security"><Badge className="border-accent-400/30 bg-accent-500/10 text-accent-400"><ShieldAlert className="mr-1 h-3 w-3" /> Open security center</Badge></Link>
        <Link to="/audit"><Badge className="border-white/10 bg-white/5 text-slate-300"><FileClock className="mr-1 h-3 w-3" /> Open audit log</Badge></Link>
      </div>
    </>
  );
}

function MessageDot() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />;
}
