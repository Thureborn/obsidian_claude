import { Chat } from "../types/chat/Chat";
import { Message } from "../types/chat/Message";
import { ClaudePluginSettings } from "../types/settings/ClaudePluginSettings";
import { DND_MODES } from "../constants";
import { claudeRequest } from "./client";

export async function callClaude(
  chat: Chat,
  userMessage: string,
  settings: ClaudePluginSettings,
  vaultContext: string
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error("No API key set. Go to Settings > Claude DnD Chat to add your key.");
  }

  const mode = DND_MODES[chat.mode];
  const systemPrompt = `${mode.system}

--- VAULT CONTEXT (your Obsidian notes) ---
${vaultContext || "No vault notes found."}
--- END VAULT CONTEXT ---`;

  const messages: Message[] = [
    ...chat.messages,
    { role: "user", content: userMessage },
  ];

  return claudeRequest(systemPrompt, messages, settings);
}
