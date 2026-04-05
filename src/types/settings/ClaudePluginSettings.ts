import { ContextLevel } from "../chat/ContextLevel";

export interface ClaudePluginSettings {
  apiKey: string;
  model: string;
  defaultContextLevel: ContextLevel;
}
