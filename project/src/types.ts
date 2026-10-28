export type RoomStatus = 'Normal' | 'Energy Waste';

export interface Room {
  id: string;
  building: string;
  roomNumber: string;
  current: number; // amps
  motion: boolean;
  status: RoomStatus;
  lastUpdated: number;
  zone: string;
}

export type LogLevel = 'success' | 'error' | 'info' | 'warn';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  tag: string;
}

export interface SimulationPayload {
  roomNumber: string;
  building: string;
  current: number;
  motion: boolean;
  voltage: number;
}

export interface EnergyReading {
  id: string;
  roomId: string;
  building: string;
  roomNumber: string;
  current: number;
  power: number;
  status: string;
  timestamp: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warn' | 'info';
  title: string;
  message: string;
}
