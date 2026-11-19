import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, Bot, Braces, Code2, Command, FolderGit2, Gauge, Github, Layers3,
  Menu, MessageSquare, Search, Settings, ShieldCheck, FlaskConical, X, Bug, GitPullRequest,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui';

const NAV = [
  { group: 'Workspace', items: [
    { to: '/', label: 'Overview', icon: Gauge },
    { to: '/assistant', label: 'AI Assistant', icon: MessageSquare },
    { to: '/agents', label: 'Agent Console', icon: Bot },
    { to: '/studio', label: 'Code Studio', icon: Code2 },
  ] },
  { group: 'Engineering', items: [
    { to: '/projects', label: 'Projects', icon: FolderGit2 },
    { to: '/debug', label: 'Debugging Center', icon: Bug },
    { to: '/security', label: 'Security Center', icon: ShieldCheck },
    { to: '/reviews', label: 'Code Reviews', icon: GitPullRequest },
    { to: '/testing', label: 'Testing Lab', icon: FlaskConical },
  ] },
  { group: 'Intelligence', items: [
    { to: '/github', label: 'GitHub', icon: Github },
    { to: '/analytics', label: 'Analytics', icon: Activity },
    { to: '/settings', label: 'Settings', icon: Settings },
  ] },
];

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const items = useMemo(() => NAV.flatMap((group) => group.items), []);
  const current = items.find((item) => item.to === location.pathname);

  return (
    <div className="flex h-full min-h-screen">
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/5 bg-ink-900/95 backdrop-blur transition-all duration-300 lg:static lg:translate-x-0',
        collapsed ? 'w-[76px]' : 'w-[250px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-glow">
            <Layers3 className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-wide text-white">MAKE IT <span className="text-accent-400">AI</span></div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Engineering OS</div>
            </div>
          )}
          <button className="ml-auto text-slate-500 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV.map((group) => (
            <div key={group.group}>
              {!collapsed && <div className="label mb-2 px-3">{group.group}</div>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => cn(
                    'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                    isActive ? 'bg-accent-500/15 text-white ring-1 ring-inset ring-accent-400/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                    collapsed && 'justify-center px-2',
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <button
            onClick={() => setCollapsed((value) => !value)}
            className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-white/5 hover:text-slate-200', collapsed && 'justify-center')}
          >
            <Menu className="h-[18px] w-[18px]" />
            {!collapsed && 'Collapse sidebar'}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 bg-ink-950/70 px-4 backdrop-blur lg:px-6">
          <button className="text-slate-400 lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-200">{current?.label ?? 'Workspace'}</div>
            <div className="hidden text-[11px] text-slate-600 sm:block">Autonomous engineering environment</div>
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400 transition hover:border-accent-400/40 hover:text-slate-200"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search or jump to…</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] sm:flex"><Command className="h-2.5 w-2.5" />K</kbd>
          </button>
          <div className="hidden items-center gap-2 rounded-lg border border-mint/20 bg-mint/5 px-2.5 py-1.5 text-[11px] text-mint sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-mint" /> SYSTEM READY
          </div>
        </header>

        <main className="grid-bg min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1600px] animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setPaletteOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                autoFocus
                placeholder="Jump to a workspace…"
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
                onChange={(event) => {
                  const query = event.target.value.toLowerCase();
                  const match = items.find((item) => item.label.toLowerCase().includes(query));
                  if (query && match) navigate(match.to);
                }}
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {items.map((item) => (
                <button
                  key={item.to}
                  onClick={() => { navigate(item.to); setPaletteOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5"
                >
                  <item.icon className="h-4 w-4 text-accent-400" />
                  {item.label}
                  <span className="ml-auto font-mono text-[10px] text-slate-600">{item.to}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-600">Type to filter · Esc to close</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FeaturePlaceholder({ name }: { name: string }) {
  return (
    <div className="panel p-10 text-center">
      <Braces className="mx-auto h-8 w-8 text-accent-400" />
      <h2 className="mt-4 text-lg font-semibold text-white">{name}</h2>
      <p className="muted mx-auto mt-2 max-w-md">This workspace is connected to the API and is being prepared.</p>
      <Button className="mt-5" variant="outline">View documentation</Button>
    </div>
  );
}
