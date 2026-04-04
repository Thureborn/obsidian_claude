export type DndMode =
  | "general"
  | "lore"
  | "item"
  | "monster"
  | "npc"
  | "encounter"
  | "rules"
  | "sages";

export type SageId = "lore" | "monster" | "npc" | "item" | "encounter" | "rules";

export type SageStatus = "pending" | "running" | "retrying" | "done" | "skipped";

export interface SageResult {
  sageId: SageId;
  status: SageStatus;
  output: string;
}

export type WaveId = 1 | 2;

export interface SagesWave {
  waveId: WaveId;
  label: string;
  sages: SageResult[];
  userCorrection: string | null; // set when user provides between-wave input
}

export type SagesRunStatus =
  | "routing"
  | "wave1"
  | "paused_after_wave1"
  | "wave2"
  | "synthesising"
  | "done"
  | "error";

export interface SagesRun {
  id: string;
  prompt: string;
  waves: SagesWave[];
  synthesis: string;
  status: SagesRunStatus;
  autoMode: boolean;
  version: number; // increments on re-run
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  sagesRun?: SagesRun; // present when this message is a sages session
}

export interface Chat {
  id: string;
  name: string;
  mode: DndMode;
  messages: Message[];
  createdAt: number;
  maxVaultFiles: number;
}

export interface ClaudePluginSettings {
  apiKey: string;
  model: string;
  maxVaultFiles: number;
  includeActiveFile: boolean;
}