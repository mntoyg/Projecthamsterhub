import { AlertTriangle, CheckCircle2, MapPin, Activity, Radar, Trash2 } from 'lucide-react';
import type { Room } from '../types';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function RoomCard({ room, onDelete }: { room: Room; onDelete?: (id: string) => void }) {
  const waste = room.status === 'Energy Waste';

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 ${
        waste
          ? 'border-red-500/50 bg-red-950/30 shadow-[0_0_20px_rgba(248,113,113,0.18)]'
          : 'border-charcoal-500/60 bg-charcoal-800/70 shadow-[0_0_14px_rgba(57,255,122,0.08)] hover:border-kmitl-green/40'
      }`}
    >
      {waste && (
        <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-red-500/20 blur-2xl" />
      )}

      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            <MapPin className="h-3 w-3" />
            {room.zone}
          </div>
          <h3 className="mt-1 font-mono text-base font-semibold text-slate-100">
            {room.building} · Rm {room.roomNumber}
          </h3>
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            waste ? 'bg-red-500/20' : 'bg-kmitl-green/10'
          }`}
        >
          {waste ? (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-kmitl-green" />
          )}
        </div>
      </div>

      <div
        className={`relative mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold tracking-wide ${
          waste
            ? 'animate-blink-waste bg-red-500/20 text-red-300'
            : 'bg-kmitl-green/10 text-kmitl-green'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${waste ? 'bg-red-400' : 'bg-kmitl-green'}`} />
        {waste ? 'Energy Waste!' : 'Normal'}
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2 border-t border-charcoal-600/50 pt-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Current</p>
          <p className={`font-mono text-sm font-semibold ${waste ? 'text-red-300' : 'text-slate-200'}`}>
            {room.current.toFixed(1)} <span className="text-[10px] text-slate-500">A</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Motion</p>
          <p className="flex items-center gap-1 font-mono text-sm font-semibold">
            <Activity
              className={`h-3.5 w-3.5 ${
                room.motion ? 'text-kmitl-green animate-pulse' : 'text-slate-600'
              }`}
            />
            <span className={room.motion ? 'text-kmitl-green' : 'text-slate-500'}>
              {room.motion ? 'ON' : 'OFF'}
            </span>
          </p>
        </div>
      </div>

      <div className="relative mt-3 flex items-center justify-between">
        <p className="text-[10px] text-slate-600">Updated {timeAgo(room.lastUpdated)}</p>
        {onDelete && (
          <button
            onClick={() => onDelete(room.id)}
            className="flex items-center gap-1 rounded-md border border-charcoal-500 px-1.5 py-1 text-[10px] text-slate-500 transition hover:border-red-500/50 hover:text-red-400"
          >
            <Trash2 className="h-2.5 w-2.5" />
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

interface GridProps {
  rooms: Room[];
  onDelete?: (id: string) => void;
}

export default function RoomGrid({ rooms, onDelete }: GridProps) {
  return (
    <section className="rounded-2xl border border-charcoal-500/50 bg-charcoal-850/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kmitl-orange/15">
            <Radar className="h-4.5 w-4.5 text-kmitl-orange-light" />
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold tracking-wide text-slate-100">
              AI REAL-TIME DASHBOARD
            </h2>
            <p className="text-[11px] text-slate-500">Live classroom energy monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-kmitl-green" /> Normal
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 animate-blink-waste rounded-full bg-red-400" /> Waste
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}
