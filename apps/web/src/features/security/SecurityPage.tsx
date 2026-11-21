import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api, getAccessToken } from '@/lib/api';
import type { SecurityFinding, SecurityMetrics, SecurityScan } from '@/lib/types';
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, Textarea } from '@/components/ui';
import { severityClass } from '@/lib/utils';

const SAMPLE = '[\n  { "path": "src/db.ts", "content": "const url = \\"mongodb://admin:password123@db:27017/app\\";\\nconst q = `SELECT * FROM users WHERE id = ${id}`;" }\n]';

export function SecurityPage() {
  const [filesJson, setFilesJson] = useState(SAMPLE);
  const [scan, setScan] = useState<SecurityScan | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [advisoryNote, setAdvisoryNote] = useState('');

  const owasp = useQuery({ queryKey: ['owasp'], queryFn: () => api.get<{ categories: Array<{ id: string; name: string; guidance: string; checks: string[] }> }>('/security/owasp') });
  const metrics = useQuery({ queryKey: ['security-metrics'], queryFn: () => api.get<{ metrics: SecurityMetrics }>('/security/metrics'), refetchInterval: 30_000 });

  async function runScan() {
    setBusy(true);
    setError('');
    try {
      const files = JSON.parse(filesJson) as Array<{ path: string; content: string }>;
      const result = await api.post<{ scan: SecurityScan }>('/security/scan', { files });
      setScan(result.scan);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  }

  async function runLiveScan() {
    setBusy(true);
    setError('');
    setAdvisoryNote('');
    try {
      const files = JSON.parse(filesJson) as Array<{ path: string; content: string }>;
      const result = await api.post<{
        scan: SecurityScan;
        advisory: { queriedPackages: number; success: boolean; error?: string; reason?: string };
      }>('/security/scan/live', { files });
      setScan(result.scan);
      setAdvisoryNote(result.advisory.success
        ? `OSV queried ${result.advisory.queriedPackages} packages.`
        : `Advisory lookup unavailable: ${result.advisory.error ?? result.advisory.reason ?? 'unknown error'}. Offline findings shown.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Live scan failed');
    } finally {
      setBusy(false);
    }
  }

  async function exportScan() {
    if (!scan) return;
    setError('');
    try {
      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
      const token = getAccessToken();
      const response = await fetch(`${base}/security/scans/${scan.id}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `security-scan-${scan.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Export failed');
    }
  }

  const findings: SecurityFinding[] = scan?.findings ?? [];

  return (
    <>
      <PageHeader eyebrow="Defensive intelligence" title="Cybersecurity Center" description="Static analysis, secret detection, insecure configuration checks and OWASP guidance for authorized environments." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(['critical', 'high', 'medium', 'low', 'info'] as const).map((severity) => (
          <StatCard key={severity} label={severity} value={scan?.summary?.[severity] ?? 0} tone={severity === 'critical' ? 'rose' : severity === 'high' ? 'accent' : 'default'} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total scans" value={metrics.data?.metrics.totalScans ?? 0} />
        <StatCard label="Scans (24h)" value={metrics.data?.metrics.scansLast24h ?? 0} tone="accent" />
        <StatCard label="Cumulative critical" value={metrics.data?.metrics.cumulativeFindingsBySeverity.critical ?? 0} tone="rose" />
        <StatCard label="Latest risk" value={metrics.data?.metrics.latestScan?.risk ?? '—'} tone="mint" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card className="p-5">
          <div className="label mb-3">Source to analyze</div>
          <Textarea rows={16} className="font-mono text-xs" value={filesJson} onChange={(event) => setFilesJson(event.target.value)} />
          <Button className="mt-3 w-full" onClick={() => void runScan()} disabled={busy}><ShieldCheck className="h-4 w-4" /> {busy ? 'Scanning…' : 'Run defensive scan'}</Button>
          <Button className="mt-2 w-full" variant="outline" onClick={() => void runLiveScan()} disabled={busy}>Run live OSV dependency scan</Button>
          {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}
          {advisoryNote && <div className="mt-3 rounded-lg border border-accent-400/20 bg-accent-500/10 px-3 py-2 text-xs text-accent-300">{advisoryNote}</div>}
          <p className="mt-4 text-[11px] leading-relaxed text-slate-600">Static checks are offline heuristics. The live scan adds OSV advisories when the server enables them; version ranges are normalized on a best-effort basis and lockfiles are not resolved.</p>
        </Card>
        <div className="space-y-5">
          <Card>
            <div className="panel-header"><div className="label">Findings</div><div className="flex items-center gap-2">{scan && <Button variant="outline" size="sm" onClick={() => void exportScan()}><Download className="h-3.5 w-3.5" /> Export</Button>}<Badge>{findings.length}</Badge></div></div>
            {findings.length ? (
              <div className="max-h-[520px] divide-y divide-white/5 overflow-y-auto">
                {findings.map((finding) => (
                  <div key={finding.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={severityClass(finding.severity)}>{finding.severity}</Badge>
                      <span className="text-sm font-medium text-slate-100">{finding.title}</span>
                      <span className="ml-auto font-mono text-[10px] text-slate-600">{finding.filePath}:{finding.line ?? '?'}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{finding.description}</p>
                    <div className="mt-2 rounded-lg border border-white/5 bg-ink-950/60 px-3 py-2 text-[11px] text-mint"><span className="text-slate-600">Remediation: </span>{finding.remediation}</div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No findings yet" description="Run a scan to see severity-classified results." icon={<ShieldAlert className="h-5 w-5" />} />}
          </Card>
          <Card>
            <div className="panel-header"><div className="label">OWASP Top 10 education</div><Badge>10 categories</Badge></div>
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {owasp.data?.categories.map((category) => (
                <div key={category.id} className="rounded-lg border border-white/5 bg-ink-950/50 p-3">
                  <div className="text-xs font-semibold text-slate-200">{category.id} · {category.name}</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{category.guidance}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
