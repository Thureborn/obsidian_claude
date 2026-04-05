import { App } from "obsidian";
import { SageId } from "../types/sages/SageId";
import { SageResult } from "../types/sages/SageResult";
import { SagesRun } from "../types/sages/SagesRun";
import { SagesWave } from "../types/sages/SagesWave";
import type { ContextLevel } from "../types/chat/ContextLevel";
import { ClaudePluginSettings } from "../types/settings/ClaudePluginSettings";
import {
  WAVE1_SAGES, WAVE2_SAGES, SAGE_COUNCIL_PROMPTS, SAGE_LABELS,
} from "../constants";
import { buildSageContext, buildRouterContext } from "../vault/context";
import { claudeRequest } from "./client";

// ─── Router ───────────────────────────────────────────────────────────────────

const ROUTER_SYSTEM = `You are a routing assistant for a D&D dungeon master tool.
Given a user's prompt, decide which specialist advisors are relevant.
The advisors are:
  Wave 1 (world & content, no dependencies):
    - lore: world consistency, history, factions, cultural fit
    - monster: creatures present or needed, CR, ecology
    - npc: notable characters, motivations, connections
  Wave 2 (design, depends on Wave 1):
    - encounter: combat balance, CR budgets, trap mechanics, resource drain
    - item: treasure, magic items, loot fitting the location
    - rules: rules interactions, 2024 rule clarifications, edge cases

Respond with ONLY a JSON object in this exact format, no other text:
{
  "relevant": ["lore", "monster", "npc", "encounter", "item"],
  "skipped": ["rules"],
  "skipReasons": { "rules": "No complex rules interactions evident" }
}
Only include each sage in exactly one of "relevant" or "skipped".
Be conservative — only skip a sage if it clearly has nothing to contribute.`;

interface RouterResult {
  relevant: SageId[];
  skipped: SageId[];
  skipReasons: Record<string, string>;
}

export async function routePrompt(
  app: App,
  prompt: string,
  settings: ClaudePluginSettings
): Promise<RouterResult> {
  try {
    const context = await buildRouterContext(app, prompt);
    const userContent = context
      ? `${context}\n\nUser prompt:\n${prompt}`
      : `User prompt:\n${prompt}`;
    const raw = await claudeRequest(ROUTER_SYSTEM, [{ role: "user", content: userContent }], settings);
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as RouterResult;
  } catch {
    return {
      relevant: [...WAVE1_SAGES, ...WAVE2_SAGES],
      skipped: [],
      skipReasons: {},
    };
  }
}

// ─── Run a single sage ────────────────────────────────────────────────────────

const MAX_RETRIES = 5;

async function runSage(
  app: App,
  sage: SageResult,
  prompt: string,
  contextLevel: ContextLevel,
  wave1Context: string,
  userCorrection: string | null,
  settings: ClaudePluginSettings,
  onProgress: (sage: SageResult) => void
): Promise<void> {
  const isWave2 = WAVE2_SAGES.includes(sage.sageId);
  const sageContext = await buildSageContext(app, sage.sageId, prompt, contextLevel);

  const parts: string[] = [];
  if (sageContext) parts.push(`=== VAULT CONTEXT ===\n${sageContext}`);
  if (isWave2 && wave1Context) parts.push(`=== WAVE 1 ADVISOR OUTPUTS ===\n${wave1Context}`);
  if (userCorrection) parts.push(`=== USER CORRECTIONS / ADDITIONS ===\n${userCorrection}`);
  parts.push(`=== USER PROMPT ===\n${prompt}`);

  try {
    sage.output = await claudeRequest(
      SAGE_COUNCIL_PROMPTS[sage.sageId],
      [{ role: "user", content: parts.join("\n\n") }],
      settings,
      {
        onRetry: (attempt, waitSecs) => {
          sage.status = "retrying";
          sage.output = `Rate limited. Retrying in ${waitSecs}s (attempt ${attempt}/${MAX_RETRIES})...`;
          onProgress(sage);
        },
      }
    );
    sage.status = "done";
  } catch (e) {
    sage.output = `Error: ${e.message}`;
    sage.status = "done";
  }

  onProgress(sage);
}

// ─── Format Wave 1 context for Wave 2 ────────────────────────────────────────

function buildWave1Context(wave1: SagesWave): string {
  return wave1.sages
    .filter((s) => s.status === "done")
    .map((s) => `--- ${SAGE_LABELS[s.sageId]} ---\n${s.output}`)
    .join("\n\n");
}

// ─── Synthesis ────────────────────────────────────────────────────────────────

const SYNTHESIS_SYSTEM = `You are compiling a dungeon master's reference document from advisory inputs.
Write a complete, well-structured markdown document ready to be saved as an Obsidian note.
Use headers (##, ###), bullet points, and D&D 2024 stat block formatting where appropriate.
Do NOT refer to "advisors", "sages", "waves", or the review process.
Write as if this is the document itself — a DM reference, not a meta-analysis.
Be comprehensive but avoid padding. Every sentence should be useful to the DM.`;

export async function synthesise(
  prompt: string,
  waves: SagesWave[],
  userCorrection: string | null,
  settings: ClaudePluginSettings
): Promise<string> {
  const parts: string[] = [`# Original Request\n${prompt}`];

  for (const wave of waves) {
    const done = wave.sages.filter((s) => s.status === "done");
    if (done.length === 0) continue;
    parts.push(`## ${wave.label}`);
    for (const s of done) {
      parts.push(`### ${SAGE_LABELS[s.sageId]}\n${s.output}`);
    }
    if (wave.userCorrection) {
      parts.push(`### User Corrections After ${wave.label}\n${wave.userCorrection}`);
    }
  }

  if (userCorrection) parts.push(`## Final User Instructions\n${userCorrection}`);

  return claudeRequest(SYNTHESIS_SYSTEM, [{ role: "user", content: parts.join("\n\n") }], settings, { maxTokens: 8192 });
}

// ─── Build initial run ────────────────────────────────────────────────────────

export function buildInitialRun(
  prompt: string,
  autoMode: boolean,
  routerResult: RouterResult
): SagesRun {
  const makeWaveSages = (ids: SageId[]): SageResult[] =>
    ids.map((id) => ({
      sageId: id,
      status: routerResult.relevant.includes(id) ? "pending" : "skipped",
      output: routerResult.skipped.includes(id)
        ? (routerResult.skipReasons[id] ?? "Deemed not relevant for this prompt.")
        : "",
    }));

  return {
    id: Date.now().toString(),
    prompt,
    autoMode,
    version: 1,
    status: "wave1",
    synthesis: "",
    waves: [
      { waveId: 1, label: "Wave 1 — World & Content", sages: makeWaveSages(WAVE1_SAGES), userCorrection: null },
      { waveId: 2, label: "Wave 2 — Design",          sages: makeWaveSages(WAVE2_SAGES), userCorrection: null },
    ],
  };
}

// ─── Wave runners ─────────────────────────────────────────────────────────────

export async function runWave1(
  app: App,
  run: SagesRun,
  contextLevel: ContextLevel,
  settings: ClaudePluginSettings,
  onProgress: (run: SagesRun) => void
): Promise<SagesRun> {
  const wave = run.waves[0];
  const pending = wave.sages.filter((s) => s.status === "pending");

  // Run all Wave 1 sages in parallel — Promise.all waits for all before continuing
  await Promise.all(
    pending.map((sage) => {
      sage.status = "running";
      onProgress({ ...run });
      return runSage(app, sage, run.prompt, contextLevel, "", null, settings, () => {
        onProgress({ ...run });
      });
    })
  );

  // All Wave 1 sages done before we set status and return
  run.status = run.autoMode ? "wave2" : "paused_after_wave1";
  onProgress({ ...run });
  return run;
}

export async function runWave2(
  app: App,
  run: SagesRun,
  contextLevel: ContextLevel,
  settings: ClaudePluginSettings,
  onProgress: (run: SagesRun) => void
): Promise<SagesRun> {
  const wave1 = run.waves[0];
  const wave2 = run.waves[1];
  const wave1Context = buildWave1Context(wave1);
  const correction = wave1.userCorrection;
  const pending = wave2.sages.filter((s) => s.status === "pending");

  // Run all Wave 2 sages in parallel — all Wave 1 output is already available
  await Promise.all(
    pending.map((sage) => {
      sage.status = "running";
      onProgress({ ...run });
      return runSage(app, sage, run.prompt, contextLevel, wave1Context, correction, settings, () => {
        onProgress({ ...run });
      });
    })
  );

  // All Wave 2 sages done before synthesis fires
  run.status = "synthesising";
  onProgress({ ...run });
  run.synthesis = await synthesise(run.prompt, run.waves, null, settings);
  run.status = "done";
  onProgress({ ...run });
  return run;
}

// ─── Re-run ───────────────────────────────────────────────────────────────────

export async function reRun(
  app: App,
  previousRun: SagesRun,
  instruction: string,
  addSages: SageId[],
  contextLevel: ContextLevel,
  settings: ClaudePluginSettings,
  onProgress: (run: SagesRun) => void
): Promise<SagesRun> {
  const newRun: SagesRun = {
    id: Date.now().toString(),
    prompt: previousRun.prompt,
    autoMode: previousRun.autoMode,
    version: previousRun.version + 1,
    status: "wave1",
    synthesis: "",
    waves: previousRun.waves.map((w) => ({
      ...w,
      userCorrection: null,
      sages: w.sages.map((s) => ({
        ...s,
        status: addSages.includes(s.sageId) ? "pending" : s.status,
        output: addSages.includes(s.sageId) ? "" : s.output,
      })),
    })),
  };

  newRun.waves[0].userCorrection = instruction;

  // Re-run newly pending Wave 1 sages
  const wave1Pending = newRun.waves[0].sages.filter((s) => s.status === "pending");
  if (wave1Pending.length > 0) {
    await Promise.all(
      wave1Pending.map((sage) => {
        sage.status = "running";
        onProgress({ ...newRun });
        return runSage(app, sage, newRun.prompt, contextLevel, "", instruction, settings, () => {
          onProgress({ ...newRun });
        });
      })
    );
  }

  // Re-run newly pending Wave 2 sages with updated Wave 1 context
  const updatedWave1Context = buildWave1Context(newRun.waves[0]);
  const wave2Pending = newRun.waves[1].sages.filter((s) => s.status === "pending");

  if (wave2Pending.length > 0) {
    newRun.status = "wave2";
    onProgress({ ...newRun });
    await Promise.all(
      wave2Pending.map((sage) => {
        sage.status = "running";
        onProgress({ ...newRun });
        return runSage(app, sage, newRun.prompt, contextLevel, updatedWave1Context, instruction, settings, () => {
          onProgress({ ...newRun });
        });
      })
    );
  }

  // All waves done — synthesise
  newRun.status = "synthesising";
  onProgress({ ...newRun });
  newRun.synthesis = await synthesise(newRun.prompt, newRun.waves, instruction, settings);
  newRun.status = "done";
  onProgress({ ...newRun });
  return newRun;
}
