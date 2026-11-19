import { useState } from 'react';
import { Bug, Lightbulb, ListOrdered } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, PageHeader, Textarea } from '@/components/ui';

interface DebugReport {
  summary: string;
  language: string;
  frames: Array<{ file: string; line?: number; column?: number; fn?: string }>;
  likelyCauses: string[];
  suggestedFixes: string[];
  confidence: number;
}

export function DebugPage() {
  const [error, setError] = useState('TypeError: Cannot read properties of undefined (reading \'map\')');
  const [stack, setStack] = useState('at renderUsers (/app/src/pages/Users.tsx:42:18)\n    at /app/src/App.tsx:88:5');
  const [report, setReport] = useState<DebugReport | null>(null);

  async function analyze() {
    const result = await api.post<{ report: DebugReport }>('/dev/debug/analyze', { error, stackTrace: stack });
    setReport(result.report);
  }

  return (
    <>
      <PageHeader eyebrow="Engineering tools" title="Debugging Center" description="Stack-trace parsing, error-signature matching and actionable remediation guidance." />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <div className="label mb-3">Error input</div>
          <Textarea rows={4} value={error} onChange={(event) => setError(event.target.value)} className="font-mono text-xs" />
          <div className="label mb-3 mt-4">Stack trace</div>
          <Textarea rows={10} value={stack} onChange={(event) => setStack(event.target.value)} className="font-mono text-xs" />
          <Button className="mt-3 w-full" onClick={() => void analyze()}><Bug className="h-4 w-4" /> Analyze error</Button>
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <div className="label mb-3">Diagnosis</div>
            {report ? (
              <>
                <div className="text-sm text-slate-200">{report.summary}</div>
                <div className="mt-3 flex gap-2"><Badge>Language: {report.language}</Badge><Badge>Confidence: {Math.round(report.confidence * 100)}%</Badge></div>
              </>
            ) : <div className="text-sm text-slate-600">Submit an error to see a diagnosis.</div>}
          </Card>
          {report && (
            <>
              <Card className="p-5">
                <div className="label mb-3"><ListOrdered className="mr-1 inline h-3.5 w-3.5" /> Likely causes</div>
                <ul className="space-y-2 text-sm text-slate-400">{report.likelyCauses.map((cause) => <li key={cause} className="rounded-lg border border-white/5 bg-ink-950/50 px-3 py-2">• {cause}</li>)}</ul>
              </Card>
              <Card className="p-5">
                <div className="label mb-3"><Lightbulb className="mr-1 inline h-3.5 w-3.5" /> Suggested fixes</div>
                <ul className="space-y-2 text-sm text-slate-400">{report.suggestedFixes.map((fix) => <li key={fix} className="rounded-lg border border-mint/20 bg-mint/5 px-3 py-2 text-mint/90">• {fix}</li>)}</ul>
              </Card>
              {report.frames.length > 0 && (
                <Card className="p-5">
                  <div className="label mb-3">Stack frames</div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-500">
                    {report.frames.map((frame, index) => <div key={index}>{frame.fn ?? 'anonymous'} — {frame.file}:{frame.line ?? '?'}:{frame.column ?? '?'}</div>)}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
