import { useState } from 'react';
import { Send, Gauge, ToggleLeft, ToggleRight, Radio, Loader2 } from 'lucide-react';
import type { SimulationPayload } from '../types';

interface Props {
  onSend: (payload: SimulationPayload) => void;
  buildings: string[];
}

const DEFAULT_BUILDINGS = ['ECC Building', 'IT Building', 'EE Building', 'ME Building'];

export default function SimulatorForm({ onSend, buildings = DEFAULT_BUILDINGS }: Props) {
  const [roomNumber, setRoomNumber] = useState('');
  const [building, setBuilding] = useState(buildings[0] ?? DEFAULT_BUILDINGS[0]);
  const [current, setCurrent] = useState(2.5);
  const [motion, setMotion] = useState(true);
  const [voltage, setVoltage] = useState(220);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const rn = roomNumber.trim();
    if (!rn) return setError('กรุณาระบุหมายเลขห้อง');
    if (rn.length > 12 || !/^[A-Za-z0-9\u0E00-\u0E7F _-]+$/.test(rn))
      return setError('หมายเลขห้องใช้ได้เฉพาะตัวอักษร ตัวเลข ช่องว่าง - _ (ไม่เกิน 12 ตัว)');
    setError(null);
    setSending(true);
    onSend({
      roomNumber: roomNumber.trim(),
      building,
      current,
      motion,
      voltage,
    });
    setTimeout(() => setSending(false), 550);
  };

  const previewWaste = !motion && current >= 7;

  return (
    <section className="rounded-2xl border border-charcoal-500/50 bg-charcoal-850/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kmitl-orange/15">
          <Radio className="h-4.5 w-4.5 text-kmitl-orange-light" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-bold tracking-wide text-slate-100">
            IoT DEVICE SIMULATOR
          </h2>
          <p className="text-[11px] text-slate-500">Push telemetry to the K-SES mesh network</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Room Number
            </label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => {
                setRoomNumber(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. 402"
              className="w-full rounded-lg border border-charcoal-500 bg-charcoal-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-kmitl-orange focus:ring-1 focus:ring-kmitl-orange/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Building
            </label>
            <select
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              className="w-full rounded-lg border border-charcoal-500 bg-charcoal-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-kmitl-orange focus:ring-1 focus:ring-kmitl-orange/50"
            >
              {(buildings.length ? buildings : DEFAULT_BUILDINGS).map((b) => (
                <option key={b} value={b} className="bg-charcoal-900">
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <span className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-kmitl-orange-light" /> Current (Amps)
              </span>
              <span className="font-mono text-base font-bold text-kmitl-orange-light">
                {current.toFixed(1)} A
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={20}
              step={0.1}
              value={current}
              onChange={(e) => setCurrent(parseFloat(e.target.value))}
              className="mt-2 w-full accent-kmitl-orange"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-600">
              <span>0</span>
              <span>10</span>
              <span>20</span>
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <span>Voltage</span>
              <span className="font-mono text-base font-bold text-slate-200">
                {voltage} V
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={240}
              step={1}
              value={voltage}
              onChange={(e) => setVoltage(parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-kmitl-orange"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-600">
              <span>0</span>
              <span>120</span>
              <span>240</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMotion((m) => !m)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 transition ${
            motion
              ? 'border-kmitl-green/40 bg-kmitl-green/10'
              : 'border-charcoal-500 bg-charcoal-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {motion ? (
              <ToggleRight className="h-5 w-5 text-kmitl-green" />
            ) : (
              <ToggleLeft className="h-5 w-5 text-slate-500" />
            )}
            <span className="text-sm font-medium text-slate-200">Motion Sensor</span>
          </div>
          <span
            className={`font-mono text-xs font-bold ${
              motion ? 'text-kmitl-green' : 'text-slate-500'
            }`}
          >
            {motion ? 'DETECTED' : 'NO MOTION'}
          </span>
        </button>

        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            previewWaste
              ? 'border-red-500/40 bg-red-950/30 text-red-300'
              : 'border-kmitl-green/30 bg-kmitl-green/5 text-kmitl-green'
          }`}
        >
          {previewWaste
            ? 'AI Prediction: Energy Waste! (high current, no motion)'
            : 'AI Prediction: Normal consumption'}
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-kmitl-orange to-kmitl-orange-dark px-4 py-2.5 font-mono text-sm font-bold tracking-wide text-white shadow-[0_0_18px_rgba(255,106,0,0.4)] transition hover:shadow-[0_0_26px_rgba(255,106,0,0.65)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              TRANSMITTING…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              ยิงสัญญาณ · SEND TELEMETRY
            </>
          )}
        </button>
      </form>
    </section>
  );
}
