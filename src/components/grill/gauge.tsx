import { formatTemp, statusLabel } from "@/lib/grill/format";
import type { GrillStatus, Units } from "@/lib/grill/types";
import { cn } from "@/lib/utils";

const MIN = 150;
const MAX = 550;
const START = -135;
const SWEEP = 270;
const CX = 120;
const CY = 122;
const R = 88;

function clampPct(temp: number) {
  return Math.max(0, Math.min(1, (temp - MIN) / (MAX - MIN)));
}

function polar(r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arc(r: number, t0: number, t1: number) {
  const a0 = START + SWEEP * t0;
  const a1 = START + SWEEP * t1;
  const p0 = polar(r, a0);
  const p1 = polar(r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

const TICKS = [180, 225, 350, 500];

export function TempGauge({
  actual,
  setpoint,
  status,
  units,
}: {
  actual: number;
  setpoint: number;
  status: GrillStatus;
  units: Units;
}) {
  const live = status !== "off";
  const hot = status === "heating" || status === "igniting" || status === "at-temp";
  const fillTo = clampPct(actual);
  const setPct = clampPct(setpoint);
  const needle = polar(R, START + SWEEP * setPct);

  return (
    <div className="relative mx-auto w-full max-w-[16.5rem] sm:max-w-[18rem]">
      <svg
        viewBox="0 0 240 210"
        className={cn("w-full", hot && "drop-shadow-[0_0_24px_rgb(198_90_50_/_0.28)]")}
        aria-hidden="true"
      >
        <path
          d={arc(R, 0, 1)}
          fill="none"
          stroke="currentColor"
          className="text-fg/10"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {fillTo > 0.002 && (
          <path
            d={arc(R, 0, fillTo)}
            fill="none"
            stroke="url(#emberArc)"
            strokeWidth="14"
            strokeLinecap="round"
          />
        )}
        {TICKS.map((t) => {
          const p0 = polar(R - 12, START + SWEEP * clampPct(t));
          const p1 = polar(R - 22, START + SWEEP * clampPct(t));
          return (
            <line
              key={t}
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              className="stroke-fg/25"
              strokeWidth="1.5"
            />
          );
        })}
        <circle cx={needle.x} cy={needle.y} r="5" className="fill-fg" />
        <circle cx={needle.x} cy={needle.y} r="2.2" className="fill-ember" />
        <defs>
          <linearGradient id="emberArc" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-ember-dim)" />
            <stop offset="55%" stopColor="var(--color-ember)" />
            <stop offset="100%" stopColor="var(--color-heat)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <p className="font-display text-[0.7rem] tracking-[0.22em] text-muted uppercase">
          {statusLabel(status, actual, setpoint)}
        </p>
        <p
          className={cn(
            "font-display leading-none font-semibold tracking-tight tabular-nums",
            "text-5xl sm:text-6xl",
            live ? "text-fg" : "text-subtle",
          )}
        >
          {formatTemp(actual, units, false)}
        </p>
        <p className="mt-1 text-sm text-muted tabular-nums">
          Set {formatTemp(setpoint, units)}
        </p>
      </div>
    </div>
  );
}
