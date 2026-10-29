import { isSupabaseConfigured } from '../lib/supabase';
import { API_URL } from '../lib/config';
import { Radio, Cpu, Wifi, CloudOff, Cloud, Loader2 } from 'lucide-react';

interface Props {
  connectionState?: 'connecting' | 'online' | 'offline';
}

export default function Header({ connectionState = 'online' }: Props) {
  const connMap = {
    connecting: { label: 'CONNECTING', color: 'text-amber-400', icon: Loader2, dot: 'bg-amber-400' },
    online: { label: 'ONLINE', color: 'text-kmitl-green', icon: Cloud, dot: 'bg-kmitl-green' },
    offline: { label: 'OFFLINE', color: 'text-red-400', icon: CloudOff, dot: 'bg-red-400' },
  } as const;
  const conn = connMap[connectionState];
  const ConnIcon = conn.icon;
  const isLocal = !isSupabaseConfigured && !API_URL;
  return (
    <header className="relative overflow-hidden border-b border-kmitl-orange/20 bg-charcoal-900/80 backdrop-blur">
      <div className="absolute inset-0 card-grid-bg opacity-40" />
      <div className="absolute -left-20 top-0 h-40 w-40 rounded-full bg-kmitl-orange/20 blur-3xl" />
      <div className="absolute right-10 top-0 h-32 w-32 rounded-full bg-kmitl-green/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-kmitl-orange to-kmitl-orange-dark shadow-[0_0_20px_rgba(255,106,0,0.5)]">
            <Radio className="h-6 w-6 text-white" />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kmitl-green opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-kmitl-green" />
            </span>
          </div>
          <div>
            <h1 className="font-mono text-lg font-bold tracking-[0.18em] text-kmitl-orange-light text-glow-orange sm:text-2xl">
              KMITL SMART GRID &amp; AI ENERGY GUARDIAN
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
              Real-time Engineering Control Room Dashboard
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="h-3.5 w-3.5 text-kmitl-orange" />
            <span>AI Core: <span className="font-mono text-kmitl-green">ONLINE</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Wifi className="h-3.5 w-3.5 text-kmitl-green" />
            <span>IoT Mesh: <span className="font-mono text-kmitl-green">STABLE</span></span>
          </div>
          <div className={`flex items-center gap-1.5 ${conn.color}`}>
            <ConnIcon className={`h-3.5 w-3.5 ${connectionState === 'connecting' ? 'animate-spin' : ''}`} />
            <span className="font-mono">{isLocal ? 'MODE: LOCAL' : `${API_URL ? 'API' : 'DB'}: ${conn.label}`}</span>
          </div>
        </div>
      </div>

      <div className="relative bg-gradient-to-r from-transparent via-kmitl-orange/60 to-transparent">
        <div className="h-px w-full" />
      </div>

      <p className="relative bg-charcoal-900/60 px-4 py-2 text-center text-[11px] text-slate-400 sm:px-6">
        Developed for <span className="font-medium text-kmitl-orange-light">Phra Pathom Witthayalai School</span> · King Mongkut's Institute of Technology Ladkrabang
      </p>
    </header>
  );
}
