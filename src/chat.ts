import { Chat, DndMode, Message } from "./types";
import { DND_MODES } from "./constants";
import { renderSagesRun } from "./sagesView";

export interface ChatPanelCallbacks {
  onSend: (text: string, autoMode?: boolean) => Promise<void>;
  onClear: () => void;
  onModeChange: (mode: DndMode) => void;
  onRename: (name: string) => void;
  onVaultSizeChange: (n: number) => void;
  onSagesContinue: (messageIndex: number, correction: string) => void;
  onSagesReRun: (messageIndex: number, instruction: string, addSages: import("./types").SageId[]) => void;
}

export function renderChatPanel(
  container: HTMLElement,
  chat: Chat,
  loading: boolean,
  cb: ChatPanelCallbacks
): void {
  container.empty();

  // ── Header ──
  const header = container.createDiv("claude-header");

  const nameEl = header.createEl("span", {
    text: chat.name,
    cls: "claude-header-title",
    attr: { title: "Double-click to rename" },
  });

  nameEl.ondblclick = () => {
    const input = document.createElement("input");
    input.value = chat.name;
    input.className = "claude-header-rename-input";
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      const val = input.value.trim();
      if (val) cb.onRename(val);
    };
    input.onblur = commit;
    input.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = chat.name; input.blur(); }
    };
  };

  const modeSelect = header.createEl("select", { cls: "claude-mode-select" });
  for (const [key, val] of Object.entries(DND_MODES)) {
    const opt = modeSelect.createEl("option", { text: val.label, value: key });
    if (key === chat.mode) opt.selected = true;
  }
  modeSelect.onchange = () => cb.onModeChange(modeSelect.value as DndMode);

  const vaultWrap = header.createDiv("claude-vault-wrap");
  vaultWrap.createEl("span", { text: "Context:", cls: "claude-vault-label" });
  const vaultSlider = vaultWrap.createEl("input", {
    cls: "claude-vault-slider",
    attr: { type: "range", min: "1", max: "50", value: String(chat.maxVaultFiles) },
  });
  const vaultVal = vaultWrap.createEl("span", {
    text: String(chat.maxVaultFiles),
    cls: "claude-vault-val",
  });
  vaultSlider.oninput = () => {
    vaultVal.setText(vaultSlider.value);
    cb.onVaultSizeChange(Number(vaultSlider.value));
  };

  const clearBtn = header.createEl("button", { text: "Clear", cls: "claude-clear-btn" });
  clearBtn.onclick = () => cb.onClear();

  // ── Messages ──
  const msgContainer = container.createDiv("claude-messages");

  chat.messages.forEach((msg, idx) => {
    if (msg.sagesRun) {
      // Render sages session
      const wrap = msgContainer.createDiv("claude-message claude-message-sages");
      renderSagesRun(wrap, msg.sagesRun, {
        onContinueToWave2: (correction) => cb.onSagesContinue(idx, correction),
        onReRun: (instruction, addSages) => cb.onSagesReRun(idx, instruction, addSages),
      });
    } else {
      // Render normal message
      const el = msgContainer.createDiv(`claude-message claude-message-${msg.role}`);
      const roleRow = el.createDiv({ cls: "claude-message-role-row" });
      roleRow.createSpan({
        cls: "claude-message-role",
        text: msg.role === "user" ? "You" : "Claude",
      });

      const copyBtn = roleRow.createEl("button", { text: "Copy", cls: "claude-copy-btn" });
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(msg.content).then(() => {
          copyBtn.setText("Copied");
          setTimeout(() => copyBtn.setText("Copy"), 1500);
        });
      };

      const body = el.createDiv({ cls: "claude-message-body" });
      body.setText(msg.content);
    }
  });

  if (loading) {
    const el = msgContainer.createDiv("claude-message claude-message-assistant");
    el.createDiv({ cls: "claude-message-role-row" }).createSpan({
      cls: "claude-message-role", text: "Claude",
    });
    el.createDiv({ cls: "claude-message-body claude-thinking", text: "Thinking..." });
  }

  requestAnimationFrame(() => {
    msgContainer.scrollTop = msgContainer.scrollHeight;
  });

  // ── Input ──
  const inputArea = container.createDiv("claude-input-area");
  const textarea = inputArea.createEl("textarea", {
    cls: "claude-input",
    attr: { placeholder: chat.mode === "sages" ? "Describe your dungeon, location, or encounter..." : "Ask Claude about your world...", rows: "3" },
  });

  const btnRow = inputArea.createDiv("claude-input-btn-row");

  if (chat.mode === "sages") {
    const autoBtn = btnRow.createEl("button", { text: "Auto", cls: "claude-send-btn claude-sages-auto-btn" });
    autoBtn.onclick = async () => {
      const text = textarea.value.trim();
      if (!text || loading) return;
      textarea.value = "";
      await cb.onSend(text, true);
    };

    const manualBtn = btnRow.createEl("button", { text: "Manual", cls: "claude-send-btn claude-sages-manual-btn" });
    manualBtn.onclick = async () => {
      const text = textarea.value.trim();
      if (!text || loading) return;
      textarea.value = "";
      await cb.onSend(text, false);
    };
  } else {
    const sendBtn = btnRow.createEl("button", { text: "Send", cls: "claude-send-btn" });
    sendBtn.onclick = async () => {
      const text = textarea.value.trim();
      if (!text || loading) return;
      textarea.value = "";
      await cb.onSend(text);
    };

    textarea.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
    };
  }
}