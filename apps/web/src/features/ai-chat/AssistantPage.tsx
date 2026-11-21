import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, CornerDownLeft, Cpu, Sparkles, User } from 'lucide-react';
import { api, getAccessToken } from '@/lib/api';
import type { ConversationMetrics, Message } from '@/lib/types';
import { Badge, Button, Card, EmptyState, PageHeader, Select, StatCard, Textarea } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';

interface ProviderInfo {
  id: string;
  configured: boolean;
  models: Array<{ id: string; displayName: string; capabilities: string[] }>;
}

const TASKS = ['general', 'explain', 'generate', 'security', 'debug', 'documentation', 'architecture'] as const;

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [taskType, setTaskType] = useState<(typeof TASKS)[number]>('general');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [usageLabel, setUsageLabel] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api.get<{ providers: ProviderInfo[] }>('/ai/providers') });
  const metrics = useQuery({ queryKey: ['conversation-metrics'], queryFn: () => api.get<{ metrics: ConversationMetrics }>('/conversations/metrics'), refetchInterval: 30_000 });

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!conversationId) return;
    void api.get<{ messages: Message[] }>(`/conversations/${conversationId}/messages`)
      .then((result) => setMessages(result.messages))
      .catch(() => undefined);
  }, [conversationId]);

  async function enhance() {
    if (!input.trim()) return;
    const result = await api.post<{ enhanced: string }>('/ai/enhance', { message: input });
    setInput(result.enhanced);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setStatus('Streaming response…');
    setUsageLabel('');
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date().toISOString() };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
    ]);
    setInput('');

    try {
      const response = await fetch(api.streamUrl('/ai/stream'), {
        method: 'POST',
        headers: api.streamHeaders(),
        body: JSON.stringify({
          message: text,
          conversationId,
          taskType,
          provider: provider || undefined,
          model: model || undefined,
        }),
      });
      if (!response.ok || !response.body) throw new Error(`Stream failed (${response.status})`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        let index = buffer.indexOf('\n\n');
        while (index !== -1) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const event = block.match(/^event:\s*(.+)$/m)?.[1] ?? 'message';
          const data = block.match(/^data:\s*(.+)$/m)?.[1];
          if (data) {
            const payload = JSON.parse(data) as {
              delta?: string;
              conversationId?: string;
              message?: string;
              totalTokens?: number;
              estimated?: boolean;
              firstTokenMs?: number;
            };
            if (event === 'chunk' && payload.delta) {
              setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + payload.delta! } : message));
            }
            if (event === 'usage' && typeof payload.totalTokens === 'number') {
              setUsageLabel(`${payload.totalTokens} tokens${payload.estimated ? ' (estimated)' : ''} · first token ${payload.firstTokenMs ?? 0} ms`);
            }
            if (event === 'done' && payload.conversationId) {
              setConversationId(payload.conversationId);
              setStatus(`Completed with ${provider || 'auto-routed model'}`);
              void metrics.refetch();
            }
            if (event === 'error') setStatus(`Error: ${payload.message}`);
          }
          index = buffer.indexOf('\n\n');
        }
        if (done) break;
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Stream failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Intelligence"
        title="AI Assistant"
        description="Project-aware conversations with model routing, streaming and defensive guardrails."
        actions={<Badge className="border-accent-400/30 bg-accent-500/10 text-accent-400"><Cpu className="mr-1 h-3 w-3" /> {providers.data?.providers.filter((item) => item.configured).length ?? 0} providers configured</Badge>}
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Conversations" value={metrics.data?.metrics.totalConversations ?? 0} />
        <StatCard label="Messages" value={metrics.data?.metrics.totalMessages ?? 0} tone="accent" />
        <StatCard label="Active (24h)" value={metrics.data?.metrics.activeLast24h ?? 0} />
        <StatCard label="Avg msgs/conv" value={metrics.data?.metrics.avgMessagesPerConversation ?? 0} tone="mint" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <Card className="flex h-[calc(100vh-230px)] min-h-[520px] flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><Bot className="h-4 w-4 text-accent-400" /> MAKE IT AI</div>
            <div className="flex items-center gap-2">
              <Badge>{taskType}</Badge>
              <Badge className="border-mint/30 bg-mint/10 text-mint">streaming</Badge>
            </div>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
            {messages.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="Start an engineering conversation"
                description="Ask about architecture, debugging, security review, test generation or documentation. Project files are treated as untrusted data."
              />
            ) : messages.map((message) => (
              <div key={message.id} className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}>
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', message.role === 'user' ? 'border-accent-400/30 bg-accent-500/10 text-accent-400' : 'border-white/10 bg-white/5 text-slate-400')}>
                  {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={cn('max-w-[85%] rounded-2xl border px-4 py-3', message.role === 'user' ? 'border-accent-400/20 bg-accent-500/10' : 'border-white/5 bg-ink-950/60')}>
                  <div className="mb-1.5 flex items-center gap-2 text-[10px] text-slate-600">
                    {message.role === 'assistant' && message.provider && <span className="font-mono text-accent-400">{message.provider}/{message.model}</span>}
                    {formatDate(message.createdAt)}
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-200">{message.content || (busy ? '▍' : '')}</pre>
                </div>
              </div>
            ))}
            <div ref={bottom} />
          </div>
          <div className="border-t border-white/5 p-4">
            <Textarea
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }}
              placeholder="Ask MAKE IT AI about your project…"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={() => void send()} disabled={busy || !input.trim()}><CornerDownLeft className="h-4 w-4" /> {busy ? 'Generating…' : 'Send'}</Button>
              <Button variant="outline" size="sm" onClick={() => void enhance()} disabled={!input.trim()}>Enhance prompt</Button>
              {conversationId && <Badge className="font-mono">{conversationId.slice(-8)}</Badge>}
              <span className="ml-auto text-[11px] text-slate-600">{usageLabel ? `${usageLabel} · ` : ''}{status || 'Ready'}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="label mb-3">Routing</div>
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-500">Task type</span>
              <Select className="w-full" value={taskType} onChange={(event) => setTaskType(event.target.value as typeof taskType)}>
                {TASKS.map((task) => <option key={task} value={task}>{task}</option>)}
              </Select>
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs text-slate-500">Provider override</span>
              <Select className="w-full" value={provider} onChange={(event) => { setProvider(event.target.value); setModel(''); }}>
                <option value="">Auto-route</option>
                {providers.data?.providers.map((item) => <option key={item.id} value={item.id}>{item.id}{item.configured ? '' : ' (not configured)'}</option>)}
              </Select>
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs text-slate-500">Model</span>
              <Select className="w-full" value={model} onChange={(event) => setModel(event.target.value)}>
                <option value="">Router default</option>
                {(providers.data?.providers.find((item) => item.id === provider)?.models ?? []).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
              </Select>
            </label>
          </Card>
          <Card className="p-5">
            <div className="label mb-3">Provider health</div>
            <div className="space-y-2">
              {providers.data?.providers.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs">
                  <span className={cn('h-1.5 w-1.5 rounded-full', item.configured ? 'bg-mint' : 'bg-slate-700')} />
                  <span className="font-mono text-slate-300">{item.id}</span>
                  <span className="ml-auto text-slate-600">{item.models.length} models</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-600">API keys stay on the server. Unconfigured providers are skipped by the fallback chain.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
