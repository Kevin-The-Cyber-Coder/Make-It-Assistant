import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useMutation } from '@tanstack/react-query';
import { Bug, FileCode2, FlaskConical, GitPullRequest, Play, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import type { SecurityScan } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '@/components/ui';
import { severityClass } from '@/lib/utils';

interface StudioFile { path: string; content: string }
interface ReviewFinding { id: string; severity: string; category: string; title: string; description: string; filePath?: string; line?: number; suggestion?: string }
interface ReviewRecord { id: string; summary: string; findings: ReviewFinding[] }
interface TestRun { id: string; status: string; output: string; generatedTests: Array<{ filePath: string; content: string }> }
interface DebugReport { summary: string; likelyCauses: string[]; suggestedFixes: string[] }

const INITIAL_FILES: StudioFile[] = [
  {
    path: 'src/payments.ts',
    content: `import { createHash } from 'node:crypto';\n\nexport function total(items: Array<{ price: number; qty: number }>): number {\n  return items.reduce((sum, item) => sum + item.price * item.qty, 0);\n}\n\nexport function token(userId: string): string {\n  const secret = 'hardcoded-demo-secret';\n  return createHash('sha256').update(userId + secret).digest('hex');\n}\n`,
  },
];

export function CodeStudioPage() {
  const [files, setFiles] = useState<StudioFile[]>(INITIAL_FILES);
  const [active, setActive] = useState(0);
  const [tool, setTool] = useState<'review' | 'security' | 'tests' | 'debug' | 'enhance'>('review');
  const [output, setOutput] = useState('');
  const [errorText, setErrorText] = useState('TypeError: Cannot read properties of undefined');

  const run = useMutation({
    mutationFn: async () => {
      const current = files[active];
      if (tool === 'review') return api.post<{ review: ReviewRecord }>('/dev/code/review', { files: [current], title: `Studio review: ${current.path}` });
      if (tool === 'security') return api.post<{ scan: SecurityScan }>('/security/scan', { files: [current] });
      if (tool === 'tests') return api.post<{ run: TestRun }>('/dev/testing/run', { files: [current], framework: 'vitest' });
      if (tool === 'debug') return api.post<{ report: DebugReport }>('/dev/debug/analyze', { error: errorText, stackTrace: 'at payments.ts:8:12' });
      return api.post<{ enhanced: string }>('/ai/enhance', { message: current.content });
    },
    onSuccess: (result) => setOutput(JSON.stringify(result, null, 2)),
    onError: (caught) => setOutput(`Error: ${caught instanceof Error ? caught.message : String(caught)}`),
  });

  const findings: ReviewFinding[] = [];
  const reviewOutput = output ? JSON.parse(output) as Record<string, unknown> : null;
  const review = reviewOutput?.review as ReviewRecord | undefined;
  if (review?.findings) findings.push(...review.findings);

  function updateFile(content: string | undefined) {
    setFiles((current) => current.map((file, index) => index === active ? { ...file, content: content ?? '' } : file));
  }

  function addFile() {
    const path = `src/untitled-${files.length + 1}.ts`;
    setFiles((current) => [...current, { path, content: 'export const value = 1;\n' }]);
    setActive(files.length);
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Code Studio"
        description="Inspect source, run local review engines, test generation and debugging workflows. Files are analyzed only when you press Run."
        actions={<Badge className="border-accent-400/30 bg-accent-500/10 text-accent-400"><FileCode2 className="mr-1 h-3 w-3" /> Monaco editor</Badge>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
            {files.map((file, index) => (
              <button key={file.path} onClick={() => setActive(index)} className={`rounded-lg px-3 py-1.5 font-mono text-[11px] ${active === index ? 'bg-accent-500/15 text-accent-300' : 'text-slate-500 hover:bg-white/5'}`}>{file.path}</button>
            ))}
            <Button size="sm" variant="ghost" onClick={addFile}>+ file</Button>
          </div>
          <div className="border-b border-white/5 px-3 py-2">
            <Input value={files[active]?.path ?? ''} onChange={(event) => setFiles((current) => current.map((file, index) => index === active ? { ...file, path: event.target.value } : file))} className="font-mono text-xs" />
          </div>
          <div className="h-[520px]">
            <Editor
              height="100%"
              theme="vs-dark"
              path={files[active]?.path}
              language="typescript"
              value={files[active]?.content}
              onChange={updateFile}
              options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, automaticLayout: true }}
            />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="label mb-3">Analysis tool</div>
            <Select className="w-full" value={tool} onChange={(event) => { setTool(event.target.value as typeof tool); setOutput(''); }}>
              <option value="review">Code review</option>
              <option value="security">Security scan</option>
              <option value="tests">Test generation</option>
              <option value="debug">Error debugging</option>
              <option value="enhance">AI prompt enhancement</option>
            </Select>
            {tool === 'debug' && <Input className="mt-3" value={errorText} onChange={(event) => setErrorText(event.target.value)} placeholder="Error message" />}
            <Button className="mt-3 w-full" onClick={() => run.mutate()} disabled={run.isPending}>
              <Play className="h-4 w-4" /> {run.isPending ? 'Running…' : 'Run analysis'}
            </Button>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-600">Execution is local and explainable. No shell commands are run by this studio.</p>
          </Card>

          <Card>
            <div className="panel-header"><div className="label">Results</div><Badge>{tool}</Badge></div>
            {findings.length ? (
              <div className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
                {findings.map((finding) => (
                  <div key={finding.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2"><Badge className={severityClass(finding.severity)}>{finding.severity}</Badge><span className="text-xs text-slate-200">{finding.title}</span></div>
                    <p className="mt-1 text-[11px] text-slate-500">{finding.description}</p>
                    {finding.suggestion && <p className="mt-1 text-[11px] text-accent-400">{finding.suggestion}</p>}
                  </div>
                ))}
              </div>
            ) : output ? (
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed text-slate-400">{output}</pre>
            ) : (
              <EmptyState title="No results" description="Choose a tool and run it against the active file." icon={<Sparkles className="h-5 w-5" />} />
            )}
          </Card>

          <Card className="p-4">
            <div className="label mb-3">Engine map</div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-2"><GitPullRequest className="h-3.5 w-3.5 text-accent-400" /> Review rules</div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-mint" /> SAST + secrets</div>
              <div className="flex items-center gap-2"><FlaskConical className="h-3.5 w-3.5 text-sky-400" /> Test skeletons</div>
              <div className="flex items-center gap-2"><Bug className="h-3.5 w-3.5 text-rose-300" /> Stack analysis</div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
