import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitPullRequest } from 'lucide-react';
import { api } from '@/lib/api';
import type { ReviewFinding } from '@/lib/types';
import { Badge, Button, Card, EmptyState, PageHeader, Textarea } from '@/components/ui';
import { severityClass } from '@/lib/utils';

interface ReviewRecord {
  id: string;
  title: string;
  summary: string;
  findings: ReviewFinding[];
  createdAt: string;
}

const SAMPLE = '[\n  { "path": "src/api.ts", "content": "export function get(id: string) {\\n  const q = `SELECT * FROM users WHERE id = ${id}`;\\n  eval(q);\\n  console.log(q);\\n}" }\n]';

export function ReviewPage() {
  const [filesJson, setFilesJson] = useState(SAMPLE);
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [error, setError] = useState('');
  const history = useQuery({ queryKey: ['reviews'], queryFn: () => api.get<{ reviews: ReviewRecord[] }>('/dev/reviews') });

  async function runReview() {
    setError('');
    try {
      const files = JSON.parse(filesJson) as Array<{ path: string; content: string }>;
      const result = await api.post<{ review: ReviewRecord }>('/dev/code/review', { files, title: 'Manual source review' });
      setReview(result.review);
      void history.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Review failed');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Quality intelligence" title="Code Reviews" description="Rule-based review findings with severity, location and suggested corrections. GitHub PR reviews use the same engine." />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card className="p-5">
          <div className="label mb-3">Review source</div>
          <Textarea rows={18} className="font-mono text-xs" value={filesJson} onChange={(event) => setFilesJson(event.target.value)} />
          <Button className="mt-3 w-full" onClick={() => void runReview()}><GitPullRequest className="h-4 w-4" /> Run review</Button>
          {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}
          <div className="mt-5 border-t border-white/5 pt-4">
            <div className="label mb-2">History</div>
            <div className="space-y-1">
              {history.data?.reviews.slice(0, 6).map((item) => (
                <button key={item.id} onClick={() => setReview(item)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-white/5">
                  {item.title} · {item.findings.length} findings
                </button>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="panel-header"><div className="label">Review output</div>{review && <Badge>{review.findings.length} findings</Badge>}</div>
          {review ? (
            <>
              <div className="border-b border-white/5 px-5 py-4 text-sm text-slate-300">{review.summary}</div>
              <div className="max-h-[560px] divide-y divide-white/5 overflow-y-auto">
                {review.findings.length ? review.findings.map((finding) => (
                  <div key={finding.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={severityClass(finding.severity)}>{finding.severity}</Badge>
                      <Badge>{finding.category}</Badge>
                      <span className="text-sm text-slate-200">{finding.title}</span>
                      <span className="ml-auto font-mono text-[10px] text-slate-600">{finding.filePath}:{finding.line ?? '?'}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">{finding.description}</p>
                    {finding.suggestion && <p className="mt-1 text-[11px] text-accent-400">Suggestion: {finding.suggestion}</p>}
                  </div>
                )) : <EmptyState title="No findings" description="The reviewed source passed all local rules." />}
              </div>
            </>
          ) : <EmptyState title="No review selected" description="Paste source files and run the review engine." />}
        </Card>
      </div>
    </>
  );
}
