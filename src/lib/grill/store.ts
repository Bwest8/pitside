import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getModel, getProgram } from "./data";
import { snapSetpoint } from "./format";
import {
  igniteGrill,
  seedMidCook,
  seedSessions,
  shutdownGrill,
  startProgram,
  tickSim,
} from "./simulator";
import type {
  CookSession,
  DialogMode,
  GrillSim,
  Settings,
  TabId,
  TimeWarp,
  Units,
} from "./types";

type GrillStore = {
  tab: TabId;
  dialog: DialogMode;
  settings: Settings;
  sim: GrillSim;
  sessions: CookSession[];
  toastQueue: string[];
  setTab: (tab: TabId) => void;
  setDialog: (dialog: DialogMode) => void;
  tick: (now: number) => string[];
  setSetpoint: (tempF: number) => void;
  nudgeSetpoint: (dir: 1 | -1) => void;
  setPSetting: (p: number) => void;
  toggleLight: () => void;
  openLid: () => void;
  prime: () => void;
  power: () => void;
  confirmShutdown: () => void;
  launchProgram: (programId: string) => void;
  calibrate: (vals: { grill: number; p1: number; p2: number; hopper: number }) => void;
  setGrillName: (name: string) => void;
  setGrillIp: (ip: string) => void;
  setModelId: (id: string) => void;
  setUnits: (units: Units) => void;
  setTimeWarp: (warp: TimeWarp) => void;
  completeCook: (notes: string, rating: number) => void;
  deleteSession: (id: string) => void;
  setProbeTarget: (id: 1 | 2, target: number | null) => void;
  toggleProbe: (id: 1 | 2) => void;
};

const BOOT = 1_746_288_000_000;

export const useGrillStore = create<GrillStore>()(
  persist(
    (set, get) => ({
      tab: "grill",
      dialog: null,
      settings: {
        grillName: "Sportsman 820",
        modelId: "PB0820SPW",
        units: "F",
        timeWarp: 10,
        grillIp: "",
      },
      sim: seedMidCook(BOOT),
      sessions: seedSessions(BOOT),
      toastQueue: [],
      setTab: (tab) => set({ tab }),
      setDialog: (dialog) => set({ dialog }),
      tick: (now) => {
        const { sim, settings } = get();
        const elapsedMs = Math.max(0, now - (sim.lastTick || now));
        const dt = (elapsedMs / 1000) * settings.timeWarp;
        if (dt <= 0) return [];
        const capped = Math.min(dt, 8 * settings.timeWarp);
        const prev = sim;
        const next = tickSim(sim, capped, now);
        const toasts: string[] = [];

        if (prev.status === "igniting" && next.status !== "igniting") {
          toasts.push("Hot rod is out. Grill is coming up to temp.");
        }
        if (prev.status !== "at-temp" && next.status === "at-temp") {
          toasts.push(`Pit settled near ${Math.round(next.setpoint)}°.`);
        }
        if (!prev.probes[0].stalling && next.probes[0].stalling) {
          toasts.push(`${next.probes[0].name} is in the stall. Let it ride.`);
        }
        if (!prev.probes[0].hitAt && next.probes[0].hitAt) {
          toasts.push(`${next.probes[0].name} hit ${Math.round(next.probes[0].target ?? 0)}°.`);
        }
        if (!prev.probes[1].hitAt && next.probes[1].hitAt) {
          toasts.push(`${next.probes[1].name} hit ${Math.round(next.probes[1].target ?? 0)}°.`);
        }
        if (prev.hopperPct > 15 && next.hopperPct <= 15) {
          toasts.push("Hopper is getting low.");
        }
        if (prev.status !== "off" && next.status === "off") {
          toasts.push("Cool-down finished. Grill is on standby.");
        }

        const program = next.programId ? getProgram(next.programId) : null;
        if (program && next.stageIndex !== prev.stageIndex) {
          const stage = program.stages[next.stageIndex];
          if (stage) toasts.push(`Stage: ${stage.name}. ${stage.note}`);
        }

        set({ sim: next });
        return toasts;
      },
      setSetpoint: (tempF) =>
        set((s) => ({
          sim: {
            ...s.sim,
            setpoint: snapSetpoint(tempF),
            status:
              s.sim.status === "off" || s.sim.status === "cooling"
                ? s.sim.status
                : "heating",
          },
        })),
      nudgeSetpoint: (dir) =>
        set((s) => ({
          sim: {
            ...s.sim,
            setpoint: snapSetpoint(s.sim.setpoint + dir * 5),
            status:
              s.sim.status === "off" || s.sim.status === "cooling"
                ? s.sim.status
                : "heating",
          },
        })),
      setPSetting: (p) =>
        set((s) => ({
          sim: { ...s.sim, pSetting: Math.max(0, Math.min(7, Math.round(p))) },
        })),
      toggleLight: () =>
        set((s) => ({
          sim: { ...s.sim, lightOn: !s.sim.lightOn },
        })),
      openLid: () =>
        set((s) => ({
          sim: { ...s.sim, lidOpenUntil: Date.now() + 28_000 },
        })),
      prime: () =>
        set((s) => ({
          sim: {
            ...s.sim,
            primedUntil: Date.now() + 8_000,
            hopperPct: Math.max(0, s.sim.hopperPct - 0.8),
          },
        })),
      power: () => {
        const { sim } = get();
        const now = Date.now();
        if (sim.status === "off") {
          set({ sim: igniteGrill(sim, now) });
        } else if (sim.status === "cooling") {
          set({ sim: igniteGrill({ ...sim, status: "off" }, now) });
        } else {
          set({ dialog: { kind: "shutdown" } });
        }
      },
      confirmShutdown: () => {
        const now = Date.now();
        set((s) => ({
          sim: shutdownGrill(s.sim, now),
          dialog: null,
        }));
      },
      launchProgram: (programId) => {
        const program = getProgram(programId);
        if (!program) return;
        set((s) => ({
          sim: startProgram(s.sim, program, Date.now()),
          dialog: null,
          tab: "grill",
        }));
      },
      calibrate: ({ grill, p1, p2, hopper }) =>
        set((s) => ({
          sim: {
            ...s.sim,
            actual: grill,
            hopperPct: Math.max(0, Math.min(100, hopper)),
            probes: [
              { ...s.sim.probes[0], temp: p1 },
              { ...s.sim.probes[1], temp: p2 },
            ],
          },
          dialog: null,
        })),
      setGrillName: (grillName) =>
        set((s) => ({ settings: { ...s.settings, grillName } })),
      setGrillIp: (grillIp) =>
        set((s) => ({ settings: { ...s.settings, grillIp } })),
      setModelId: (modelId) =>
        set((s) => ({ settings: { ...s.settings, modelId } })),
      setUnits: (units) =>
        set((s) => ({ settings: { ...s.settings, units } })),
      setTimeWarp: (timeWarp) =>
        set((s) => ({ settings: { ...s.settings, timeWarp } })),
      completeCook: (notes, rating) => {
        const { sim } = get();
        const now = Date.now();
        const started = sim.cookStartedAt ?? now;
        const session: CookSession = {
          id: `cook-${now}`,
          programName: sim.programName ?? "Manual cook",
          startedAt: started,
          endedAt: now,
          setpoint: sim.setpoint,
          notes,
          rating,
          peakGrill: sim.peakGrill,
          peakP1: sim.probes[0].connected ? sim.peakP1 : null,
          peakP2: sim.probes[1].connected ? sim.peakP2 : null,
          durationSec: Math.max(60, Math.round((sim.elapsedSimMs || now - started) / 1000)),
          wood: sim.wood,
        };
        set((s) => ({
          sessions: [session, ...s.sessions],
          dialog: null,
          tab: "grill",
          sim: shutdownGrill(s.sim, now),
        }));
      },
      deleteSession: (id) =>
        set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
      setProbeTarget: (id, target) =>
        set((s) => ({
          sim: {
            ...s.sim,
            probes: s.sim.probes.map((p) =>
              p.id === id ? { ...p, target, hitAt: null } : p,
            ) as GrillSim["probes"],
          },
        })),
      toggleProbe: (id) =>
        set((s) => ({
          sim: {
            ...s.sim,
            probes: s.sim.probes.map((p) =>
              p.id === id ? { ...p, connected: !p.connected, stalling: false } : p,
            ) as GrillSim["probes"],
          },
        })),
    }),
    {
      name: "pitside-v3",
      skipHydration: true,
      partialize: (s) => ({
        settings: s.settings,
        sim: s.sim,
        sessions: s.sessions,
      }),
    },
  ),
);

export function modelOf(state: Pick<GrillStore, "settings">) {
  return getModel(state.settings.modelId);
}
