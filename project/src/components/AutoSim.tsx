import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import type { Room, SimulationPayload } from '../types';

const SCENARIOS = {
  class: { label: 'ชั่วโมงเรียน 10:30', motion: 0.9, amps: [1.5, 6] },
  after: { label: 'หลังเลิกเรียน 16:30', motion: 0.15, amps: [6, 16] },
} as const;
type Key = keyof typeof SCENARIOS;

const rnd = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 10) / 10;

export default function AutoSim({ rooms, onSend }: { rooms: Room[]; onSend: (p: SimulationPayload) => void }) {
  const [running, setRunning] = useState(false);
  const [key, setKey] = useState<Key>('after');
  const roomsRef = useRef(rooms);
  const sendRef = useRef(onSend);
  roomsRef.current = rooms;
  sendRef.current = onSend;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const list = roomsRef.current;
      if (!list.length) return;
      const r = list[Math.floor(Math.random() * list.length)];
      const sc = SCENARIOS[key];
      sendRef.current({
        building: r.building,
        roomNumber: r.roomNumber,
        current: rnd(sc.amps[0], sc.amps[1]),
        motion: Math.random() < sc.motion,
        voltage: 220,
      });
    }, 2500);
    return () => clearInterval(id);
  }, [running, key]);

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-charcoal-500/50 bg-charcoal-850/60 p-3">
      <span className="font-mono text-xs font-bold tracking-wide text-slate-300">AUTO SIMULATION</span>
      <select
        value={key}
        onChange={(e) => setKey(e.target.value as Key)}
        className="rounded-lg border border-charcoal-500 bg-charcoal-900 px-2 py-1.5 text-xs text-slate-100"
      >
        {Object.entries(SCENARIOS).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
      <button
        onClick={() => setRunning((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-bold text-white ${
          running ? 'bg-red-600' : 'bg-kmitl-orange'
        }`}
      >
        {running ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {running ? 'STOP' : 'START'}
      </button>
    </section>
  );
}
