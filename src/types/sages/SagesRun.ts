import { SagesWave } from "./SagesWave";
import { SagesRunStatus } from "./SagesRunStatus";

export interface SagesRun {
  id: string;
  prompt: string;
  waves: SagesWave[];
  synthesis: string;
  status: SagesRunStatus;
  autoMode: boolean;
  version: number; // increments on re-run
}
