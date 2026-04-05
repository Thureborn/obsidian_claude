import { SagesRun } from "../sages/SagesRun";

export interface Message {
  role: "user" | "assistant";
  content: string;
  sagesRun?: SagesRun; // present when this message is a sages session
}
