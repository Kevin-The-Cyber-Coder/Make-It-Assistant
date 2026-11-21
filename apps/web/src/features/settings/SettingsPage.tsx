import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Database, KeyRound, LogOut, Server, ShieldCheck } from 'lucide-react';
import { api, clearTokens, getAccessToken } from '@/lib/api';
import type { SystemStatus, SystemVersion } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ProviderInfo {
  id: string;
  configured: boolean;
  models: Array<{ id: string; displayName: string; capabilities: string[] }>;
}

interface Health {
  status: string;
  service: string;
  storage: string;
  providers: string[];
  timestamp: string;
}

function healthUrl(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
  return configured.replace(/\/api\/v1\/?$/, '') + '/healthz';
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [notice, setNotice] = useState('');
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api.get<{ providers: ProviderInfo[] }>('/ai/providers') });
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch(healthUrl());
      if (!response.ok) throw new Error(`Health check failed (${response.status})`);
      return response.json() as Promise<Health>;
    },
    refetchInterval: 15_000,
  });
  const status = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get<SystemStatus>('/system/status'),
    refetchInterval: 30_000,
  });
  const version = useQuery({
    queryKey: ['system-version'],
    queryFn: () => api.get<SystemVersion>('/system/version'),
    staleTime: 60_000,
  });

  async function saveGithubToken() {
    if (!token.trim()) return;
    setNotice('Token is held only in this browser session; use it from the GitHub page. To configure it server-wide, set GITHUB_TOKEN in the API environment.');
    sessionStorage.setItem('mia.githubTokenHint', 'set');
    setToken('');
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings & health"
        description="Inspect live provider configuration, storage mode and service health. Secrets are never exposed by the API."
        actions={health.data?.status === 'ok' ? <Badge className="border-mint/30 bg-mint/10 text-mint"><CheckCircle2 className="mr-1 h-3 w-3" /> healthy</Badge> : <Badge>checking…</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="label mb-4"><Server className="mr-1 inline h-3.5 w-3.5" /> Service</div>
          {health.isLoading ? <Spinner /> : health.error ? <div className="text-xs text-rose-300">{health.error instanceof Error ? health.error.message : 'Health check failed'}</div> : (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd className="font-mono text-mint">{health.data?.status}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Service</dt><dd className="font-mono text-slate-200">{health.data?.service}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Version</dt><dd className="font-mono text-slate-200">{version.data?.version ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Commit</dt><dd className="font-mono text-xs text-slate-200">{version.data?.commit ? version.data.commit.slice(0, 12) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Storage</dt><dd className="font-mono text-slate-200">{health.data?.storage}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Configured providers</dt><dd className="font-mono text-slate-200">{health.data?.providers.join(', ') || 'local-rules only'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Last check</dt><dd className="font-mono text-xs text-slate-500">{health.data?.timestamp}</dd></div>
            </dl>
          )}
        </Card>

        <Card className="p-5">
          <div className="label mb-4"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> AI providers</div>
          {providers.isLoading ? <Spinner /> : providers.data?.providers.length ? (
            <div className="space-y-2">
              {providers.data.providers.map((provider) => (
                <div key={provider.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-ink-950/50 px-3 py-2.5">
                  <span className={cn('h-2 w-2 rounded-full', provider.configured ? 'bg-mint' : 'bg-slate-700')} />
                  <span className="font-mono text-sm text-slate-200">{provider.id}</span>
                  <Badge className="ml-auto">{provider.models.length} models</Badge>
                  <Badge className={provider.configured ? 'border-mint/30 bg-mint/10 text-mint' : ''}>{provider.configured ? 'configured' : 'offline fallback'}</Badge>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No providers" description="Provider metadata is unavailable." />}
        </Card>

        <Card className="p-5">
          <div className="label mb-4"><KeyRound className="mr-1 inline h-3.5 w-3.5" /> GitHub access</div>
          <Input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="GitHub personal access token" />
          <Button className="mt-3" variant="outline" onClick={() => void saveGithubToken()} disabled={!token.trim()}>Store session hint</Button>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-600">This application deliberately does not persist third-party tokens in local storage. Enter a token directly on the GitHub page for one-off requests, or configure the server environment.</p>
          {notice && <div className="mt-3 rounded-lg border border-accent-400/20 bg-accent-500/10 px-3 py-2 text-xs text-accent-300">{notice}</div>}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="label mb-4"><Activity className="mr-1 inline h-3.5 w-3.5" /> Runtime status</div>
          {status.isLoading ? <Spinner /> : status.error ? <div className="text-xs text-rose-300">{status.error instanceof Error ? status.error.message : 'System status unavailable'}</div> : status.data ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-white/5 bg-ink-950/50 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Runtime</div>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between"><span>Uptime</span><span className="font-mono text-slate-200">{status.data.uptimeSeconds}s</span></div>
                  <div className="flex justify-between"><span>Node</span><span className="font-mono text-slate-200">{status.data.nodeVersion}</span></div>
                  <div className="flex justify-between"><span>Platform</span><span className="font-mono text-slate-200">{status.data.platform}</span></div>
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-ink-950/50 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Storage & queue</div>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between"><span>Storage</span><span className="font-mono text-slate-200">{status.data.storage.mode}</span></div>
                  <div className="flex justify-between"><span>Redis</span><span className="font-mono text-slate-200">{status.data.redis.connected ? 'connected' : status.data.redis.configured ? 'configured' : 'disabled'}</span></div>
                  <div className="flex justify-between"><span>Queue</span><span className="font-mono text-slate-200">{status.data.queue.mode}</span></div>
                  <div className="flex justify-between"><span>Rate limit</span><span className="font-mono text-slate-200">{status.data.rateLimit.mode}</span></div>
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-ink-950/50 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-600"><Database className="mr-1 inline h-3 w-3" /> Records</div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">
                  {Object.entries(status.data.counts).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2"><span className="truncate">{key}</span><span className="font-mono text-slate-200">{value}</span></div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-ink-950/50 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Providers</div>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  {status.data.providers.map((provider) => (
                    <div key={provider.id} className="flex justify-between gap-2">
                      <span className="font-mono">{provider.id}</span>
                      <span className={provider.configured ? 'text-mint' : 'text-slate-600'}>{provider.configured ? `${provider.models} models` : 'offline'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <div className="label mb-4">Session</div>
          <div className="text-sm text-slate-400">{getAccessToken() ? 'You are signed in with a short-lived access token.' : 'You are not signed in.'}</div>
          <Button className="mt-4" variant="danger" onClick={() => { clearTokens(); navigate('/login'); }}><LogOut className="h-4 w-4" /> Sign out</Button>
        </Card>
      </div>
    </>
  );
}
