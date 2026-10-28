// Pure, testable decision engine: rule-based + statistical anomaly detection.
export const WASTE_THRESHOLD_A = 7.0;
export const TARIFF_BAHT_PER_KWH = 4.2; // assumption: approx. Thai commercial rate
export const CO2_KG_PER_KWH = 0.5; // assumption: approx. Thai grid emission factor
export const IDLE_HOURS_PER_MONTH = 14 * 22; // assumption: 14 idle h/day x 22 days
export const MIN_HISTORY = 5;
export const Z_LIMIT = 2.5;

export interface Analysis {
  status: 'Normal' | 'Energy Waste';
  anomaly: boolean;
  reasons: string[];
}

export const powerKw = (current: number, voltage = 220): number => (current * voltage) / 1000;

export function monthlyWaste(current: number, voltage = 220) {
  const kwh = powerKw(current, voltage) * IDLE_HOURS_PER_MONTH;
  return { kwh, baht: kwh * TARIFF_BAHT_PER_KWH, co2: kwh * CO2_KG_PER_KWH };
}

export function zScore(value: number, history: number[]): number | null {
  if (history.length < MIN_HISTORY) return null;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const std = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length);
  return std < 0.05 ? null : (value - mean) / std;
}

export function analyze(current: number, motion: boolean, history: number[] = []): Analysis {
  const reasons: string[] = [];
  const highLoad = current >= WASTE_THRESHOLD_A;
  const waste = highLoad && !motion;
  if (waste) reasons.push(`กระแส ${current.toFixed(1)} A ≥ ${WASTE_THRESHOLD_A} A และไม่มีคนอยู่`);
  const z = zScore(current, history);
  const anomaly = z !== null && z > Z_LIMIT && !motion;
  if (anomaly) reasons.push(`สูงผิดปกติเทียบประวัติห้อง (z=${z!.toFixed(1)})`);
  if (!reasons.length) reasons.push(highLoad ? 'โหลดสูงแต่มีคนใช้งาน' : 'โหลดต่ำกว่าเกณฑ์');
  return { status: waste ? 'Energy Waste' : 'Normal', anomaly, reasons };
}
