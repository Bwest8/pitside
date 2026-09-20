import { getProgram } from "./data";
import type { CookProgram, GrillSim, HistoryPoint, ProbeState } from "./types";

const AMBIENT = 68;
const HISTORY_EVERY_MS = 12_000;
const HISTORY_MAX = 360;

function approach(current: number, target: number, dt: number, tau: number): number {
  const k = 1 - Math.exp(-dt / Math.max(1, tau));
  return current + (target - current) * k;
}

function noise(now: number, amp: number): number {
  return Math.sin(now / 7300) * amp + Math.sin(now / 2100) * amp * 0.35;
}

function tickProbe(
  probe: ProbeState,
  grillTemp: number,
  dt: number,
  now: number,
): ProbeState {
  if (!probe.connected) return probe;
  const ceiling = grillTemp - 3;
  const goal = probe.target != null ? Math.min(probe.target + 4, ceiling) : ceiling;
  const inStall =
    probe.stallHigh > probe.stallLow &&
    probe.temp >= probe.stallLow &&
    probe.temp <= probe.stallHigh &&
    (probe.target == null || probe.temp < probe.target - 18);

  let temp = probe.temp;
  if (inStall) {
    temp += dt * (0.004 + probe.mass * 0.002);
  } else {
    const tau = 55 + probe.mass * 220;
    temp = approach(temp, goal, dt, tau);
  }
  temp = Math.min(temp, ceiling);
  temp = Math.max(32, temp);

  const hitAt =
    probe.target != null && temp >= probe.target && probe.hitAt == null
      ? now
      : probe.hitAt;

  return { ...probe, temp, stalling: inStall, hitAt };
}

export function tickSim(sim: GrillSim, dt: number, now: number): GrillSim {
  if (dt <= 0) return sim;

  let status = sim.status;
  let actual = sim.actual;
  let igniteUntil = sim.igniteUntil;
  const lidOpen = sim.lidOpenUntil != null && now < sim.lidOpenUntil;
  const primed = sim.primedUntil != null && now < sim.primedUntil;

  if (status === "off") {
    actual = approach(actual, AMBIENT + noise(now, 0.4), dt, 280);
  } else if (status === "cooling") {
    actual = approach(actual, AMBIENT, dt, 160);
    if (actual < 95) status = "off";
  } else if (status === "igniting") {
    actual = approach(actual, 175, dt, 70) + dt * 0.35;
    if (igniteUntil != null && now >= igniteUntil) {
      status = "heating";
      igniteUntil = null;
    }
  } else {
    const lidLoss = lidOpen ? 42 : 0;
    const pBias = (sim.pSetting - 4) * 1.6;
    const target = sim.setpoint - lidLoss - pBias;
    const tau = lidOpen ? 28 : 64;
    actual = approach(actual, target, dt, tau) + noise(now, lidOpen ? 2.4 : 1.1);
    if (primed) actual += dt * 0.8;
    const err = Math.abs(actual - sim.setpoint);
    status = !lidOpen && err < 9 ? "at-temp" : "heating";
  }

  actual = Math.max(AMBIENT - 4, Math.min(540, actual));

  let hopperPct = sim.hopperPct;
  if (status !== "off" && status !== "cooling") {
    const burn = (0.0045 + sim.setpoint / 90_000) * dt;
    hopperPct = Math.max(0, hopperPct - burn);
  }

  const probes: [ProbeState, ProbeState] = [
    tickProbe(sim.probes[0], actual, dt, now),
    tickProbe(sim.probes[1], actual, dt, now),
  ];

  let stageIndex = sim.stageIndex;
  let stageStartedAt = sim.stageStartedAt;
  let setpoint = sim.setpoint;
  let pSetting = sim.pSetting;
  let stageElapsedSimMs = (sim.stageElapsedSimMs ?? 0) + dt * 1000;
  const elapsedSimMs =
    sim.status === "off"
      ? (sim.elapsedSimMs ?? 0)
      : (sim.elapsedSimMs ?? 0) + dt * 1000;
  const program = sim.programId ? getProgram(sim.programId) : null;
  if (program && sim.status !== "off" && sim.status !== "cooling") {
    const stage = program.stages[stageIndex];
    if (stage && stage.durationMin > 0) {
      if (
        stageElapsedSimMs >= stage.durationMin * 60_000 &&
        stageIndex < program.stages.length - 1
      ) {
        stageIndex += 1;
        stageStartedAt = now;
        stageElapsedSimMs = 0;
        const next = program.stages[stageIndex];
        if (next) {
          setpoint = next.setpoint;
          pSetting = next.pSetting;
        }
      }
    }
  }

  const peakGrill = Math.max(sim.peakGrill, actual);
  const peakP1 = probes[0].connected ? Math.max(sim.peakP1, probes[0].temp) : sim.peakP1;
  const peakP2 = probes[1].connected ? Math.max(sim.peakP2, probes[1].temp) : sim.peakP2;

  let history = sim.history;
  const lastPoint = history[history.length - 1];
  if (!lastPoint || now - lastPoint.t >= HISTORY_EVERY_MS) {
    const point: HistoryPoint = {
      t: now,
      grill: actual,
      set: setpoint,
      p1: probes[0].connected ? probes[0].temp : null,
      p2: probes[1].connected ? probes[1].temp : null,
    };
    history = [...history, point].slice(-HISTORY_MAX);
  }

  return {
    ...sim,
    status,
    actual,
    setpoint,
    pSetting,
    hopperPct,
    igniteUntil,
    probes,
    history,
    lastTick: now,
    stageIndex,
    stageStartedAt,
    peakGrill,
    peakP1,
    peakP2,
    elapsedSimMs,
    stageElapsedSimMs,
    lidOpenUntil: lidOpen ? sim.lidOpenUntil : null,
    primedUntil: primed ? sim.primedUntil : null,
  };
}

export function startProgram(sim: GrillSim, program: CookProgram, now: number): GrillSim {
  const stage = program.stages[0];
  const fromOff = sim.status === "off" || sim.status === "cooling";
  const p1Start = fromOff ? 38 + Math.sin(now / 999) * 2 : sim.probes[0].temp;
  const p2Start = fromOff ? 36 + Math.cos(now / 777) * 2 : sim.probes[1].temp;

  return {
    ...sim,
    status: fromOff ? "igniting" : "heating",
    igniteUntil: fromOff ? now + 90_000 : null,
    setpoint: stage?.setpoint ?? program.setpoint,
    pSetting: stage?.pSetting ?? program.pSetting,
    cookStartedAt: now,
    programId: program.id,
    programName: program.name,
    wood: program.wood,
    stageIndex: 0,
    stageStartedAt: now,
    restUntil: null,
    elapsedSimMs: 0,
    stageElapsedSimMs: 0,
    peakGrill: fromOff ? AMBIENT : sim.actual,
    peakP1: p1Start,
    peakP2: p2Start,
    history: [
      {
        t: now,
        grill: fromOff ? sim.actual : sim.actual,
        set: stage?.setpoint ?? program.setpoint,
        p1: p1Start,
        p2: p2Start,
      },
    ],
    probes: [
      {
        id: 1,
        connected: true,
        name: program.probe1Name,
        temp: p1Start,
        target: program.probeTarget,
        stalling: false,
        mass: program.probeMass,
        stallLow: program.stallLow,
        stallHigh: program.stallHigh,
        hitAt: null,
      },
      {
        id: 2,
        connected: true,
        name: program.probe2Name,
        temp: p2Start,
        target: program.probeTarget,
        stalling: false,
        mass: Math.max(0.15, program.probeMass - 0.12),
        stallLow: program.stallLow,
        stallHigh: program.stallHigh,
        hitAt: null,
      },
    ],
  };
}

export function igniteGrill(sim: GrillSim, now: number): GrillSim {
  if (sim.status !== "off" && sim.status !== "cooling") return sim;
  return {
    ...sim,
    status: "igniting",
    igniteUntil: now + 90_000,
    cookStartedAt: sim.cookStartedAt ?? now,
    stageStartedAt: sim.stageStartedAt ?? now,
    restUntil: null,
  };
}

export function shutdownGrill(sim: GrillSim, now: number): GrillSim {
  if (sim.status === "off") return sim;
  return {
    ...sim,
    status: "cooling",
    igniteUntil: null,
    lightOn: false,
    lidOpenUntil: null,
    lastTick: now,
  };
}

export function seedMidCook(now: number): GrillSim {
  const started = now - 45 * 60 * 1000;
  const history: HistoryPoint[] = [];
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1);
    const t = started + u * (now - started);
    const grill = 190 + u * 33 + Math.sin(i / 4) * 4;
    history.push({
      t,
      grill,
      set: 225,
      p1: 68 + u * 42,
      p2: null,
    });
  }

  return {
    status: "at-temp",
    actual: 223.4,
    setpoint: 225,
    pSetting: 4,
    lightOn: false,
    lidOpenUntil: null,
    hopperPct: 72,
    igniteUntil: null,
    cookStartedAt: started,
    programId: null,
    programName: null,
    wood: "",
    stageIndex: 0,
    stageStartedAt: started,
    probes: [
      {
        id: 1,
        connected: true,
        name: "Probe 1",
        temp: 109.4,
        target: null,
        stalling: false,
        mass: 0.55,
        stallLow: 0,
        stallHigh: 0,
        hitAt: null,
      },
      {
        id: 2,
        connected: false,
        name: "Probe 2",
        temp: 68,
        target: null,
        stalling: false,
        mass: 0.55,
        stallLow: 0,
        stallHigh: 0,
        hitAt: null,
      },
    ],
    history,
    lastTick: now,
    primedUntil: null,
    peakGrill: 228,
    peakP1: 109.4,
    peakP2: 0,
    restUntil: null,
    elapsedSimMs: 45 * 60 * 1000,
    stageElapsedSimMs: 45 * 60 * 1000,
  };
}

export function seedSessions(now: number): import("./types").CookSession[] {
  return [
    {
      id: "s-ribs",
      programName: "Spare Ribs 3-2-1",
      startedAt: now - 2 * 86400_000,
      endedAt: now - 2 * 86400_000 + 6.1 * 3600_000,
      setpoint: 225,
      notes: "Cherry wood. Wrapped with butter and brown sugar. Kids asked for seconds.",
      rating: 5,
      peakGrill: 258,
      peakP1: 196,
      peakP2: 193,
      durationSec: 6.1 * 3600,
      wood: "Cherry + apple",
    },
    {
      id: "s-chicken",
      programName: "Spatchcock Chicken",
      startedAt: now - 5 * 86400_000,
      endedAt: now - 5 * 86400_000 + 78 * 60_000,
      setpoint: 375,
      notes: "Skin blistered. Pulled breast at 160, rested 15.",
      rating: 4,
      peakGrill: 382,
      peakP1: 161,
      peakP2: 176,
      durationSec: 78 * 60,
      wood: "Pecan",
    },
  ];
}
