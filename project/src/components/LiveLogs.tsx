import { useEffect, useRef } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import type { LogEntry } from '../types';
import { LEVEL_STYLES } from '../utils/logs';

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

export default function LiveLogs({ logs, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <section className="rounded-2xl border border-charcoal-500/50 bg-charcoal-900/70 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kmitl-green/10">
            <Terminal className="h-4.5 w-4.5 text-kmitl-green" />
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold tracking-wide text-slate-100">
              SYSTEM LIVE LOGS
            </h2>
            <p className="text-[11px] text-slate-500">Real-time sync &amp; event console</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-kmitl-green" />
            {logs.length} entries
          </span>
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded-md border border-charcoal-500 px-2 py-1 text-[11px] text-slate-400 transition hover:border-red-500/50 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-thin h-56 overflow-y-auto rounded-lg border border-charcoal-600/60 bg-black/40 p-3 font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <p className="text-slate-600">// Awaiting telemetry events…</p>
        ) : (
          logs.map((log) => {
            const style = LEVEL_STYLES[log.level];
            return (
              <div
                key={log.id}
                className="animate-fade-in-up flex items-start gap-2 py-0.5"
              >
                <span className="shrink-0 text-slate-600">{log.timestamp}</span>
                <span
                  className={`shrink-0 rounded px-1.5 text-[10px] font-bold uppercase ${style.bg} ${style.text}`}
                >
                  [{style.label}]
                </span>
                <span className="shrink-0 text-slate-500">{log.tag}</span>
                <span className={`break-all ${log.level === 'error' ? 'text-red-300' : 'text-slate-300'}`}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
