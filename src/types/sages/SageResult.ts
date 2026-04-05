import { SageId } from "./SageId";
import { SageStatus } from "./SageStatus";

export interface SageResult {
  sageId: SageId;
  status: SageStatus;
  output: string;
}
