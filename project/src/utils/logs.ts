import type { LogLevel } from '../types';

const PAD = (n: number, len = 2) => String(n).padStart(len, '0');

export function timestampNow(): string {
  const d = new Date();
  return `${PAD(d.getHours())}:${PAD(d.getMinutes())}:${PAD(d.getSeconds())}.${PAD(
    d.getMilliseconds(),
    3,
  )}`;
}

export const LEVEL_STYLES: Record<LogLevel, { text: string; bg: string; label: string }> = {
  success: { text: 'text-kmitl-green', bg: 'bg-kmitl-green/10', label: 'Sync Success' },
  error: { text: 'text-red-400', bg: 'bg-red-500/10', label: 'Error' },
  warn: { text: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Warn' },
  info: { text: 'text-sky-400', bg: 'bg-sky-500/10', label: 'Info' },
};

export function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
