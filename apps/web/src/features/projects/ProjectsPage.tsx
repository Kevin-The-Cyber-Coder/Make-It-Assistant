import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FolderPlus, Layers3, Search, Trash2 } from 'lucide-react';
import { api, getAccessToken } from '@/lib/api';
import type { Project, ProjectMetrics } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner, StatCard, Textarea } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [filesJson, setFilesJson] = useState('[\n  { "path": "src/index.ts", "content": "export const greet = () => \\"hello\\";" }\n]');
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => api.get<{ projects: Project[] }>('/projects') });
  const metrics = useQuery({ queryKey: ['project-metrics'], queryFn: () => api.get<{ metrics: ProjectMetrics }>('/projects/metrics'), refetchInterval: 30_000 });
  const files = useQuery({
    queryKey: ['project-files', selected],
    queryFn: () => api.get<{ files: Array<{ path: string; language: string; size: number }> }>(`/projects/${selected}/files`),
    enabled: Boolean(selected),
  });

  const create = useMutation({
    mutationFn: () => api.post<{ project: Project }>('/projects', { name, description }),
    onSuccess: (result) => {
      setSelected(result.project.id);
      setName('');
      setDescription('');
      setMessage(`Created ${result.project.name}`);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['project-metrics'] });
    },
  });

  const indexFiles = useMutation({
    mutationFn: () => {
      const parsed = JSON.parse(filesJson) as Array<{ path: string; content: string }>;
      if (!selected) throw new Error('Select a project first');
      return api.post(`/projects/${selected}/index`, { files: parsed });
    },
    onSuccess: (result) => {
      setMessage(`Indexed project: ${JSON.stringify(result)}`);
      void queryClient.invalidateQueries({ queryKey: ['project-files', selected] });
      void queryClient.invalidateQueries({ queryKey: ['project-metrics'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  async function exportProject() {
    if (!selected) return;
    try {
      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
      const token = getAccessToken();
      const response = await fetch(`${base}/projects/${selected}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `project-${selected}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Export failed');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Project intelligence" title="Projects & Repositories" description="Create workspaces, index source files and make them available to the AI gateway and agents." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total projects" value={metrics.data?.metrics.totalProjects ?? 0} />
        <StatCard label="Indexed projects" value={metrics.data?.metrics.indexedProjects ?? 0} tone="accent" />
        <StatCard label="Indexed files" value={metrics.data?.metrics.indexedFiles ?? 0} />
        <StatCard label="Updated (24h)" value={metrics.data?.metrics.updatedLast24h ?? 0} tone="mint" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5">
          <div className="label mb-3">New project</div>
          <div className="space-y-3">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" />
            <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description" />
            <Button className="w-full" onClick={() => create.mutate()} disabled={!name || create.isPending}>
              <FolderPlus className="h-4 w-4" /> {create.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </div>
          {message && <div className="mt-4 break-words rounded-lg border border-white/10 bg-white/[0.03] p-3 font-mono text-[11px] text-slate-400">{message}</div>}
        </Card>

        <Card className="xl:col-span-2">
          <div className="panel-header"><div className="label">Workspaces</div><Search className="h-4 w-4 text-slate-600" /></div>
          {isLoading ? <div className="p-8 text-center"><Spinner /></div> : data?.projects.length ? (
            <div className="divide-y divide-white/5">
              {data.projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelected(project.id)}
                  className={`flex w-full items-center gap-4 px-5 py-4 text-left transition ${selected === project.id ? 'bg-accent-500/10' : 'hover:bg-white/[0.02]'}`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5"><Layers3 className="h-4 w-4 text-accent-400" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-100">{project.name}</div>
                    <div className="truncate text-xs text-slate-500">{project.description || 'No description'}</div>
                  </div>
                  <div className="hidden gap-1 sm:flex">{project.languages.slice(0, 3).map((language) => <Badge key={language}>{language}</Badge>)}</div>
                  <div className="text-[11px] text-slate-600">{formatDate(project.updatedAt)}</div>
                </button>
              ))}
            </div>
          ) : <EmptyState title="No projects" description="Create your first project to begin indexing source files." />}
        </Card>
      </div>

      {selected && (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Card className="p-5">
            <div className="label mb-3">Index source files</div>
            <p className="muted mb-3 text-xs">Paste a JSON array of <code className="font-mono text-accent-400">{'{ path, content }'}</code> objects. Files are stored as project context, not executed.</p>
            <Textarea rows={12} className="font-mono text-xs" value={filesJson} onChange={(event) => setFilesJson(event.target.value)} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => indexFiles.mutate()} disabled={indexFiles.isPending}>
                <Layers3 className="h-4 w-4" /> {indexFiles.isPending ? 'Indexing…' : 'Index files'}
              </Button>
              <Button variant="outline" onClick={() => void exportProject()}><Download className="h-4 w-4" /> Export project</Button>
            </div>
          </Card>
          <Card>
            <div className="panel-header"><div className="label">Indexed files</div><Badge>{files.data?.files.length ?? 0}</Badge></div>
            {files.data?.files.length ? (
              <div className="max-h-96 divide-y divide-white/5 overflow-y-auto">
                {files.data.files.map((file) => (
                  <div key={file.path} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                    <span className="font-mono text-slate-300">{file.path}</span>
                    <Badge className="ml-auto">{file.language}</Badge>
                    <span className="text-slate-600">{file.size}b</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No indexed files" description="Use the index action to make files searchable by agents." />}
          </Card>
        </div>
      )}
    </>
  );
}
