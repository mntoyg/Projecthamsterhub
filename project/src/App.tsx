import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import MetricCards from './components/MetricCards';
import RoomGrid from './components/RoomGrid';
import SimulatorForm from './components/SimulatorForm';
import LiveLogs from './components/LiveLogs';
import EnergyChart from './components/EnergyChart';
import Toasts from './components/Toasts';
import { INITIAL_ROOMS, computeEnergySaved, countCritical } from './data/rooms';
import {
  fetchRooms,
  upsertRoom,
  insertLog,
  fetchLogs,
  clearLogs as clearLogsApi,
  deleteRoom,
  fetchEnergyReadings,
  subscribeToRooms,
  subscribeToLogs,
  unsubscribeChannel,
} from './lib/api';
import { timestampNow, genId } from './utils/logs';
import { isSupabaseConfigured } from './lib/supabase';
import { API_URL } from './lib/config';
import SystemBeacon from './components/SystemBeacon';
import AutoSim from './components/AutoSim';
import { analyze, powerKw } from './engine/energy';
import type { Room, LogEntry, SimulationPayload, EnergyReading, ToastMessage } from './types';

const UPTIME = 99.9;
const MAX_LOGS = 80;

const BOOT_LOGS: LogEntry[] = [
  { id: 'boot-1', timestamp: '00:00:01.001', level: 'info', tag: '[BOOT]', message: 'K-SES core initialized · AI engine online' },
  { id: 'boot-2', timestamp: '00:00:01.120', level: 'success', tag: '[MESH]', message: 'Connected to 6 IoT nodes across KMITL campus' },
  { id: 'boot-3', timestamp: '00:00:01.240', level: 'info', tag: '[AI]', message: 'Energy optimization model loaded (v3.2)' },
];

function load<T>(key: string, fallback: T): T {
  if (isSupabaseConfigured) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  if (isSupabaseConfigured) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: app keeps working in memory
  }
}

function App() {
  const [rooms, setRooms] = useState<Room[]>(() => load<Room[]>('ksesRooms', INITIAL_ROOMS));
  const [logs, setLogs] = useState<LogEntry[]>(BOOT_LOGS);
  const [readings, setReadings] = useState<EnergyReading[]>(() => load<EnergyReading[]>('ksesReadings', []));
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [connectionState, setConnection] = useState<'connecting' | 'online' | 'offline'>(
    isSupabaseConfigured || API_URL ? 'connecting' : 'online',
  );
  const [beacon, setBeacon] = useState<{ status: 'idle' | 'normal' | 'waste'; label: string; detail: string }>({
    status: 'idle',
    label: 'STANDBY',
    detail: 'รอรับสัญญาณจากเซนเซอร์…',
  });

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    setToasts((prev) => [...prev, { ...toast, id: genId() }].slice(-4));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addLog = useCallback(async (entry: { level: LogEntry['level']; tag: string; message: string }) => {
    setLogs((prev) =>
      [...prev, { ...entry, id: genId(), timestamp: timestampNow() }].slice(-MAX_LOGS),
    );
    try {
      await insertLog(entry);
    } catch {
      // UI already shows the local entry
    }
  }, []);

  // Initial load + realtime subscriptions
  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const [dbRooms, dbLogs, dbReadings] = await Promise.all([
          fetchRooms(),
          fetchLogs(MAX_LOGS),
          fetchEnergyReadings(30),
        ]);
        if (cancelled) return;
        setRooms(dbRooms);
        if (dbLogs.length > 0) setLogs(dbLogs);
        setReadings(dbReadings);
        setConnection('online');
      } catch (err) {
        if (cancelled) return;
        setConnection('offline');
        await addLog({
          level: 'error',
          tag: '[DB]',
          message: `Failed to sync with database: ${(err as Error).message}`,
        });
      }
    })();

    const roomsChannel = subscribeToRooms(({ eventType, newData, oldData }) => {
      setConnection('online');
      if (eventType === 'DELETE' && oldData) {
        setRooms((prev) => prev.filter((r) => r.id !== oldData.id));
      } else if (newData) {
        setRooms((prev) => {
          const exists = prev.some((r) => r.id === newData.id);
          return exists
            ? prev.map((r) => (r.id === newData.id ? newData : r))
            : [...prev, newData];
        });
        if (newData.status === 'Energy Waste' && eventType === 'INSERT') {
          addToast({
            type: 'error',
            title: 'Energy Waste Detected',
            message: `${newData.building} Rm ${newData.roomNumber} flagged as waste`,
          });
        }
      }
    });

    const logsChannel = subscribeToLogs((entry) => {
      setLogs((prev) => [...prev, entry].slice(-MAX_LOGS));
    });

    return () => {
      cancelled = true;
      unsubscribeChannel(roomsChannel);
      unsubscribeChannel(logsChannel);
    };
  }, [addLog, addToast]);

  // API mode: poll the backend every 2 s; show OFFLINE (and keep last data) if it stops answering
  useEffect(() => {
    if (!API_URL) return;
    let stop = false;
    const tick = async () => {
      try {
        const [r, rd] = await Promise.all([fetchRooms(), fetchEnergyReadings(30)]);
        if (stop) return;
        if (r.length) setRooms(r);
        setReadings(rd);
        setConnection('online');
      } catch {
        if (!stop) setConnection('offline');
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => save('ksesRooms', rooms), [rooms]);
  useEffect(() => save('ksesReadings', readings), [readings]);

  const energySaved = useMemo(() => computeEnergySaved(rooms), [rooms]);
  const criticalCount = useMemo(() => countCritical(rooms), [rooms]);

  const handleSend = useCallback(
    async (payload: SimulationPayload) => {
      // Fault tolerance: validate before anything touches state
      const problems: string[] = [];
      if (!payload.roomNumber.trim()) problems.push('ไม่ได้ระบุห้อง');
      if (!Number.isFinite(payload.current) || payload.current < 0 || payload.current > 100)
        problems.push('ค่ากระแสต้องอยู่ระหว่าง 0–100 A');
      if (!Number.isFinite(payload.voltage) || payload.voltage < 0 || payload.voltage > 500)
        problems.push('ค่าแรงดันต้องอยู่ระหว่าง 0–500 V');
      if (problems.length) {
        await addLog({ level: 'warn', tag: '[VALID]', message: `Packet rejected · ${problems.join(' · ')}` });
        addToast({ type: 'warn', title: 'ข้อมูลไม่ถูกต้อง', message: problems.join(' · ') });
        return;
      }
      try {
        const room = await upsertRoom(payload);
        setRooms((prev) => {
          const next = prev.some((r) => r.id === room.id)
            ? prev.map((r) => (r.id === room.id ? room : r))
            : [...prev, room];
          return next;
        });

        // Refresh energy chart readings
        if (isSupabaseConfigured) {
          const fresh = await fetchEnergyReadings(30);
          setReadings(fresh);
        } else {
          setReadings((prev) =>
            [
              ...prev,
              {
                id: genId(),
                roomId: room.id,
                building: room.building,
                roomNumber: room.roomNumber,
                current: room.current,
                power: Math.round(((payload.current * payload.voltage) / 1000) * 1000) / 1000,
                status: room.status,
                timestamp: Date.now(),
              },
            ].slice(-30),
          );
        }

        const power = powerKw(payload.current, payload.voltage);
        const history = readings.filter((x) => x.roomId === room.id).slice(-20, -1).map((x) => x.current);
        const analysis = analyze(payload.current, payload.motion, history);
        await addLog({
          level: 'success',
          tag: '[MESH]',
          message: `Telemetry rx · ${payload.building} Rm ${payload.roomNumber} · ${payload.current.toFixed(1)}A / ${payload.voltage}V · ${power.toFixed(2)}kW · motion=${payload.motion ? 'ON' : 'OFF'}`,
        });

        setBeacon(
          room.status === 'Energy Waste'
            ? {
                status: 'waste',
                label: 'ENERGY WASTE',
                detail: `${payload.building} Rm ${payload.roomNumber} · ${payload.current.toFixed(1)} A และไม่มีคนอยู่ → เปิดไฟ/แอร์ทิ้งไว้`,
              }
            : {
                status: 'normal',
                label: 'NORMAL',
                detail: `${payload.building} Rm ${payload.roomNumber} · ${payload.current.toFixed(1)} A · การใช้พลังงานปกติ`,
              },
        );

        if (room.status === 'Energy Waste') {
          await addLog({
            level: 'error',
            tag: '[AI]',
            message: `ALERT · ${payload.building} Rm ${payload.roomNumber} ENERGY WASTE · ${(room.reasons ?? analysis.reasons).join(' · ')}`,
          });
          addToast({
            type: 'error',
            title: 'Energy Waste Detected',
            message: `${payload.building} Rm ${payload.roomNumber} · ${payload.current.toFixed(1)}A with no motion`,
          });
        } else {
          await addLog({
            level: 'info',
            tag: '[AI]',
            message: `${payload.building} Rm ${payload.roomNumber} classified NORMAL by AI model`,
          });
          addToast({
            type: 'success',
            title: 'Telemetry Synced',
            message: `${payload.building} Rm ${payload.roomNumber} · NORMAL`,
          });
        }

        setConnection('online');
      } catch (err) {
        setConnection('offline');
        await addLog({
          level: 'error',
          tag: '[MESH]',
          message: `Send failed: ${(err as Error).message}`,
        });
        addToast({
          type: 'error',
          title: 'Send Failed',
          message: (err as Error).message,
        });
      }
    },
    [addLog, addToast, readings],
  );

  const handleDeleteRoom = useCallback(
    async (roomId: string) => {
      const room = rooms.find((r) => r.id === roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      try {
        await deleteRoom(roomId);
        await addLog({
          level: 'warn',
          tag: '[SYS]',
          message: `Room ${room ? `${room.building} Rm ${room.roomNumber}` : roomId} removed from monitoring`,
        });
        addToast({
          type: 'info',
          title: 'Room Removed',
          message: room ? `${room.building} Rm ${room.roomNumber}` : roomId,
        });
      } catch (err) {
        if (room) setRooms((prev) => [...prev, room]);
        await addLog({
          level: 'error',
          tag: '[DB]',
          message: `Delete failed: ${(err as Error).message}`,
        });
        addToast({ type: 'error', title: 'Delete Failed', message: (err as Error).message });
      }
    },
    [rooms, addLog, addToast],
  );

  const handleClearLogs = useCallback(async () => {
    setLogs([{ id: genId(), timestamp: timestampNow(), level: 'info', tag: '[SYS]', message: 'Console cleared by operator' }]);
    try {
      await clearLogsApi();
    } catch (err) {
      await addLog({ level: 'error', tag: '[DB]', message: `Clear failed: ${(err as Error).message}` });
    }
  }, [addLog]);

  const buildingList = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.building))),
    [rooms],
  );

  return (
    <div className="min-h-screen bg-charcoal-900 text-slate-100">
      <Header connectionState={connectionState} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        <MetricCards
          energySaved={energySaved}
          criticalRooms={criticalCount}
          uptime={UPTIME}
          totalRooms={rooms.length}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <SystemBeacon {...beacon} />
            <AutoSim rooms={rooms} onSend={handleSend} />
            <RoomGrid rooms={rooms} onDelete={handleDeleteRoom} />
            <EnergyChart readings={readings} />
          </div>
          <div className="lg:col-span-1">
            <SimulatorForm onSend={handleSend} buildings={buildingList} />
          </div>
        </div>
        <LiveLogs logs={logs} onClear={handleClearLogs} />
      </main>
      <footer className="border-t border-charcoal-600/40 px-4 py-4 text-center text-[11px] text-slate-600">
        KMITL Smart Grid &amp; AI Energy Guardian · Built for <span className="text-slate-400">Phra Pathom Witthayalai School</span> · Powered by IoT &amp; AI Optimization
      </footer>
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
