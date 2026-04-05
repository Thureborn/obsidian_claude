import { DndMode } from "./DndMode";
import { Message } from "./Message";
import { ContextLevel } from "./ContextLevel";

export interface Chat {
  id: string;
  name: string;
  mode: DndMode;
  messages: Message[];
  createdAt: number;
  contextLevel: ContextLevel;
}
