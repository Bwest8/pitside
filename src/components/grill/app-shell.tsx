import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChartPanel } from "@/components/grill/chart-panel";
import { TempGauge } from "@/components/grill/gauge";
import {
  getModel,
  SETPOINT_MAX,
  SETPOINT_MIN,
  SETPOINT_STEP,
  SMOKE_SETPOINT,
  STOCK_BOARD_TEMPS,
} from "@/lib/grill/data";
import {
  formatElapsed,
  formatTemp,
  fromDisplay,
  toDisplay,
  unitSuffix,
} from "@/lib/grill/format";
import { useGrillStore } from "@/lib/grill/store";
import type { TabId } from "@/lib/grill/types";
import { cn } from "@/lib/utils";
import { Flame, Settings2, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const TABS: { id: TabId; label: string; icon: typeof Flame }[] = [
  { id: "grill", label: "Grill", icon: Flame },
  { id: "settings", label: "Setup", icon: Settings2 },
];

export function AppShell() {
  const tick = useGrillStore((s) => s.tick);

  useEffect(() => {
    void useGrillStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const notes = tick(Date.now());
      for (const n of notes) toast(n);
    }, 250);
    return () => window.clearInterval(id);
  }, [tick]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl min-w-0 flex-col overflow-x-hidden px-4 pt-4 pb-[5.5rem] sm:px-6 md:pb-8">
      <Header />
      <MainView />
      <BottomNav />
      <Modals />
    </div>
  );
}

function Header() {
  const name = useGrillStore((s) => s.settings.grillName);
  const modelId = useGrillStore((s) => s.settings.modelId);
  const status = useGrillStore((s) => s.sim.status);
  const hopper = useGrillStore((s) => s.sim.hopperPct);
  const power = useGrillStore((s) => s.power);
  const model = getModel(modelId);
  const live = status !== "off";
  const empty = hopper <= 8;

  return (
    <header className="mb-4 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[0.7rem] tracking-[0.28em] text-ember uppercase">
            PitSide
          </p>
          <h1 className="font-display truncate text-2xl leading-tight font-semibold tracking-tight">
            {name}
          </h1>
          <p className="truncate text-sm text-muted">
            {model.id} · {model.area} · {model.hopperLb} lb hopper
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs md:inline-flex",
              "shadow-[var(--shadow-border)]",
              empty ? "text-warn" : live ? "text-heat" : "text-muted",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                empty ? "bg-warn" : live ? "bg-ember" : "bg-subtle",
                live && !empty && "animate-pulse",
              )}
            />
            {empty ? "No pellets" : live ? "On" : "Standby"}
          </span>
          <Button
            variant={live ? "ember" : "default"}
            onClick={power}
            aria-pressed={live}
          >
            {live ? "Shut down" : "Power"}
          </Button>
        </div>
      </div>
      <DesktopTabs />
    </header>
  );
}

function MainView() {
  const tab = useGrillStore((s) => s.tab);
  if (tab === "settings") return <SettingsView />;
  return <GrillView />;
}

function GrillView() {
  const sim = useGrillStore((s) => s.sim);
  const units = useGrillStore((s) => s.settings.units);
  const setSetpoint = useGrillStore((s) => s.setSetpoint);
  const nudge = useGrillStore((s) => s.nudgeSetpoint);
  const setP = useGrillStore((s) => s.setPSetting);
  const prime = useGrillStore((s) => s.prime);
  const setDialog = useGrillStore((s) => s.setDialog);
  const toggleProbe = useGrillStore((s) => s.toggleProbe);

  const smokeMode = sim.setpoint <= SMOKE_SETPOINT;
  const empty = sim.hopperPct <= 8;
  const priming = sim.primedUntil != null && Date.now() < sim.primedUntil;

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
      <section className="order-1 min-w-0 rounded-xl bg-surface p-4 pt-4 shadow-[var(--shadow-border)] sm:p-5">
        <TempGauge
          actual={sim.actual}
          setpoint={sim.setpoint}
          status={sim.status}
          units={units}
        />

        <div className="mt-1 grid grid-cols-3 gap-2 text-center">
          <Stat
            label="Cook"
            value={sim.cookStartedAt ? formatElapsed(sim.elapsedSimMs ?? 0) : "—"}
          />
          <Stat
            label="Hopper"
            value={empty ? "Empty" : `${Math.round(sim.hopperPct)}%`}
          />
          <Stat label="P-set" value={smokeMode ? `P${sim.pSetting}` : "—"} />
        </div>
      </section>

      <section className="order-2 min-w-0 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5 lg:order-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs tracking-[0.16em] text-muted uppercase">Set</p>
          <label className="flex items-baseline gap-1">
            <input
              type="number"
              min={toDisplay(SETPOINT_MIN, units)}
              max={toDisplay(SETPOINT_MAX, units)}
              step={units === "F" ? SETPOINT_STEP : 1}
              value={toDisplay(sim.setpoint, units)}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                setSetpoint(fromDisplay(n, units));
              }}
              className="font-display h-11 w-[4.5rem] rounded-md bg-surface-2 text-right text-lg font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              aria-label="Grill setpoint"
              suppressHydrationWarning
            />
            <span className="text-sm text-muted">{unitSuffix(units)}</span>
          </label>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            variant="secondary"
            className="min-w-11 px-2 tabular-nums"
            aria-label="Lower five degrees"
            onClick={() => nudge(-1)}
          >
            −5
          </Button>
          <input
            type="range"
            min={SETPOINT_MIN}
            max={SETPOINT_MAX}
            step={SETPOINT_STEP}
            value={sim.setpoint}
            onChange={(e) => setSetpoint(Number(e.target.value))}
            className="h-11 min-w-0 w-full accent-ember"
            aria-label="Grill setpoint slider"
            suppressHydrationWarning
          />
          <Button
            variant="secondary"
            className="min-w-11 px-2 tabular-nums"
            aria-label="Raise five degrees"
            onClick={() => nudge(1)}
          >
            +5
          </Button>
        </div>
        <p className="mt-3 text-xs tracking-[0.16em] text-muted uppercase">
          Factory
        </p>
        <div className="mt-1.5 flex min-w-0 gap-1.5 overflow-x-auto pb-1">
          {STOCK_BOARD_TEMPS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSetpoint(t)}
              className={cn(
                "h-9 shrink-0 rounded-md px-2.5 text-xs tabular-nums",
                sim.setpoint === t
                  ? "bg-ember text-ember-fg"
                  : "bg-surface-2 text-muted hover:text-fg",
              )}
            >
              {t === SMOKE_SETPOINT ? "Smoke" : toDisplay(t, units)}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant={priming ? "ember" : "secondary"} onClick={prime}>
            Prime
          </Button>
          <Button variant="outline" onClick={() => setDialog({ kind: "calibrate" })}>
            <SlidersHorizontal />
            Sync
          </Button>
        </div>

        <p className="mt-4 mb-2 text-xs tracking-[0.16em] text-muted uppercase">
          P-set
        </p>
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 8 }, (_, i) => (
            <button
              key={i}
              type="button"
              disabled={!smokeMode}
              onClick={() => setP(i)}
              className={cn(
                "h-10 min-w-0 rounded-md px-0 text-sm font-medium tabular-nums",
                smokeMode && sim.pSetting === i
                  ? "bg-ember text-ember-fg"
                  : "bg-surface-2 text-muted",
                !smokeMode && "opacity-40",
              )}
            >
              {i}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {smokeMode ? "Default P4. P0 feeds more often." : "Available in Smoke."}
        </p>
      </section>

      <section className="order-3 min-w-0 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5 lg:order-2">
        <h2 className="font-display mb-3 text-lg font-semibold">Probes</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {sim.probes.map((p) => (
            <article
              key={p.id}
              className="min-w-0 rounded-lg bg-surface-2 p-3 shadow-[var(--shadow-border)]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs tracking-[0.14em] text-muted uppercase">
                  Probe {p.id}
                </p>
                <button
                  type="button"
                  onClick={() => toggleProbe(p.id)}
                  className="h-8 rounded-md px-2 text-xs text-muted hover:text-fg"
                >
                  {p.connected ? "Connected" : "Off"}
                </button>
              </div>
              <p
                className={cn(
                  "font-display mt-1 text-4xl leading-none font-semibold tabular-nums",
                  p.connected ? "text-fg" : "text-subtle",
                )}
              >
                {p.connected ? formatTemp(p.temp, units, false) : "—"}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="order-4 min-w-0 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5 lg:order-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">History</h2>
          <div className="flex gap-3 text-[0.7rem] text-muted">
            <span className="text-ember">Grill</span>
            <span className="text-heat">P1</span>
            <span className="text-ok">P2</span>
          </div>
        </div>
        <ChartPanel history={sim.history} units={units} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-2 py-2.5">
      <p className="text-[0.65rem] tracking-[0.16em] text-muted uppercase">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SettingsView() {
  const settings = useGrillStore((s) => s.settings);
  const setName = useGrillStore((s) => s.setGrillName);
  const setGrillIp = useGrillStore((s) => s.setGrillIp);
  const setUnits = useGrillStore((s) => s.setUnits);
  const model = getModel(settings.modelId);

  return (
    <section className="mx-auto w-full max-w-xl">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Setup</h2>

      <div className="mt-5 space-y-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <label className="block">
          <span className="text-xs tracking-[0.14em] text-muted uppercase">Name</span>
          <input
            value={settings.grillName}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-md bg-surface-2 px-3 text-fg shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        </label>

        <fieldset>
          <legend className="text-xs tracking-[0.14em] text-muted uppercase">Units</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["F", "C"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnits(u)}
                className={cn(
                  "h-11 rounded-md",
                  settings.units === u
                    ? "bg-ember text-ember-fg"
                    : "bg-surface-2 text-muted",
                )}
              >
                {unitSuffix(u)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-xs tracking-[0.14em] text-muted uppercase">
            Grill address
          </span>
          <input
            value={settings.grillIp ?? ""}
            onChange={(e) => setGrillIp(e.target.value)}
            placeholder="192.168.x.x"
            inputMode="decimal"
            autoComplete="off"
            className="mt-1.5 h-11 w-full rounded-md bg-surface-2 px-3 text-fg shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        </label>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <Spec label="Model" value={model.id} />
        <Spec label="Board" value="PBC" />
        <Spec label="Area" value={model.area} />
        <Spec label="Hopper" value={`${model.hopperLb} lb`} />
        <Spec label="Probes" value="2" />
        <Spec label="Range" value="180–500°F" />
      </dl>
    </section>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] tracking-[0.14em] text-muted uppercase">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function BottomNav() {
  const tab = useGrillStore((s) => s.tab);
  const setTab = useGrillStore((s) => s.setTab);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.7rem]",
                  on ? "text-heat" : "text-muted",
                )}
              >
                <Icon className="size-5" />
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DesktopTabs() {
  const tab = useGrillStore((s) => s.tab);
  const setTab = useGrillStore((s) => s.setTab);
  return (
    <div className="mt-3 hidden gap-1 md:flex">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className={cn(
            "h-10 rounded-md px-3 text-sm",
            tab === t.id ? "bg-surface text-fg" : "text-muted hover:text-fg",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Modals() {
  const dialog = useGrillStore((s) => s.dialog);
  const setDialog = useGrillStore((s) => s.setDialog);
  const confirmShutdown = useGrillStore((s) => s.confirmShutdown);
  const calibrate = useGrillStore((s) => s.calibrate);
  const sim = useGrillStore((s) => s.sim);
  const units = useGrillStore((s) => s.settings.units);

  const [cal, setCal] = useState({ grill: 0, p1: 0, p2: 0, hopper: 0 });

  useEffect(() => {
    if (dialog?.kind === "calibrate") {
      setCal({
        grill: Math.round(sim.actual),
        p1: Math.round(sim.probes[0].temp),
        p2: Math.round(sim.probes[1].temp),
        hopper: Math.round(sim.hopperPct),
      });
    }
  }, [dialog, sim.actual, sim.hopperPct, sim.probes]);

  const open = dialog != null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setDialog(null)}>
      <DialogContent>
        {dialog?.kind === "shutdown" ? (
          <>
            <DialogHeader>
              <DialogTitle>Shut down?</DialogTitle>
              <DialogDescription>
                Feed stops. The fan runs until the pit cools.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmShutdown}>
                Shut down
              </Button>
            </div>
          </>
        ) : null}

        {dialog?.kind === "calibrate" ? (
          <>
            <DialogHeader>
              <DialogTitle>Sync</DialogTitle>
              <DialogDescription>
                Match ACT, hopper, and probes to the controller.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label={`ACT ${unitSuffix(units)}`}
                value={toDisplay(cal.grill, units)}
                onChange={(n) => setCal((c) => ({ ...c, grill: fromDisplay(n, units) }))}
              />
              <NumField
                label="Hopper %"
                value={cal.hopper}
                onChange={(n) => setCal((c) => ({ ...c, hopper: n }))}
              />
              <NumField
                label={`Probe 1 ${unitSuffix(units)}`}
                value={toDisplay(cal.p1, units)}
                onChange={(n) => setCal((c) => ({ ...c, p1: fromDisplay(n, units) }))}
              />
              <NumField
                label={`Probe 2 ${unitSuffix(units)}`}
                value={toDisplay(cal.p2, units)}
                onChange={(n) => setCal((c) => ({ ...c, p2: fromDisplay(n, units) }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button onClick={() => calibrate(cal)}>Save</Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[0.65rem] tracking-[0.14em] text-muted uppercase">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-11 w-full rounded-md bg-surface-2 px-3 tabular-nums shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      />
    </label>
  );
}
