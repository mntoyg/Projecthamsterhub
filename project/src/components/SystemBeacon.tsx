interface Props {
  status: 'idle' | 'normal' | 'waste';
  label: string;
  detail: string;
}

export default function SystemBeacon({ status, label, detail }: Props) {
  const styles = {
    idle: { box: 'border-charcoal-500/60 bg-charcoal-800/60', dot: 'bg-slate-500', text: 'text-slate-300' },
    normal: {
      box: 'border-kmitl-green/50 bg-kmitl-green/5 shadow-[0_0_22px_rgba(57,255,122,0.2)]',
      dot: 'bg-kmitl-green',
      text: 'text-kmitl-green',
    },
    waste: {
      box: 'border-red-500/60 bg-red-950/40 shadow-[0_0_28px_rgba(248,113,113,0.35)]',
      dot: 'bg-red-500 animate-blink-waste',
      text: 'text-red-300',
    },
  }[status];

  return (
    <section
      aria-live="polite"
      className={`flex items-center gap-4 rounded-2xl border p-4 transition-all duration-300 ${styles.box}`}
    >
      <span className={`h-10 w-10 shrink-0 rounded-full ${styles.dot}`} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">AI Analysis Result</p>
        <p className={`font-mono text-xl font-bold tracking-wider ${styles.text}`}>{label}</p>
        <p className="truncate text-xs text-slate-400">{detail}</p>
      </div>
    </section>
  );
}
