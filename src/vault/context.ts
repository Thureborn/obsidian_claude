import { App, TFile } from "obsidian";
import { DndMode } from "../types/chat/DndMode";
import { ContextLevel } from "../types/chat/ContextLevel";
import { SageId } from "../types/sages/SageId";
import { CONTEXT_LEVEL_LINK_DEPTH, CONTEXT_LEVEL_MAX_FILES } from "../constants";

// ─── Exported types ───────────────────────────────────────────────────────────

export type MentionTarget =
  | { kind: "file";   file: TFile }
  | { kind: "folder"; name: string; fileCount: number };

/** A context file with how it was included: 0 = direct, 1 = 1st-level link, 2 = 2nd-level link */
export type AnnotatedFile = { file: TFile; depth: 0 | 1 | 2 };

// ─── Sage folder rules ────────────────────────────────────────────────────────

export const SAGE_CONTEXT_RULES: Record<SageId, string[]> = {
  lore:      ["Players", "Characters", "Factions", "Locations", "Sessions"],
  monster:   ["Players", "Locations", "Factions"],
  npc:       ["Players", "Characters", "Factions", "Locations"],
  encounter: ["Players", "Sessions"],
  item:      ["Players", "Characters", "Factions"],
  rules:     [],
};

// ─── Private helpers ──────────────────────────────────────────────────────────

function isInFolder(file: TFile, folderName: string): boolean {
  const parts = file.path.split("/");
  return parts.some(
    (part) => part.toLowerCase() === folderName.toLowerCase()
  );
}

function getOpenFiles(app: App): TFile[] {
  return app.workspace.getLeavesOfType("markdown")
    .map((leaf) => (leaf.view as any)?.file as TFile)
    .filter(Boolean);
}

function getAllFolderNames(app: App): string[] {
  const seen = new Set<string>();
  for (const file of app.vault.getMarkdownFiles()) {
    const parts = file.path.split("/").slice(0, -1);
    for (const part of parts) {
      if (part) seen.add(part);
    }
  }
  return [...seen].sort();
}

/**
 * Parses @[Token] patterns. Token can be a file basename or a folder name.
 * Also accepts legacy @word (no brackets) for single-word tokens.
 */
function parseMentionedFiles(app: App, message: string): TFile[] {
  const tokens = [...message.matchAll(/@\[([^\]]+)\]|@(\S+)/g)]
    .map((m) => (m[1] ?? m[2]).toLowerCase());
  if (tokens.length === 0) return [];

  const all = app.vault.getMarkdownFiles();
  return dedup(
    tokens.flatMap((token) => {
      if (token.endsWith("/")) {
        // Explicit folder syntax @[Name/] — folder only
        const folderName = token.slice(0, -1);
        return all.filter((f) => isInFolder(f, folderName));
      }
      // File first; fall back to folder if no file matches
      const fileMatches = all.filter((f) => f.basename.toLowerCase() === token);
      if (fileMatches.length > 0) return fileMatches;
      return all.filter((f) => isInFolder(f, token));
    })
  );
}

/**
 * Expands a seed file list by following Obsidian wikilinks up to `linkDepth`
 * layers. At each layer, candidates are sorted by how many current-frontier
 * files link to them (most-linked first), then added until `maxTotal` is
 * reached. The frontier for the next layer is only the newly added files.
 * Each result is tagged with the depth at which it was added (0 = seed).
 */
function expandByLinks(
  app: App,
  seedFiles: TFile[],
  linkDepth: number,
  maxTotal: number
): AnnotatedFile[] {
  const result: AnnotatedFile[] = seedFiles.map((f) => ({ file: f, depth: 0 }));
  if (linkDepth === 0 || seedFiles.length === 0) return result;

  const fileByPath = new Map<string, TFile>();
  for (const f of app.vault.getMarkdownFiles()) fileByPath.set(f.path, f);

  const included = new Set<string>(seedFiles.map((f) => f.path));
  let frontier = seedFiles;

  for (let d = 1; d <= linkDepth && result.length < maxTotal; d++) {
    // Count outbound links from each frontier file to not-yet-included files
    const linkCount = new Map<string, number>();
    for (const file of frontier) {
      const links = (app.metadataCache.resolvedLinks[file.path] as Record<string, number>) ?? {};
      for (const [targetPath, count] of Object.entries(links)) {
        if (!included.has(targetPath) && fileByPath.has(targetPath)) {
          linkCount.set(targetPath, (linkCount.get(targetPath) ?? 0) + count);
        }
      }
    }

    // Sort by link count descending, add until maxTotal
    const candidates = [...linkCount.entries()].sort((a, b) => b[1] - a[1]);
    const newlyAdded: TFile[] = [];
    for (const [path] of candidates) {
      if (result.length >= maxTotal) break;
      const file = fileByPath.get(path)!;
      included.add(path);
      result.push({ file, depth: d as 1 | 2 });
      newlyAdded.push(file);
    }

    frontier = newlyAdded;
    if (frontier.length === 0) break;
  }

  return result;
}

function getPresetFiles(app: App, folders: string[], perFolder: number): TFile[] {
  if (perFolder === 0 || folders.length === 0) return [];

  const seen = new Set<string>();
  const result: TFile[] = [];
  const allFiles = app.vault.getMarkdownFiles()
    .sort((a, b) => b.stat.mtime - a.stat.mtime);

  for (const folder of folders) {
    const folderFiles = allFiles
      .filter((f) => isInFolder(f, folder))
      .slice(0, perFolder);
    for (const file of folderFiles) {
      if (!seen.has(file.path)) {
        seen.add(file.path);
        result.push(file);
      }
    }
  }
  return result;
}

async function readFiles(app: App, files: TFile[]): Promise<string> {
  const parts: string[] = [];
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    parts.push(`=== FILE: ${file.path} ===\n${content}`);
  }
  return parts.join("\n\n---\n\n");
}

function dedup(files: TFile[]): TFile[] {
  const seen = new Set<string>();
  return files.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });
}

// ─── Autocomplete search ──────────────────────────────────────────────────────

/**
 * Returns folders and files matching `query` for the @[...] autocomplete.
 * Prefix matches appear before substring matches. Folders shown before files
 * when there's a query. Empty query returns 8 most-recent files only.
 */
export function searchMentionTargets(app: App, query: string, max = 8): MentionTarget[] {
  const allFiles = app.vault.getMarkdownFiles();

  if (!query) {
    return allFiles
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, max)
      .map((file) => ({ kind: "file", file }));
  }

  const lower = query.toLowerCase();
  const results: MentionTarget[] = [];

  // Folders — prefix first, then substring
  const folderNames = getAllFolderNames(app);
  const prefixFolders = folderNames.filter((n) => n.toLowerCase().startsWith(lower));
  const containsFolders = folderNames.filter((n) => !n.toLowerCase().startsWith(lower) && n.toLowerCase().includes(lower));
  for (const name of [...prefixFolders, ...containsFolders]) {
    results.push({ kind: "folder", name, fileCount: allFiles.filter((f) => isInFolder(f, name)).length });
  }

  // Files — prefix first, then substring
  const prefixFiles: TFile[] = [];
  const containsFiles: TFile[] = [];
  for (const f of allFiles) {
    const name = f.basename.toLowerCase();
    if (name.startsWith(lower)) prefixFiles.push(f);
    else if (name.includes(lower)) containsFiles.push(f);
  }
  for (const file of [...prefixFiles, ...containsFiles]) {
    results.push({ kind: "file", file });
  }

  return results.slice(0, max);
}

/**
 * Returns the set of all resolvable @[token] names (file basenames + folder
 * names), lower-cased. Used by the highlight layer.
 */
export function getResolvableNames(app: App): Set<string> {
  const names = new Set<string>();
  for (const f of app.vault.getMarkdownFiles()) {
    names.add(f.basename.toLowerCase());
  }
  for (const name of getAllFolderNames(app)) {
    // Folders are resolvable both as bare name (fallback) and with trailing slash (explicit)
    names.add(name.toLowerCase());
    names.add(name.toLowerCase() + "/");
  }
  return names;
}

// ─── Exported file-list helper (no content reading) ──────────────────────────

export function getChatContextFiles(
  app: App,
  _mode: DndMode,
  message: string,
  level: ContextLevel
): AnnotatedFile[] {
  if (level === "off") return [];
  const seed = dedup([...getOpenFiles(app), ...parseMentionedFiles(app, message)]);
  if (level === "low") return seed.map((f) => ({ file: f, depth: 0 }));
  return expandByLinks(app, seed, CONTEXT_LEVEL_LINK_DEPTH[level], CONTEXT_LEVEL_MAX_FILES[level]);
}

// ─── Exported context builders ────────────────────────────────────────────────

export async function buildChatContext(
  app: App,
  _mode: DndMode,
  message: string,
  level: ContextLevel
): Promise<string> {
  if (level === "off") return "";
  const seed = dedup([...getOpenFiles(app), ...parseMentionedFiles(app, message)]);
  if (level === "low") return readFiles(app, seed);
  const files = expandByLinks(app, seed, CONTEXT_LEVEL_LINK_DEPTH[level], CONTEXT_LEVEL_MAX_FILES[level]);
  return readFiles(app, files.map((a) => a.file));
}

export async function buildSageContext(
  app: App,
  sageId: SageId,
  message: string,
  level: ContextLevel
): Promise<string> {
  if (level === "off") return "";
  const folders = SAGE_CONTEXT_RULES[sageId];
  const open = getOpenFiles(app);
  const mentioned = parseMentionedFiles(app, message);
  // Always include up to 10 files per sage-relevant folder as a fixed seed
  const preset = folders.length > 0 ? getPresetFiles(app, folders, 10) : [];
  const seed = dedup([...open, ...mentioned, ...preset]);
  if (level === "low") return readFiles(app, seed);
  const files = expandByLinks(app, seed, CONTEXT_LEVEL_LINK_DEPTH[level], CONTEXT_LEVEL_MAX_FILES[level]);
  return readFiles(app, files.map((a) => a.file));
}

export async function buildRouterContext(
  app: App,
  message: string
): Promise<string> {
  const open = getOpenFiles(app);
  const mentioned = parseMentionedFiles(app, message);
  const files = dedup([...open, ...mentioned]);
  const raw = await readFiles(app, files);
  return raw.slice(0, 3000);
}
