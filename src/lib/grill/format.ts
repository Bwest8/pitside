import { SETPOINT_MAX, SETPOINT_MIN, SETPOINT_STEP } from "./data";
import type { GrillStatus, Units } from "./types";

export function toDisplay(tempF: number, units: Units): number {
  if (units === "C") return Math.round(((tempF - 32) * 5) / 9);
  return Math.round(tempF);
}

export function fromDisplay(temp: number, units: Units): number {
  if (units === "C") return Math.round((temp * 9) / 5 + 32);
  return Math.round(temp);
}

export function formatTemp(tempF: number, units: Units, withUnit = true): string {
  const n = toDisplay(tempF, units);
  return withUnit ? `${n}°${units}` : `${n}°`;
}

export function unitSuffix(units: Units): string {
  return `°${units}`;
}

export function statusLabel(status: GrillStatus, actual?: number, setpoint?: number): string {
  switch (status) {
    case "off":
      return "Standby";
    case "igniting":
      return "Igniting";
    case "heating":
      if (actual != null && setpoint != null && actual > setpoint + 10) return "Settling";
      return "Coming up";
    case "at-temp":
      return "At temp";
    case "cooling":
      return "Cooling";
  }
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDurationPretty(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function snapSetpoint(tempF: number): number {
  const clamped = Math.min(SETPOINT_MAX, Math.max(SETPOINT_MIN, tempF));
  return Math.round(clamped / SETPOINT_STEP) * SETPOINT_STEP;
}

export function probeProgress(temp: number, target: number | null): number {
  if (!target) return 0;
  const start = 40;
  const span = Math.max(1, target - start);
  return Math.max(0, Math.min(1, (temp - start) / span));
}
