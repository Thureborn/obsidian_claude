import { App, TFile } from "obsidian";
import { ClaudePluginSettings, SageId } from "./types";

export type ContextMode = "full" | "minimal" | "none";

export interface SageContextRule {
  mode: ContextMode;
  folders: string[];       // sage-specific folders
  globalFolders: string[]; // always included on top (e.g. Players)
  minimalMax: number;      // max files per folder when mode is "minimal"
}

// ─── Sage context rules ───────────────────────────────────────────────────────

export const SAGE_CONTEXT_RULES: Record<SageId, SageContextRule> = {
  lore: {
    mode: "full",
    folders: ["Characters", "Factions", "Locations", "Sessions"],
    globalFolders: ["Players"],
    minimalMax: 5,
  },
  monster: {
    mode: "minimal",
    folders: ["Locations", "Factions"],
    globalFolders: ["Players"],
    minimalMax: 3,
  },
  npc: {
    mode: "full",
    folders: ["Characters", "Factions", "Locations"],
    globalFolders: ["Players"],
    minimalMax: 5,
  },
  encounter: {
    mode: "minimal",
    folders: ["Sessions"],
    globalFolders: ["Players"],
    minimalMax: 3,
  },
  item: {
    mode: "minimal",
    folders: ["Characters", "Factions"],
    globalFolders: ["Players"],
    minimalMax: 3,
  },
  rules: {
    mode: "none",
    folders: [],
    globalFolders: [],
    minimalMax: 0,
  },
};

export const ROUTER_CONTEXT_RULE: SageContextRule = {
  mode: "minimal",
  folders: ["Locations", "Sessions"],
  globalFolders: ["Players"],
  minimalMax: 2,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isInFolder(file: TFile, folderName: string): boolean {
  // Matches the folder at any depth: "Players/...", "Campaign/Players/..."
  const parts = file.path.split("/");
  return parts.some(
    (part) => part.toLowerCase() === folderName.toLowerCase()
  );
}

function isInAnyFolder(file: TFile, folders: string[]): boolean {
  return folders.some((f) => isInFolder(file, f));
}

async function readFiles(
  app: App,
  files: TFile[],
  label: string
): Promise<string> {
  const parts: string[] = [];
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    parts.push(`=== ${label}: ${file.path} ===\n${content}`);
  }
  return parts.join("\n\n---\n\n");
}

// ─── Main context builders ────────────────────────────────────────────────────

/**
 * Build context for a specific sage based on its context rules.
 */
export async function getSageContext(
  app: App,
  sageId: SageId,
  maxVaultFiles: number
): Promise<string> {
  const rule = SAGE_CONTEXT_RULES[sageId];
  return buildContext(app, rule, maxVaultFiles);
}

/**
 * Build context for the router pass.
 */
export async function getRouterContext(
  app: App,
  maxVaultFiles: number
): Promise<string> {
  const raw = await buildContext(app, ROUTER_CONTEXT_RULE, maxVaultFiles);
  // Truncate router context to keep routing calls cheap
  return raw.slice(0, 3000);
}

/**
 * Build context for a standard (non-sages) chat — uses all markdown files
 * sorted by recency, respects maxVaultFiles.
 */
export async function getVaultContext(
  app: App,
  settings: ClaudePluginSettings,
  maxVaultFiles: number
): Promise<string> {
  const files = app.vault.getMarkdownFiles();
  const activeFile = app.workspace.getActiveFile();

  const sorted = files
    .filter((f) => f !== activeFile)
    .sort((a, b) => b.stat.mtime - a.stat.mtime)
    .slice(0, maxVaultFiles);

  const parts: string[] = [];

  if (settings.includeActiveFile && activeFile) {
    const content = await app.vault.cachedRead(activeFile);
    parts.push(`=== CURRENTLY OPEN FILE: ${activeFile.path} ===\n${content}`);
  }

  for (const file of sorted) {
    const content = await app.vault.cachedRead(file);
    parts.push(`=== FILE: ${file.path} ===\n${content}`);
  }

  return parts.join("\n\n---\n\n");
}

// ─── Internal builder ─────────────────────────────────────────────────────────

async function buildContext(
  app: App,
  rule: SageContextRule,
  maxVaultFiles: number
): Promise<string> {
  if (rule.mode === "none") return "";

  const allFiles = app.vault.getMarkdownFiles()
    .sort((a, b) => b.stat.mtime - a.stat.mtime);

  const allFolders = [
    ...new Set([...rule.folders, ...rule.globalFolders]),
  ];

  // Separate global (Players) files from sage-specific files
  const globalFiles = allFiles.filter((f) =>
    isInAnyFolder(f, rule.globalFolders)
  );

  const sageFolderFiles = allFiles.filter(
    (f) =>
      isInAnyFolder(f, rule.folders) &&
      !isInAnyFolder(f, rule.globalFolders)
  );

  const parts: string[] = [];

  // Always include global folder files (Players), up to a reasonable cap
  const globalCap = Math.min(globalFiles.length, 10);
  if (globalFiles.length > 0) {
    const section = await readFiles(
      app,
      globalFiles.slice(0, globalCap),
      "PLAYER FILE"
    );
    parts.push(section);
  }

  if (rule.mode === "full") {
    // Include all sage-specific folder files up to maxVaultFiles
    const capped = sageFolderFiles.slice(0, maxVaultFiles);
    if (capped.length > 0) {
      const section = await readFiles(app, capped, "FILE");
      parts.push(section);
    }
  } else if (rule.mode === "minimal") {
    // Include up to minimalMax files per folder, most recent first
    for (const folder of rule.folders) {
      if (rule.globalFolders.includes(folder)) continue;
      const folderFiles = allFiles
        .filter((f) => isInFolder(f, folder))
        .slice(0, rule.minimalMax);
      if (folderFiles.length > 0) {
        const section = await readFiles(
          app,
          folderFiles,
          `${folder.toUpperCase()} FILE`
        );
        parts.push(section);
      }
    }
  }

  return parts.join("\n\n---\n\n");
}