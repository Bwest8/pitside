import { formatTemp } from "@/lib/grill/format";
import type { HistoryPoint, Units } from "@/lib/grill/types";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ChartTip({
  active,
  payload,
  units,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  units: Units;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2 text-xs shadow-[var(--shadow-border)]">
      {payload.map((p) => (
        <p key={p.name} className="tabular-nums" style={{ color: p.color }}>
          {p.name} {formatTemp(p.value, units)}
        </p>
      ))}
    </div>
  );
}

export function ChartPanel({
  history,
  units,
}: {
  history: HistoryPoint[];
  units: Units;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = useMemo(
    () =>
      history.map((h) => ({
        t: h.t,
        Grill: Math.round(h.grill * 10) / 10,
        Set: h.set,
        P1: h.p1 == null ? null : Math.round(h.p1 * 10) / 10,
        P2: h.p2 == null ? null : Math.round(h.p2 * 10) / 10,
      })),
    [history],
  );

  if (!mounted) {
    return <div className="h-48 w-full sm:h-56" />;
  }

  if (data.length < 2) {
    return (
      <div className="flex h-44 items-center justify-center rounded-lg bg-surface-2 text-sm text-muted">
        History fills in as the cook runs.
      </div>
    );
  }

  const start = data[0].t;

  return (
    <div className="h-48 w-full sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="rgb(244 237 228 / 0.06)" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(v: number) => {
              const m = Math.max(0, Math.round((v - start) / 60000));
              return `${m}m`;
            }}
            tick={{ fill: "#6e6860", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#6e6860", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            content={<ChartTip units={units} />}
            cursor={{ stroke: "rgb(244 237 228 / 0.12)" }}
          />
          <Line
            type="monotone"
            dataKey="Set"
            stroke="color-mix(in oklab, var(--color-fg) 28%, transparent)"
            strokeDasharray="4 4"
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="Grill"
            stroke="var(--color-ember)"
            dot={false}
            strokeWidth={2.2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="P1"
            stroke="var(--color-heat)"
            dot={false}
            strokeWidth={1.6}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="P2"
            stroke="var(--color-ok)"
            dot={false}
            strokeWidth={1.6}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
