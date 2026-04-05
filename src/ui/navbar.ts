import { setIcon } from "obsidian";
import { Chat } from "../types/chat/Chat";

export type NavPanel = "none" | "chats" | "settings";

export interface NavbarCallbacks {
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onRenameChat: (id: string, name: string) => void;
  onDeleteChat: (id: string) => void;
  onPanelChange: (panel: NavPanel) => void;
}

export function renderNavbar(
  container: HTMLElement,
  activePanel: NavPanel,
  cb: Pick<NavbarCallbacks, "onNewChat" | "onPanelChange">
): void {
  container.empty();
  container.addClass("claude-navbar");

  const newBtn = container.createEl("button", {
    text: "New Chat",
    cls: "claude-nav-btn",
  });
  newBtn.onclick = () => cb.onNewChat();

  const chatsBtn = container.createEl("button", {
    text: "Chats",
    cls: "claude-nav-btn" + (activePanel === "chats" ? " active" : ""),
  });
  chatsBtn.onclick = () =>
    cb.onPanelChange(activePanel === "chats" ? "none" : "chats");

  const settingsBtn = container.createEl("button", {
    cls: "claude-nav-btn claude-nav-settings-btn" + (activePanel === "settings" ? " active" : ""),
    attr: { title: "Settings" },
  });
  setIcon(settingsBtn, "settings");
  settingsBtn.onclick = () =>
    cb.onPanelChange(activePanel === "settings" ? "none" : "settings");
}

export function renderChatsPanel(
  container: HTMLElement,
  chats: Chat[],
  activeChatId: string | null,
  cb: Pick<NavbarCallbacks, "onSelectChat" | "onRenameChat" | "onDeleteChat">
): void {
  container.empty();
  container.addClass("claude-panel");

  // Search
  const search = container.createEl("input", {
    cls: "claude-panel-search",
    attr: { placeholder: "Search chats...", type: "text" },
  });

  const list = container.createDiv("claude-panel-list");

  const renderList = (filter: string) => {
    list.empty();
    const filtered = [...chats]
      .reverse()
      .filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
      list.createDiv({ cls: "claude-panel-empty", text: "No chats found." });
      return;
    }

    for (const chat of filtered) {
      const isActive = chat.id === activeChatId;
      const item = list.createDiv(
        "claude-panel-item" + (isActive ? " active" : "")
      );

      const nameEl = item.createSpan({ cls: "claude-panel-item-name", text: chat.name });

      // Click to select
      nameEl.onclick = () => cb.onSelectChat(chat.id);

      // Double-click to rename inline
      nameEl.ondblclick = () => {
        const input = document.createElement("input");
        input.value = chat.name;
        input.className = "claude-panel-rename-input";
        nameEl.replaceWith(input);
        input.focus();
        input.select();
        const commit = () => {
          const val = input.value.trim();
          if (val && val !== chat.name) cb.onRenameChat(chat.id, val);
          else renderList(search.value);
        };
        input.onblur = commit;
        input.onkeydown = (e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") renderList(search.value);
        };
      };

      const actions = item.createDiv("claude-panel-item-actions");

      // Rename button
      const renameBtn = actions.createEl("button", {
        cls: "claude-panel-action-btn",
        text: "Rename",
      });
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        const input = document.createElement("input");
        input.value = chat.name;
        input.className = "claude-panel-rename-input";
        nameEl.replaceWith(input);
        input.focus();
        input.select();
        const commit = () => {
          const val = input.value.trim();
          if (val && val !== chat.name) cb.onRenameChat(chat.id, val);
          else renderList(search.value);
        };
        input.onblur = commit;
        input.onkeydown = (e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") renderList(search.value);
        };
      };

      // Delete button
      const delBtn = actions.createEl("button", {
        cls: "claude-panel-action-btn delete",
        text: "Delete",
      });
      delBtn.onclick = (e) => {
        e.stopPropagation();
        cb.onDeleteChat(chat.id);
      };
    }
  };

  search.oninput = () => renderList(search.value);
  renderList("");

  // Focus search on open
  setTimeout(() => search.focus(), 50);
}

export function renderSettingsPanel(
  container: HTMLElement,
  plugin: import("../main").default
): void {
  container.empty();
  container.addClass("claude-panel");

  const wrap = container.createDiv("claude-settings-wrap");
  wrap.createEl("h3", { text: "Settings", cls: "claude-settings-heading" });

  // API Key
  const apiRow = wrap.createDiv("claude-settings-row");
  apiRow.createEl("label", { text: "API Key", cls: "claude-settings-label" });
  const apiInput = apiRow.createEl("input", {
    cls: "claude-settings-input",
    attr: { type: "password", placeholder: "sk-ant-..." },
  });
  apiInput.value = plugin.settings.apiKey;
  apiInput.onchange = async () => {
    plugin.settings.apiKey = apiInput.value.trim();
    await plugin.saveSettings();
  };

  // Model
  const modelRow = wrap.createDiv("claude-settings-row");
  modelRow.createEl("label", { text: "Model", cls: "claude-settings-label" });
  const modelSelect = modelRow.createEl("select", { cls: "claude-settings-select" });
  const models: Record<string, string> = {
    "claude-sonnet-4-20250514": "Claude Sonnet 4 (recommended)",
    "claude-opus-4-20250514": "Claude Opus 4 (most capable)",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5 (fastest)",
  };
  for (const [val, label] of Object.entries(models)) {
    const opt = modelSelect.createEl("option", { text: label, value: val });
    if (val === plugin.settings.model) opt.selected = true;
  }
  modelSelect.onchange = async () => {
    plugin.settings.model = modelSelect.value;
    await plugin.saveSettings();
  };

  // Default context level
  const LEVELS = ["off", "low", "mid", "high"] as const;
  const STEPS = LEVELS.length - 1;
  const levelRow = wrap.createDiv("claude-settings-row");
  levelRow.createEl("label", { text: "Default Context Level", cls: "claude-settings-label" });
  const sliderWrap = levelRow.createDiv("claude-settings-slider-wrap");
  const track = sliderWrap.createDiv("claude-level-slider-track");
  const fill = track.createDiv("claude-level-slider-fill");
  const dotsEl = track.createDiv("claude-level-slider-dots");
  for (let i = 0; i <= STEPS; i++) {
    dotsEl.createEl("span", { cls: "claude-level-slider-dot", attr: { style: `left: ${(i / STEPS) * 100}%` } });
  }
  const thumb = track.createDiv("claude-level-slider-thumb");
  const sliderVal = sliderWrap.createEl("span", {
    cls: "claude-settings-slider-val",
    text: plugin.settings.defaultContextLevel[0].toUpperCase() + plugin.settings.defaultContextLevel.slice(1),
  });

  let curStep = LEVELS.indexOf(plugin.settings.defaultContextLevel);
  const THUMB_R = 10; // half of 20px thumb
  const update = () => {
    const pct = (curStep / STEPS) * 100;
    const offset = THUMB_R - pct * THUMB_R * 2 / 100;
    thumb.style.left = `calc(${pct}% + ${offset}px)`;
    fill.style.width = `calc(${pct}% + ${offset + THUMB_R}px)`;
    sliderVal.setText(LEVELS[curStep][0].toUpperCase() + LEVELS[curStep].slice(1));
  };
  update();

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
  wrap.createEl("p", {
    text: "Off = no context. Low = open tabs + @mentions. Mid = Low + linked files (max 30). High = Mid + 2nd-level links (max 50).",
    cls: "claude-settings-hint",
  });
}
