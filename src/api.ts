import { requestUrl } from "obsidian";
import { Chat, ClaudePluginSettings, Message } from "./types";
import { DND_MODES } from "./constants";

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

  const res = await requestUrl({
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
    throw: false,
  });

  if (res.status !== 200) {
    const err = res.json;
    throw new Error(err?.error?.message ?? `API error ${res.status}`);
  }

  return res.json?.content?.[0]?.text ?? "(no response)";
}