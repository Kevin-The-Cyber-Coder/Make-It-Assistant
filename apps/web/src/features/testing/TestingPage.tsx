import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { api } from '@/lib/api';
import type { TestingMetrics } from '@/lib/types';
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, Textarea } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface TestRun {
  id: string;
  status: string;
  framework: string;
  output: string;
  createdAt: string;
  generatedTests: Array<{ filePath: string; content: string }>;
}

const SAMPLE = '[\n  { "path": "src/math.ts", "content": "export function add(a: number, b: number) { return a + b }\\nexport const multiply = (a: number, b: number) => a * b;" }\n]';

export function TestingPage() {
  const [filesJson, setFilesJson] = useState(SAMPLE);
  const [run, setRun] = useState<TestRun | null>(null);
  const [error, setError] = useState('');
  const runs = useQuery({ queryKey: ['test-runs'], queryFn: () => api.get<{ runs: TestRun[] }>('/dev/testing/runs') });
  const metrics = useQuery({ queryKey: ['testing-metrics'], queryFn: () => api.get<{ metrics: TestingMetrics }>('/dev/testing/metrics'), refetchInterval: 30_000 });

  async function generate() {
    setError('');
    try {
      const files = JSON.parse(filesJson) as Array<{ path: string; content: string }>;
      const result = await api.post<{ run: TestRun }>('/dev/testing/run', { files, framework: 'vitest' });
      setRun(result.run);
      void runs.refetch();
      void metrics.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Generation failed');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Quality intelligence" title="Testing Lab" description="Generate framework-appropriate test skeletons. Execution is gated behind an approved isolated sandbox worker." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total runs" value={metrics.data?.metrics.totalRuns ?? 0} />
        <StatCard label="Generated tests" value={metrics.data?.metrics.generatedTests ?? 0} tone="accent" />
        <StatCard label="Skipped" value={metrics.data?.metrics.byStatus.skipped ?? 0} />
        <StatCard label="Latest framework" value={metrics.data?.metrics.latestRun?.framework ?? '—'} tone="mint" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card className="p-5">
          <div className="label mb-3">Source files</div>
          <Textarea rows={16} className="font-mono text-xs" value={filesJson} onChange={(event) => setFilesJson(event.target.value)} />
          <Button className="mt-3 w-full" onClick={() => void generate()}><FlaskConical className="h-4 w-4" /> Generate tests</Button>
          {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}
          <div className="mt-5 border-t border-white/5 pt-4">
            <div className="label mb-2">Run history</div>
            {runs.data?.runs.slice(0, 6).map((item) => (
              <button key={item.id} onClick={() => setRun(item)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-white/5">
                {formatDate(item.createdAt)} · {item.generatedTests.length} files · {item.status}
              </button>
            ))}
          </div>
        </Card>
        <div className="space-y-5">
          {run && <Card className="p-5"><div className="label mb-2">Execution note</div><div className="text-sm text-slate-300">{run.output}</div><Badge className="mt-3">{run.status}</Badge></Card>}
          <Card>
            <div className="panel-header"><div className="label">Generated skeletons</div><Badge>{run?.generatedTests.length ?? 0}</Badge></div>
            {run?.generatedTests.length ? (
              <div className="max-h-[520px] space-y-4 overflow-y-auto p-4">
                {run.generatedTests.map((test) => (
                  <div key={test.filePath} className="rounded-xl border border-white/5 bg-ink-950/60 p-4">
                    <div className="mb-2 font-mono text-xs text-accent-400">{test.filePath}</div>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-400">{test.content}</pre>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No tests generated" description="Provide source files with exported symbols to generate skeletons." />}
          </Card>
        </div>
      </div>
    </>
  );
}
