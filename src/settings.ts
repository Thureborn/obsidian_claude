import { App, PluginSettingTab, Setting } from "obsidian";
import { MODELS } from "./constants";
import ClaudeDndPlugin from "./main";

export class ClaudeSettingTab extends PluginSettingTab {
  plugin: ClaudeDndPlugin;

  constructor(app: App, plugin: ClaudeDndPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Claude DnD Chat Settings" });

    new Setting(containerEl)
      .setName("Anthropic API Key")
      .setDesc("Your API key from console.anthropic.com")
      .addText((t) =>
        t
          .setPlaceholder("sk-ant-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (v) => {
            this.plugin.settings.apiKey = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Claude model to use")
      .addDropdown((d) =>
        d
          .addOptions(MODELS)
          .setValue(this.plugin.settings.model)
          .onChange(async (v) => {
            this.plugin.settings.model = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max Vault Files")
      .setDesc("How many recent vault files to include as context (higher = more cost)")
      .addSlider((s) =>
        s
          .setLimits(1, 50, 1)
          .setValue(this.plugin.settings.maxVaultFiles)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.maxVaultFiles = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Always Include Active File")
      .setDesc("Always send the currently open note to Claude regardless of the file limit")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.includeActiveFile)
          .onChange(async (v) => {
            this.plugin.settings.includeActiveFile = v;
            await this.plugin.saveSettings();
          })
      );
  }
}