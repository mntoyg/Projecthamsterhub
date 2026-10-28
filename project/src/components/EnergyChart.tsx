import { useMemo } from 'react';
import { LineChart } from 'lucide-react';
import type { EnergyReading } from '../types';

interface Props {
  readings: EnergyReading[];
}

export default function EnergyChart({ readings }: Props) {
  const points = useMemo(() => readings.slice(-30), [readings]);

  const { pathD, areaD, maxPower, labels } = useMemo(() => {
    if (points.length === 0) {
      return { pathD: '', areaD: '', maxPower: 0, labels: [] as string[] };
    }
    const max = Math.max(...points.map((p) => p.power), 0.1);
    const width = 100;
    const height = 100;
    const step = points.length > 1 ? width / (points.length - 1) : width;

    const coords = points.map((p, i) => ({
      x: i * step,
      y: height - (p.power / max) * height,
      power: p.power,
      status: p.status,
      ts: p.timestamp,
    }));

    const path = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)},${c.y.toFixed(2)}`)
      .join(' ');
    const area = `${path} L ${width},${height} L 0,${height} Z`;

    const labelIdx = points.length > 4
      ? [0, Math.floor(points.length / 2), points.length - 1]
      : points.length > 0
        ? [0, points.length - 1]
        : [];
    const labelSet = labelIdx.map((i) =>
      new Date(points[i].timestamp).toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5),
    );

    return { pathD: path, areaD: area, maxPower: max, labels: labelSet };
  }, [points]);

  const totalPower = useMemo(
    () => points.reduce((sum, p) => sum + p.power, 0),
    [points],
  );
  const avgPower = points.length > 0 ? totalPower / points.length : 0;

  return (
    <section className="rounded-2xl border border-charcoal-500/50 bg-charcoal-850/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kmitl-green/10">
            <LineChart className="h-4.5 w-4.5 text-kmitl-green" />
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold tracking-wide text-slate-100">
              ENERGY HISTORY
            </h2>
            <p className="text-[11px] text-slate-500">Power consumption over recent telemetry events</p>
          </div>
        </div>
        <div className="flex gap-3 text-[11px]">
          <div className="flex flex-col">
            <span className="text-slate-500">Avg</span>
            <span className="font-mono font-bold text-kmitl-green">{avgPower.toFixed(2)} kW</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500">Peak</span>
            <span className="font-mono font-bold text-kmitl-orange-light">{maxPower.toFixed(2)} kW</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500">Samples</span>
            <span className="font-mono font-bold text-slate-200">{points.length}</span>
          </div>
        </div>
      </div>

      <div className="relative h-44 w-full">
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-slate-600">No readings yet — send telemetry to populate the chart</p>
          </div>
        ) : (
          <>
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(57,255,122,0.35)" />
                  <stop offset="100%" stopColor="rgba(57,255,122,0)" />
                </linearGradient>
              </defs>
              {[20, 40, 60, 80].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="rgba(51,65,92,0.3)"
                  strokeWidth="0.3"
                />
              ))}
              <path d={areaD} fill="url(#energyGrad)" />
              <path
                d={pathD}
                fill="none"
                stroke="#39FF7A"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'drop-shadow(0 0 4px rgba(57,255,122,0.6))' }}
              />
              {points.map((p, i) => {
                const step = points.length > 1 ? 100 / (points.length - 1) : 0;
                const x = i * step;
                const y = 100 - (p.power / Math.max(maxPower, 0.1)) * 100;
                const isWaste = p.status === 'Energy Waste';
                return (
                  <circle
                    key={p.id}
                    cx={x}
                    cy={y}
                    r="1.2"
                    fill={isWaste ? '#f87171' : '#39FF7A'}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
            <div className="absolute bottom-1 left-0 right-0 flex justify-between px-2 text-[10px] text-slate-600">
              {labels.map((l, i) => (
                <span key={`${l}-${i}`}>{l}</span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
