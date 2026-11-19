import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Bot, Check, CirclePause, Play, Radio, X } from 'lucide-react';
import { api, getAccessToken } from '@/lib/api';
import type { AgentEvent, AgentTask } from '@/lib/types';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, Textarea } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';

const statusTone: Record<string, string> = {
  completed: 'border-mint/30 bg-mint/10 text-mint',
  failed: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  running: 'border-accent-400/30 bg-accent-500/10 text-accent-400',
  awaiting_approval: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  cancelled: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};

export function AgentConsolePage() {
  const queryClient = useQueryClient();
  const [objective, setObjective] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<AgentEvent[]>([]);
  const [notice, setNotice] = useState('');

  const tasks = useQuery({ queryKey: ['agent-tasks'], queryFn: () => api.get<{ tasks: AgentTask[] }>('/agents/tasks'), refetchInterval: 3000 });
  const events = useQuery({
    queryKey: ['agent-events', selected],
    queryFn: () => api.get<{ events: AgentEvent[] }>(`/agents/tasks/${selected}/events`),
    enabled: Boolean(selected),
    refetchInterval: 2000,
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data as string) as AgentEvent;
        if (event.taskId) setLiveEvents((current) => [...current.slice(-80), event]);
      } catch { /* ignore malformed frames */ }
    };
    return () => socket.close();
  }, []);

  async function start() {
    if (objective.trim().length < 10) return;
    const result = await api.post<{ task: AgentTask }>('/agents/tasks', { objective });
    setSelected(result.task.id);
    setObjective('');
    setNotice(`Task ${result.task.id} started`);
    void queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
  }

  async function decide(stepId: string, approved: boolean) {
    if (!selected) return;
    await api.post(`/agents/tasks/${selected}/approve`, { stepId, approved });
    setNotice(approved ? 'Step approved' : 'Step rejected');
    void queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
  }

  async function cancel() {
    if (!selected) return;
    await api.post(`/agents/tasks/${selected}/cancel`, {});
    void queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
  }

  const active = tasks.data?.tasks.find((task) => task.id === selected);
  const combinedEvents = [...(events.data?.events ?? []), ...liveEvents.filter((event) => event.taskId === selected)]
    .filter((event, index, array) => array.findIndex((item) => item.id === event.id) === index)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <>
      <PageHeader
        eyebrow="Autonomous engineering"
        title="Agent Console"
        description="Plan, execute and supervise specialised agents with approval checkpoints and live execution events."
        actions={<Badge className="border-mint/30 bg-mint/10 text-mint"><Radio className="mr-1 h-3 w-3" /> live events</Badge>}
      />
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="label mb-3">New objective</div>
            <Textarea rows={5} value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Build a typed REST API with tests, security review and documentation…" />
            <Button className="mt-3 w-full" onClick={() => void start()} disabled={objective.trim().length < 10}><Play className="h-4 w-4" /> Start agent task</Button>
            {notice && <div className="mt-3 text-[11px] text-slate-500">{notice}</div>}
          </Card>
          <Card>
            <div className="panel-header"><div className="label">Task history</div><Bot className="h-4 w-4 text-slate-600" /></div>
            {tasks.isLoading ? <div className="p-8 text-center"><Spinner /></div> : tasks.data?.tasks.length ? (
              <div className="max-h-[460px] divide-y divide-white/5 overflow-y-auto">
                {tasks.data.tasks.map((task) => (
                  <button key={task.id} onClick={() => setSelected(task.id)} className={cn('w-full px-4 py-3 text-left transition', selected === task.id ? 'bg-accent-500/10' : 'hover:bg-white/[0.02]')}>
                    <div className="line-clamp-2 text-xs text-slate-300">{task.objective}</div>
                    <div className="mt-2 flex items-center gap-2"><Badge className={statusTone[task.status]}>{task.status.replace('_', ' ')}</Badge><span className="text-[10px] text-slate-600">{formatDate(task.createdAt)}</span></div>
                  </button>
                ))}
              </div>
            ) : <EmptyState title="No tasks" description="Describe an objective to create an agent plan." />}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="label">Execution plan</div>
                <div className="mt-1 text-sm font-medium text-white">{active ? active.objective.slice(0, 120) : 'Select a task'}</div>
              </div>
              {active && (
                <div className="flex gap-2">
                  <Badge className={statusTone[active.status]}>{active.status.replace('_', ' ')}</Badge>
                  <Button size="sm" variant="danger" onClick={() => void cancel()}><Ban className="h-3.5 w-3.5" /> Cancel</Button>
                </div>
              )}
            </div>
            {active ? (
              <div className="mt-5 space-y-2">
                {active.plan.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-ink-950/50 p-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 font-mono text-[10px] text-slate-500">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-slate-200">{step.title}</span><Badge>{step.agent}</Badge><Badge>{step.status}</Badge></div>
                      <div className="mt-1 text-xs text-slate-500">{step.description}</div>
                      {step.status === 'awaiting_approval' && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => void decide(step.id, true)}><Check className="h-3.5 w-3.5" /> Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => void decide(step.id, false)}><X className="h-3.5 w-3.5" /> Reject</Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="Awaiting selection" description="Choose a task from history to inspect its plan and events." icon={<CirclePause className="h-5 w-5" />} />}
          </Card>

          <Card>
            <div className="panel-header"><div className="label">Tool & task events</div><Badge>{combinedEvents.length}</Badge></div>
            <div className="max-h-[420px] space-y-1 overflow-y-auto px-4 py-3 font-mono text-[11px]">
              {combinedEvents.length ? combinedEvents.map((event) => (
                <div key={event.id} className="flex gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.02]">
                  <span className="shrink-0 text-slate-700">{new Date(event.createdAt).toLocaleTimeString()}</span>
                  <span className="shrink-0 text-accent-400">{event.type.replace('agent:', '')}</span>
                  <span className="text-slate-400">{event.message}</span>
                </div>
              )) : <div className="py-8 text-center text-slate-600">No events yet</div>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
