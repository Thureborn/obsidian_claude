import { WaveId } from "./WaveId";
import { SageResult } from "./SageResult";

export interface SagesWave {
  waveId: WaveId;
  label: string;
  sages: SageResult[];
  userCorrection: string | null; // set when user provides between-wave input
}
