import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import type { ToastMessage } from '../types';

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const CONFIG = {
  success: { icon: CheckCircle2, color: 'text-kmitl-green', border: 'border-kmitl-green/40', bg: 'bg-kmitl-green/10' },
  error: { icon: XCircle, color: 'text-red-400', border: 'border-red-500/40', bg: 'bg-red-500/10' },
  warn: { icon: AlertTriangle, color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  info: { icon: Info, color: 'text-sky-400', border: 'border-sky-500/40', bg: 'bg-sky-500/10' },
} as const;

export default function Toasts({ toasts, onDismiss }: Props) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const config = CONFIG[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`pointer-events-auto animate-fade-in-up flex items-start gap-2.5 rounded-lg border ${config.border} ${config.bg} bg-charcoal-800/95 p-3 shadow-lg backdrop-blur`}
    >
      <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${config.color}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold ${config.color}`}>{toast.title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-0.5 text-slate-500 transition hover:text-slate-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
