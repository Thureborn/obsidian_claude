import { App, PluginSettingTab, Setting } from "obsidian";
import { MODELS } from "../constants";
import ClaudeDndPlugin from "../main";

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

    const LEVELS = ["off", "low", "mid", "high"] as const;
    const STEPS = LEVELS.length - 1;
    const levelSetting = new Setting(containerEl)
      .setName("Default Context Level")
      .setDesc("Off = none. Low = open tabs + @mentions. Mid = Low + linked files (max 30). High = Mid + 2nd-level links (max 50).");

    const track = levelSetting.controlEl.createDiv("claude-level-slider-track");
    const fill = track.createDiv("claude-level-slider-fill");
    const dotsEl = track.createDiv("claude-level-slider-dots");
    for (let i = 0; i <= STEPS; i++) {
      dotsEl.createEl("span", { cls: "claude-level-slider-dot", attr: { style: `left: ${(i / STEPS) * 100}%` } });
    }
    const thumb = track.createDiv("claude-level-slider-thumb");
    const label = levelSetting.controlEl.createEl("span", {
      cls: "claude-settings-slider-val",
      text: this.plugin.settings.defaultContextLevel[0].toUpperCase() + this.plugin.settings.defaultContextLevel.slice(1),
    });

    let curStep = LEVELS.indexOf(this.plugin.settings.defaultContextLevel);
    const THUMB_R = 10; // half of 20px thumb
    const update = () => {
      const pct = (curStep / STEPS) * 100;
      const offset = THUMB_R - pct * THUMB_R * 2 / 100;
      thumb.style.left = `calc(${pct}% + ${offset}px)`;
      fill.style.width = `calc(${pct}% + ${offset + THUMB_R}px)`;
      label.setText(LEVELS[curStep][0].toUpperCase() + LEVELS[curStep].slice(1));
    };
    update();

    const plugin = this.plugin;
    const setStep = async (step: number) => {
      curStep = Math.max(0, Math.min(STEPS, step));
      update();
      plugin.settings.defaultContextLevel = LEVELS[curStep];
      await plugin.saveSettings();
    };

    track.onclick = (e) => {
      const rect = track.getBoundingClientRect();
      setStep(Math.round(((e.clientX - rect.left) / rect.width) * STEPS));
    };
    thumb.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const onMove = (ev: MouseEvent) => {
        const rect = track.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
        setStep(Math.round((x / rect.width) * STEPS));
      };
      const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };
  }
}
