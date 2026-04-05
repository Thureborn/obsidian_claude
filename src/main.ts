import { Plugin } from "obsidian";
import { ClaudePluginSettings } from "./types/settings/ClaudePluginSettings";
import { DEFAULT_SETTINGS, VIEW_TYPE } from "./constants";
import { ClaudeChatView } from "./ui/view";
import { ClaudeSettingTab } from "./ui/settings-panel";

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
}
