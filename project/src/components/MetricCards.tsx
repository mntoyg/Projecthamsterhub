import { Zap, Building2, Activity, TrendingUp } from 'lucide-react';

interface Props {
  energySaved: number;
  criticalRooms: number;
  uptime: number;
  totalRooms: number;
}

export default function MetricCards({ energySaved, criticalRooms, uptime, totalRooms }: Props) {
  const metrics = [
    {
      label: 'Potential Savings',
      value: energySaved.toLocaleString(),
      unit: '฿ / month',
      icon: Zap,
      accent: 'text-kmitl-green',
      glow: 'shadow-[0_0_24px_rgba(57,255,122,0.18)]',
      ring: 'border-kmitl-green/30',
      sub: 'AI optimization active',
    },
    {
      label: 'Critical Rooms Active',
      value: criticalRooms.toString(),
      unit: `of ${totalRooms} rooms`,
      icon: Building2,
      accent: criticalRooms > 0 ? 'text-red-400' : 'text-kmitl-orange-light',
      glow:
        criticalRooms > 0
          ? 'shadow-[0_0_24px_rgba(248,113,113,0.22)]'
          : 'shadow-[0_0_24px_rgba(255,106,0,0.18)]',
      ring: criticalRooms > 0 ? 'border-red-500/40' : 'border-kmitl-orange/30',
      sub: criticalRooms > 0 ? 'Action required' : 'All systems nominal',
    },
    {
      label: 'System Uptime',
      value: uptime.toFixed(1),
      unit: '%',
      icon: Activity,
      accent: 'text-kmitl-orange-light',
      glow: 'shadow-[0_0_24px_rgba(255,106,0,0.18)]',
      ring: 'border-kmitl-orange/30',
      sub: 'Last 30 days',
    },
    {
      label: 'Rooms Monitored',
      value: totalRooms.toString(),
      unit: 'live nodes',
      icon: TrendingUp,
      accent: 'text-sky-400',
      glow: 'shadow-[0_0_24px_rgba(56,189,248,0.18)]',
      ring: 'border-sky-500/30',
      sub: 'Real-time telemetry',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className={`relative overflow-hidden rounded-xl border ${m.ring} bg-charcoal-800/70 backdrop-blur p-4 sm:p-5 ${m.glow} transition-transform duration-300 hover:-translate-y-0.5`}
          >
            <div className="absolute right-0 top-0 h-20 w-20 -translate-y-6 translate-x-6 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-xl" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {m.label}
                </p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className={`font-mono text-3xl font-bold ${m.accent}`}>{m.value}</span>
                  <span className="text-xs font-medium text-slate-400">{m.unit}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">{m.sub}</p>
              </div>
              <div className={`rounded-lg bg-charcoal-700/80 p-2.5 ${m.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
