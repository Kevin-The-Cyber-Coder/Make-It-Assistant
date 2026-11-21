import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ScrollText, Search, ShieldCheck } from 'lucide-react';
import { api, getAccessToken } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner, StatCard } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { AuditLog } from '@/lib/types';

interface AuditFilters {
  q: string;
  action: string;
  resource: string;
  actorId: string;
}

interface AuditListResponse {
  entries: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

interface AuditSummary {
  total: number;
  byAction: Array<{ name: string; count: number }>;
  byResource: Array<{ name: string; count: number }>;
  byActor: Array<{ name: string; count: number }>;
}

const EMPTY_FILTERS: AuditFilters = { q: '', action: '', resource: '', actorId: '' };

function buildPath(filters: AuditFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) params.set(key, value.trim());
  }
  params.set('limit', '200');
  return `/audit?${params.toString()}`;
}

export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');
  const list = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => api.get<AuditListResponse>(buildPath(filters)),
    refetchInterval: 30_000,
  });
  const summary = useQuery({
    queryKey: ['audit-summary'],
    queryFn: () => api.get<AuditSummary>('/audit/summary'),
    refetchInterval: 30_000,
  });

  const entries = list.data?.entries ?? [];
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  function updateFilter(key: keyof AuditFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedId(null);
  }

  async function exportAudit(format: 'json' | 'csv') {
    setExportError('');
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value.trim()) params.set(key, value.trim());
      }
      params.set('format', format);
      params.set('limit', '1000');
      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
      const token = getAccessToken();
      const response = await fetch(`${base}/audit/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `make-it-ai-audit-${new Date().toISOString().slice(0, 10)}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    }
  }

  if (list.isLoading || summary.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6" /></div>;
  }
  if (list.error || summary.error) {
    const error = list.error ?? summary.error;
    return <EmptyState title="Audit log unavailable" description={error instanceof Error ? error.message : 'Could not load audit records.'} />;
  }

  const stats = summary.data;
  const activeFilters = Object.values(filters).filter((value) => value.trim()).length;

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Audit Log"
        description="Organization-scoped activity records written by the API. Listing requests are themselves recorded as audit.read events."
        actions={
          <>
            <Badge className="border-mint/30 bg-mint/10 text-mint"><ShieldCheck className="mr-1 h-3 w-3" /> org scoped</Badge>
            <Button variant="outline" size="sm" onClick={() => void exportAudit('json')}>
              <Download className="h-3.5 w-3.5" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportAudit('csv')}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </>
        }
      />
      {exportError && <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{exportError}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total events" value={stats?.total ?? 0} tone="accent" />
        <StatCard label="Distinct actions" value={stats?.byAction.length ?? 0} />
        <StatCard label="Resources touched" value={stats?.byResource.length ?? 0} />
        <StatCard label="Actors observed" value={stats?.byActor.length ?? 0} />
      </div>

      <Card className="mt-5 p-5">
        <div className="panel-header -mx-5 -mt-5 mb-4">
          <div><div className="label">Filters</div><div className="mt-1 text-sm font-medium text-white">Narrow the event stream</div></div>
          <Badge>{activeFilters} active</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
            <Input className="pl-9" placeholder="Search action, resource, actor, IP or metadata" value={filters.q} onChange={(event) => updateFilter('q', event.target.value)} />
          </div>
          <Input placeholder="Action" value={filters.action} onChange={(event) => updateFilter('action', event.target.value)} />
          <Input placeholder="Resource" value={filters.resource} onChange={(event) => updateFilter('resource', event.target.value)} />
          <Input placeholder="Actor ID" value={filters.actorId} onChange={(event) => updateFilter('actorId', event.target.value)} />
          <Button variant="ghost" size="sm" onClick={() => { setFilters(EMPTY_FILTERS); setSelectedId(null); }}>Clear</Button>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="panel-header">
            <div><div className="label">Event stream</div><div className="mt-1 text-sm font-medium text-white">Newest first · {list.data?.total ?? 0} matching</div></div>
            <ScrollText className="h-4 w-4 text-accent-400" />
          </div>
          {entries.length ? (
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-ink-900 text-slate-600">
                  <tr><th className="px-5 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Action</th><th className="px-3 py-3 font-medium">Resource</th><th className="px-3 py-3 font-medium">Actor</th><th className="px-3 py-3 font-medium">IP</th><th className="px-5 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className={`cursor-pointer text-slate-400 transition hover:bg-white/[0.03] ${selectedId === entry.id ? 'bg-accent-500/10' : ''}`}
                    >
                      <td className="px-5 py-2.5 whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                      <td className="px-3 py-2.5 font-mono text-accent-400">{entry.action}</td>
                      <td className="px-3 py-2.5 font-mono">{entry.resource}{entry.resourceId ? `:${entry.resourceId}` : ''}</td>
                      <td className="px-3 py-2.5 font-mono">{entry.actorId ?? 'anonymous'}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">{entry.ip ?? '—'}</td>
                      <td className="px-5 py-2.5 text-right text-accent-400">›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No matching events" description="Adjust the filters or perform an audited action in the console." icon={<ScrollText className="h-5 w-5" />} />}
        </Card>

        <Card className="p-5">
          <div className="label">Event detail</div>
          {selected ? (
            <dl className="mt-4 space-y-4 text-xs">
              <div><dt className="text-slate-600">Event ID</dt><dd className="mt-1 break-all font-mono text-slate-300">{selected.id}</dd></div>
              <div><dt className="text-slate-600">Timestamp</dt><dd className="mt-1 text-slate-300">{formatDate(selected.createdAt)}</dd></div>
              <div><dt className="text-slate-600">Action</dt><dd className="mt-1 font-mono text-accent-400">{selected.action}</dd></div>
              <div><dt className="text-slate-600">Resource</dt><dd className="mt-1 break-all font-mono text-slate-300">{selected.resource}{selected.resourceId ? ` / ${selected.resourceId}` : ''}</dd></div>
              <div><dt className="text-slate-600">Actor</dt><dd className="mt-1 font-mono text-slate-300">{selected.actorId ?? 'anonymous'}</dd></div>
              <div><dt className="text-slate-600">Source IP</dt><dd className="mt-1 font-mono text-slate-300">{selected.ip ?? '—'}</dd></div>
              <div>
                <dt className="text-slate-600">Metadata</dt>
                <dd className="mt-1 max-h-64 overflow-auto rounded-lg border border-white/5 bg-ink-950/70 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
                  {selected.metadata ? JSON.stringify(selected.metadata, null, 2) : 'No metadata recorded.'}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-8 text-center text-xs text-slate-600">Select an event to inspect its metadata.</div>
          )}
        </Card>
      </div>
    </>
  );
}
