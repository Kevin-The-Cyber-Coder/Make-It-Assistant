import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ShieldCheck } from 'lucide-react';
import { api, setTokens } from '@/lib/api';
import { Button, Card, Input, PageHeader } from '@/components/ui';

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api.post<{ tokens: { accessToken: string; refreshToken: string } }>(`/auth/${mode}`, {
        email,
        password,
        ...(mode === 'register' ? { name, organizationName: `${name || 'My'} workspace` } : {}),
      });
      setTokens(result.tokens.accessToken, result.tokens.refreshToken);
      navigate('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-bg flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <PageHeader eyebrow="Secure access" title="Enter your workspace" description="Sign in to the MAKE IT AI engineering environment." />
        <Card className="p-6">
          <div className="mb-6 flex gap-2 rounded-lg bg-ink-950/70 p-1">
            {(['login', 'register'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`flex-1 rounded-md py-2 text-sm capitalize transition ${mode === value ? 'bg-accent-500/20 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {value}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <label className="block">
                <span className="label mb-2 block">Name</span>
                <Input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} placeholder="Ada Lovelace" />
              </label>
            )}
            <label className="block">
              <span className="label mb-2 block">Email</span>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" />
            </label>
            <label className="block">
              <span className="label mb-2 block">Password</span>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'register' ? 12 : 1} placeholder="••••••••••••" />
            </label>
            {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Connecting…' : mode === 'login' ? 'Sign in' : 'Create workspace'}</Button>
          </form>
          <div className="mt-6 flex items-center gap-3 border-t border-white/5 pt-4 text-[11px] text-slate-600">
            <ShieldCheck className="h-4 w-4 text-mint" /> Credentials are hashed with scrypt; sessions use rotating refresh tokens.
          </div>
        </Card>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600"><Bot className="h-3.5 w-3.5" /> MAKE IT AI · Defensive engineering platform</div>
      </div>
    </div>
  );
}
