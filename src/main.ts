import { Plugin } from "obsidian";
import { ClaudePluginSettings } from "./types";
import { DEFAULT_SETTINGS, VIEW_TYPE } from "./constants";
import { ClaudeChatView } from "./view";
import { ClaudeSettingTab } from "./settings";

export default class ClaudeDndPlugin extends Plugin {
  settings: ClaudePluginSettings;

  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE, (leaf) => new ClaudeChatView(leaf, this));
    this.addRibbonIcon("message-square", "Claude DnD Chat", () => this.activateView());
    this.addCommand({
      id: "open-claude-chat",
      name: "Open Claude DnD Chat",
      callback: () => this.activateView(),
    });
    this.addSettingTab(new ClaudeSettingTab(this.app, this));
    this.injectStyles();
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private injectStyles() {
    if (document.getElementById("claude-dnd-styles")) return;
    const style = document.createElement("style");
    style.id = "claude-dnd-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }
}

const CSS = `
.claude-dnd-plugin {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 13px;
  overflow: hidden;
}

/* ── Navbar ── */
.claude-navbar-wrap {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
}

.claude-nav-btn {
  padding: 4px 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.claude-nav-btn:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.claude-nav-btn.active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

/* ── Subpanel ── */
.claude-subpanel-wrap {
  display: none;
  flex-shrink: 0;
  max-height: 280px;
  overflow-y: auto;
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
}

.claude-subpanel-wrap.visible { display: block; }

.claude-panel { padding: 10px; }

/* Search */
.claude-panel-search {
  width: 100%;
  padding: 5px 8px;
  margin-bottom: 8px;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  color: var(--text-normal);
  font-size: 12px;
  box-sizing: border-box;
}

.claude-panel-search:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

.claude-panel-list { display: flex; flex-direction: column; gap: 2px; }

.claude-panel-empty {
  color: var(--text-muted);
  font-size: 12px;
  padding: 6px;
  text-align: center;
}

.claude-panel-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  gap: 6px;
}

.claude-panel-item:hover { background: var(--background-secondary-alt); }
.claude-panel-item.active { background: var(--background-modifier-active-hover); }

.claude-panel-item-name {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.claude-panel-rename-input {
  flex: 1;
  font-size: 12px;
  background: var(--background-primary);
  border: 1px solid var(--interactive-accent);
  border-radius: 2px;
  color: var(--text-normal);
  padding: 1px 4px;
}

.claude-panel-item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.1s;
  flex-shrink: 0;
}

.claude-panel-item:hover .claude-panel-item-actions { opacity: 1; }

.claude-panel-action-btn {
  background: none;
  border: 1px solid var(--background-modifier-border);
  border-radius: 3px;
  color: var(--text-muted);
  font-size: 10px;
  padding: 1px 6px;
  cursor: pointer;
}

.claude-panel-action-btn:hover { color: var(--text-normal); }
.claude-panel-action-btn.delete:hover { color: var(--text-error); border-color: var(--text-error); }

/* Settings panel */
.claude-settings-wrap { display: flex; flex-direction: column; gap: 10px; }

.claude-settings-heading {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
}

.claude-settings-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.claude-settings-label {
  width: 130px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.claude-settings-input,
.claude-settings-select {
  flex: 1;
  padding: 4px 7px;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  color: var(--text-normal);
  font-size: 12px;
}

.claude-settings-input:focus,
.claude-settings-select:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

.claude-settings-slider-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.claude-settings-slider { flex: 1; cursor: pointer; }
.claude-settings-slider-val { font-size: 12px; color: var(--text-muted); width: 24px; }

/* ── Chat area ── */
.claude-chat-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.claude-chat-wrap.hidden { display: none; }

.claude-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--background-modifier-border);
  flex-shrink: 0;
}

.claude-header-title {
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.claude-mode-select {
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  color: var(--text-normal);
  border-radius: 4px;
  padding: 3px 5px;
  font-size: 11px;
  cursor: pointer;
}

.claude-clear-btn {
  background: none;
  border: 1px solid var(--background-modifier-border);
  color: var(--text-muted);
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 11px;
}

.claude-clear-btn:hover { color: var(--text-error); border-color: var(--text-error); }

.claude-header-rename-input {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  background: var(--background-primary);
  border: 1px solid var(--interactive-accent);
  border-radius: 3px;
  color: var(--text-normal);
  padding: 1px 5px;
  min-width: 0;
}

.claude-vault-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.claude-vault-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.claude-vault-slider {
  width: 60px;
  cursor: pointer;
}

.claude-vault-val {
  font-size: 11px;
  color: var(--text-muted);
  width: 20px;
  text-align: right;
}

.claude-settings-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
  font-style: italic;
}

.claude-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.claude-message {
  max-width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  line-height: 1.5;
}

.claude-message-user {
  background: var(--background-secondary-alt);
  align-self: flex-end;
  max-width: 85%;
}

.claude-message-assistant {
  background: var(--background-secondary);
  border-left: 3px solid var(--interactive-accent);
}

.claude-message-role-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.claude-message-role {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.claude-copy-btn {
  background: none;
  border: 1px solid var(--background-modifier-border);
  color: var(--text-muted);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s;
}

.claude-message:hover .claude-copy-btn { opacity: 1; }
.claude-copy-btn:hover { color: var(--text-normal); border-color: var(--text-muted); }

.claude-message-body {
  color: var(--text-normal);
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.claude-thinking { color: var(--text-muted); font-style: italic; }

.claude-input-area {
  display: flex;
  gap: 6px;
  padding: 8px 10px 16px 10px;
  border-top: 1px solid var(--background-modifier-border);
  flex-shrink: 0;
}

.claude-input {
  flex: 1;
  resize: none;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  color: var(--text-normal);
  padding: 6px 8px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.4;
}

.claude-input:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

.claude-send-btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 13px;
  align-self: flex-end;
}

.claude-send-btn:hover { filter: brightness(1.1); }

.claude-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--background-modifier-border);
  flex-shrink: 0;
}

.claude-header-title {
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.claude-mode-select {
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  color: var(--text-normal);
  border-radius: 4px;
  padding: 3px 5px;
  font-size: 11px;
  cursor: pointer;
}

.claude-clear-btn {
  background: none;
  border: 1px solid var(--background-modifier-border);
  color: var(--text-muted);
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 11px;
}

.claude-clear-btn:hover { color: var(--text-error); border-color: var(--text-error); }

.claude-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.claude-message {
  max-width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  line-height: 1.5;
}

.claude-message-user {
  background: var(--background-secondary-alt);
  align-self: flex-end;
  max-width: 85%;
}

.claude-message-assistant {
  background: var(--background-secondary);
  border-left: 3px solid var(--interactive-accent);
}

.claude-message-role-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.claude-message-role {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.claude-copy-btn {
  background: none;
  border: 1px solid var(--background-modifier-border);
  color: var(--text-muted);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s;
}

.claude-message:hover .claude-copy-btn { opacity: 1; }
.claude-copy-btn:hover { color: var(--text-normal); border-color: var(--text-muted); }

.claude-message-body {
  color: var(--text-normal);
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.claude-thinking { color: var(--text-muted); font-style: italic; }

.claude-input-area {
  display: flex;
  gap: 6px;
  padding: 8px 10px 16px 10px;
  border-top: 1px solid var(--background-modifier-border);
  flex-shrink: 0;
}

.claude-input {
  flex: 1;
  resize: none;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  color: var(--text-normal);
  padding: 6px 8px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.4;
}

.claude-input:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

.claude-send-btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 13px;
  align-self: flex-end;
}

.claude-send-btn:hover { filter: brightness(1.1); }

.claude-input-btn-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: flex-end;
}

.claude-sages-auto-btn { background: var(--interactive-accent); color: var(--text-on-accent); }
.claude-sages-manual-btn {
  background: transparent;
  color: var(--interactive-accent);
  border: 1px solid var(--interactive-accent);
}
.claude-sages-manual-btn:hover { background: var(--interactive-accent-hover); color: var(--text-on-accent); }

/* ── Sages run ── */
.claude-message-sages {
  background: transparent;
  padding: 0;
  border: none;
}

.claude-sages-run {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.claude-sages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--background-secondary);
  border-radius: 6px;
  border-left: 3px solid var(--interactive-accent);
}

.claude-sages-title {
  font-weight: 600;
  font-size: 13px;
}

.claude-sages-status {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

/* Synthesis */
.claude-sages-synthesis {
  border: 1px solid var(--interactive-accent);
  border-radius: 6px;
  overflow: hidden;
}

.claude-sages-synthesis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--background-secondary);
  border-bottom: 1px solid var(--background-modifier-border);
}

.claude-sages-synthesis-title {
  font-weight: 600;
  font-size: 13px;
}

.claude-sages-copy-btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
}

.claude-sages-copy-btn:hover { filter: brightness(1.1); }

.claude-sages-synthesis-body {
  padding: 12px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
  max-height: 400px;
  overflow-y: auto;
  color: var(--text-normal);
}

/* Wave */
.claude-sages-wave {
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  overflow: hidden;
}

.claude-sages-wave-header {
  padding: 6px 10px;
  background: var(--background-secondary);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--background-modifier-border);
}

/* Sage entry */
.claude-sage-entry {
  border-bottom: 1px solid var(--background-modifier-border);
}

.claude-sage-entry:last-child { border-bottom: none; }

.claude-sage-entry-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
}

.claude-sage-entry-skipped .claude-sage-entry-head { opacity: 0.6; cursor: default; }

.claude-sage-toggle {
  background: none;
  border: none;
  font-size: 9px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  width: 12px;
}

.claude-sage-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
}

.claude-sage-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: capitalize;
}

.claude-sage-badge-pending  { background: var(--background-modifier-border); color: var(--text-muted); }
.claude-sage-badge-running  { background: #f0a500; color: #000; }
.claude-sage-badge-retrying { background: #c0392b; color: #fff; }
.claude-sage-badge-done     { background: #2d7d46; color: #fff; }
.claude-sage-badge-skipped  { background: var(--background-secondary-alt); color: var(--text-muted); }

.claude-sage-entry-body {
  padding: 8px 12px 10px 30px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-normal);
  user-select: text;
  -webkit-user-select: text;
  border-top: 1px solid var(--background-modifier-border);
}

.claude-sage-entry-body.hidden { display: none; }

/* Pause between waves */
.claude-sages-pause {
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.claude-sages-pause-label {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.claude-sages-pause-input {
  width: 100%;
  resize: none;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  color: var(--text-normal);
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.4;
  box-sizing: border-box;
}

.claude-sages-pause-input:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

.claude-sages-continue-btn {
  align-self: flex-end;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 5px 14px;
  font-size: 12px;
  cursor: pointer;
}

.claude-sages-continue-btn:hover { filter: brightness(1.1); }
.claude-sages-continue-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Re-run panel */
.claude-sages-rerun {
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.claude-sages-rerun-label {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.claude-sages-rerun-skipped {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.claude-sages-rerun-skip-label {
  font-size: 11px;
  color: var(--text-muted);
}

.claude-sage-add-btn {
  background: none;
  border: 1px solid var(--background-modifier-border);
  border-radius: 3px;
  color: var(--text-muted);
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
}

.claude-sage-add-btn.active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.claude-sages-rerun-btn {
  align-self: flex-end;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 5px 14px;
  font-size: 12px;
  cursor: pointer;
}

.claude-sages-rerun-btn:hover { filter: brightness(1.1); }
.claude-sages-rerun-btn:disabled { opacity: 0.6; cursor: not-allowed; }
`;