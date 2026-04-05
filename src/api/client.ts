import { requestUrl } from "obsidian";
import { ClaudePluginSettings } from "../types/settings/ClaudePluginSettings";

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function claudeRequest(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  settings: ClaudePluginSettings,
  options?: {
    maxTokens?: number;
    onRetry?: (attempt: number, waitSecs: number) => void;
  }
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 4096;
  let attempt = 0;

  while (true) {
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
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
      throw: false,
    });

    if (res.status === 200) {
      return res.json?.content?.[0]?.text ?? "(no response)";
    }

    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Rate limited after ${MAX_RETRIES} retries. Try again in a minute.`);
      }

      const retryAfter = res.headers?.["retry-after"];
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : BASE_RETRY_DELAY_MS;

      options?.onRetry?.(attempt + 1, Math.round(waitMs / 1000));
      await sleep(waitMs);
      attempt++;
      continue;
    }

    const err = res.json;
    throw new Error(err?.error?.message ?? `API error ${res.status}`);
  }
}
