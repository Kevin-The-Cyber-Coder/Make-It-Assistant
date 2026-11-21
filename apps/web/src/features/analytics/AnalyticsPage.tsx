import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Cpu, ShieldAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UsageMetrics } from '@/lib/types';
import { Badge, Card, EmptyState, PageHeader, Spinner, StatCard } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface UsageRecord {
  id: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  taskType: string;
  createdAt: string;
}

export function AnalyticsPage() {
  const usage = useQuery({ queryKey: ['usage'], queryFn: () => api.get<{ usage: UsageRecord[] }>('/analytics/usage'), refetchInterval: 30_000 });
  const metrics = useQuery({ queryKey: ['usage-metrics'], queryFn: () => api.get<{ metrics: UsageMetrics }>('/analytics/metrics'), refetchInterval: 30_000 });

  if (usage.isLoading) return <div className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6" /></div>;
  if (usage.error) return <EmptyState title="Analytics unavailable" description={usage.error instanceof Error ? usage.error.message : 'Could not load usage records.'} />;

  const records = usage.data?.usage ?? [];
  const chartData = [...records].reverse().slice(-30).map((record, index) => ({
    index: index + 1,
    provider: record.provider,
    tokens: record.promptTokens + record.completionTokens,
    latency: record.latencyMs,
  }));
  const totals = records.reduce((acc, record) => {
    acc[record.provider] = (acc[record.provider] ?? 0) + record.promptTokens + record.completionTokens;
    return acc;
  }, {} as Record<string, number>);
  const totalTokens = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const avgLatency = records.length ? Math.round(records.reduce((sum, record) => sum + record.latencyMs, 0) / records.length) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Telemetry"
        title="Usage Analytics"
        description="Real model-usage records captured by the AI Gateway. Counters reflect only this workspace and this storage backend."
        actions={<Badge className="border-mint/30 bg-mint/10 text-mint"><Activity className="mr-1 h-3 w-3" /> live</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="AI requests" value={metrics.data?.metrics.totalRequests ?? records.length} />
        <StatCard label="Tokens used" value={(metrics.data?.metrics.totalTokens ?? totalTokens).toLocaleString()} tone="accent" />
        <StatCard label="Avg latency" value={`${metrics.data?.metrics.avgLatencyMs ?? avgLatency} ms`} tone="mint" />
        <StatCard label="Success rate" value={`${Math.round((metrics.data?.metrics.successRate ?? 1) * 100)}%`} />
        <StatCard label="Providers" value={Object.keys(metrics.data?.metrics.byProvider ?? totals).length} />
      </div>

      <Card className="mt-5 p-5">
        <div className="panel-header -mx-5 -mt-5 mb-4">
          <div><div className="label">Recent requests</div><div className="mt-1 text-sm font-medium text-white">Tokens per request</div></div>
          <Cpu className="h-4 w-4 text-accent-400" />
        </div>
        {chartData.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="tokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5b7cfa" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#5b7cfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2740" vertical={false} />
                <XAxis dataKey="index" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#11172a', border: '1px solid #222c49', borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="tokens" stroke="#5b7cfa" fill="url(#tokens)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState title="No usage yet" description="Send an AI request to populate this chart." />}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card>
          <div className="panel-header"><div className="label">By provider</div><ShieldAlert className="h-4 w-4 text-slate-600" /></div>
          <div className="space-y-3 p-5">
            {Object.entries(totals).map(([provider, tokens]) => (
              <div key={provider}>
                <div className="flex items-center justify-between text-xs"><span className="font-mono text-slate-300">{provider}</span><span className="text-slate-500">{tokens.toLocaleString()} tokens</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-accent-500" style={{ width: `${totalTokens ? (tokens / totalTokens) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {!Object.keys(totals).length && <div className="text-xs text-slate-600">No provider usage recorded.</div>}
          </div>
        </Card>
        <Card>
          <div className="panel-header"><div className="label">Request log</div><Badge>{records.length}</Badge></div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-ink-900 text-slate-600"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Provider</th><th className="px-3 py-3 font-medium">Model</th><th className="px-3 py-3 font-medium">Task</th><th className="px-3 py-3 text-right font-medium">Tokens</th><th className="px-5 py-3 text-right font-medium">Latency</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {records.map((record) => (
                  <tr key={record.id} className="text-slate-400">
                    <td className="px-5 py-2.5 whitespace-nowrap">{formatDate(record.createdAt)}</td>
                    <td className="px-3 py-2.5 font-mono text-accent-400">{record.provider}</td>
                    <td className="px-3 py-2.5 font-mono">{record.model}</td>
                    <td className="px-3 py-2.5">{record.taskType}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{(record.promptTokens + record.completionTokens).toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{record.latencyMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
