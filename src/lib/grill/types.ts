export type GrillStatus =
  | "off"
  | "igniting"
  | "heating"
  | "at-temp"
  | "cooling";

export type Units = "F" | "C";

export type TimeWarp = 1 | 10 | 60;

export type TabId = "grill" | "settings";

export type ProbeState = {
  id: 1 | 2;
  connected: boolean;
  name: string;
  temp: number;
  target: number | null;
  stalling: boolean;
  mass: number;
  stallLow: number;
  stallHigh: number;
  hitAt: number | null;
};

export type HistoryPoint = {
  t: number;
  grill: number;
  set: number;
  p1: number | null;
  p2: number | null;
};

export type CookStage = {
  name: string;
  durationMin: number;
  setpoint: number;
  pSetting: number;
  note: string;
  probeTarget?: number;
};

export type CookProgram = {
  id: string;
  name: string;
  cut: string;
  setpoint: number;
  pSetting: number;
  probeTarget: number | null;
  hours: string;
  wood: string;
  blurb: string;
  stages: CookStage[];
  probeMass: number;
  stallLow: number;
  stallHigh: number;
  probe2Name: string;
  probe1Name: string;
};

export type GrillModel = {
  id: string;
  name: string;
  series: string;
  area: string;
  hopperLb: number;
  probes: number;
  wifi: boolean;
};

export type CookSession = {
  id: string;
  programName: string;
  startedAt: number;
  endedAt: number;
  setpoint: number;
  notes: string;
  rating: number;
  peakGrill: number;
  peakP1: number | null;
  peakP2: number | null;
  durationSec: number;
  wood: string;
};

export type Settings = {
  grillName: string;
  modelId: string;
  units: Units;
  timeWarp: TimeWarp;
  grillIp: string;
};

export type GrillSim = {
  status: GrillStatus;
  actual: number;
  setpoint: number;
  pSetting: number;
  lightOn: boolean;
  lidOpenUntil: number | null;
  hopperPct: number;
  igniteUntil: number | null;
  cookStartedAt: number | null;
  programId: string | null;
  programName: string | null;
  wood: string;
  stageIndex: number;
  stageStartedAt: number | null;
  probes: [ProbeState, ProbeState];
  history: HistoryPoint[];
  lastTick: number;
  primedUntil: number | null;
  peakGrill: number;
  peakP1: number;
  peakP2: number;
  restUntil: number | null;
  elapsedSimMs: number;
  stageElapsedSimMs: number;
};

export type DialogMode =
  | null
  | { kind: "calibrate" }
  | { kind: "program"; programId: string }
  | { kind: "shutdown" }
  | { kind: "complete" };
