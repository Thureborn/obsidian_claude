import { App } from "obsidian";
import { Chat } from "../types/chat/Chat";
import { DndMode } from "../types/chat/DndMode";
import type { ContextLevel } from "../types/chat/ContextLevel";
import { SageId } from "../types/sages/SageId";
import { DND_MODES } from "../constants";
import { getChatContextFiles, searchMentionTargets, getResolvableNames, AnnotatedFile } from "../vault/context";
import { renderSagesRun } from "./sages-panel";

export interface ChatPanelCallbacks {
  onSend: (text: string, autoMode?: boolean) => Promise<void>;
  onClear: () => void;
  onModeChange: (mode: DndMode) => void;
  onRename: (name: string) => void;
  onContextLevelChange: (level: ContextLevel) => void;
  onSagesContinue: (messageIndex: number, correction: string) => void;
  onSagesReRun: (messageIndex: number, instruction: string, addSages: SageId[]) => void;
}

export function renderChatPanel(
  container: HTMLElement,
  app: App,
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

  const inputRow = inputArea.createDiv("claude-input-row");

  const inputWrap = inputRow.createDiv("claude-input-wrap");
  const highlightDiv = inputWrap.createDiv("claude-input-highlight");
  const textarea = inputWrap.createEl("textarea", {
    cls: "claude-input",
    attr: { placeholder: chat.mode === "sages" ? "Describe your dungeon, location, or encounter..." : "Ask Claude about your world..." },
  });

  const bottomBar = inputArea.createDiv("claude-bottom-bar");
  const levelPickerWrap = bottomBar.createDiv("claude-level-picker-wrap");
  const contextStrip = bottomBar.createDiv("claude-context-strip");

  const LEVEL_LABELS: Record<ContextLevel, string> = { off: "Off", low: "Low", mid: "Mid", high: "High" };
  const LEVEL_DESCS: Record<ContextLevel, string> = {
    off:  "No vault context",
    low:  "Open tabs + @mentions",
    mid:  "Low + linked files (max 30)",
    high: "Mid + 2nd-level links (max 50)",
  };

  const triggerBtn = levelPickerWrap.createEl("button", {
    text: LEVEL_LABELS[chat.contextLevel],
    cls: "claude-level-trigger",
  });

  const CHIP_DEPTH_CLS: Record<AnnotatedFile["depth"], string> = {
    0: "claude-context-chip-direct",
    1: "claude-context-chip-link1",
    2: "claude-context-chip-link2",
  };

  let chipsExpanded = false;

  const renderContextChips = (message: string) => {
    contextStrip.empty();
    const files = getChatContextFiles(app, chat.mode, message, chat.contextLevel);
    if (files.length === 0) return;
    contextStrip.createSpan({ text: "Context:", cls: "claude-context-label" });
    const MAX_CHIPS = 6;
    const toShow = chipsExpanded ? files : files.slice(0, MAX_CHIPS);
    toShow.forEach(({ file, depth }) => {
      contextStrip.createSpan({
        text: file.basename,
        cls: `claude-context-chip ${CHIP_DEPTH_CLS[depth]}`,
        attr: { title: file.path },
      });
    });
    if (!chipsExpanded && files.length > MAX_CHIPS) {
      const moreBtn = contextStrip.createEl("span", {
        text: `+${files.length - MAX_CHIPS} more`,
        cls: "claude-context-more-btn",
        attr: { title: files.slice(MAX_CHIPS).map(({ file }) => file.basename).sort().join("\n") },
      });
      moreBtn.onclick = (e) => { e.stopPropagation(); chipsExpanded = true; renderContextChips(textarea.value); };
    } else if (chipsExpanded && files.length > MAX_CHIPS) {
      const lessBtn = contextStrip.createEl("span", {
        text: "show less",
        cls: "claude-context-more-btn",
      });
      lessBtn.onclick = (e) => { e.stopPropagation(); chipsExpanded = false; renderContextChips(textarea.value); };
    }
  };

  let popoverEl: HTMLElement | null = null;
  const closePopover = () => { popoverEl?.remove(); popoverEl = null; };

  const openPopover = () => {
    if (popoverEl) { closePopover(); return; }
    popoverEl = levelPickerWrap.createDiv("claude-level-popover");

    for (const level of ["off", "low", "mid", "high"] as ContextLevel[]) {
      const opt = popoverEl.createDiv({
        cls: "claude-level-option" + (chat.contextLevel === level ? " active" : ""),
      });
      opt.createSpan({ text: LEVEL_LABELS[level], cls: "claude-level-option-label" });
      opt.createSpan({ text: LEVEL_DESCS[level],  cls: "claude-level-option-desc" });
      opt.onclick = (e) => {
        e.stopPropagation();
        triggerBtn.setText(LEVEL_LABELS[level]);
        cb.onContextLevelChange(level);
        renderContextChips(textarea.value);
        closePopover();
      };
    }

    setTimeout(() => {
      const outsideClick = (e: MouseEvent) => {
        if (!levelPickerWrap.contains(e.target as Node)) {
          closePopover();
          document.removeEventListener("click", outsideClick);
        }
      };
      document.addEventListener("click", outsideClick);
    }, 0);
  };

  triggerBtn.onclick = (e) => { e.stopPropagation(); openPopover(); };

  // ── Highlight layer — colours resolved @[...] mentions ──
  const resolvable = getResolvableNames(app);

  const updateHighlight = (text: string) => {
    highlightDiv.empty();
    // Split on @[...] or @word (legacy), preserving delimiters
    const parts = text.split(/(@\[[^\]]*\]|@\S+)/g);
    for (const part of parts) {
      if (part.startsWith("@")) {
        let token: string;
        if (part.startsWith("@[")) {
          token = part.slice(2).replace(/\]$/, "").toLowerCase();
        } else {
          token = part.slice(1).toLowerCase();
        }
        const resolved = resolvable.has(token);
        highlightDiv.createSpan({
          text: part,
          cls: resolved ? "claude-mention-resolved" : "claude-mention-unresolved",
        });
      } else {
        highlightDiv.createSpan({ text: part });
      }
    }
    highlightDiv.createSpan({ text: "\u200b" });
  };

  // Keep scroll in sync so highlight stays aligned when textarea scrolls
  textarea.addEventListener("scroll", () => {
    highlightDiv.scrollTop = textarea.scrollTop;
  });

  // ── @ mention autocomplete ──
  const getMentionQuery = (text: string, cursorPos: number): string | null => {
    // Match @[partial (open bracket) or @word before cursor
    const match = text.slice(0, cursorPos).match(/@\[([^\]]*)$|@(\S*)$/);
    return match ? (match[1] ?? match[2]) : null;
  };

  const commitMention = (name: string) => {
    const pos = textarea.selectionStart;
    const replacement = `@[${name}]`;
    // Replace @[partial or @word immediately before cursor
    const before = textarea.value.slice(0, pos).replace(/@\[[^\]]*$|@\S*$/, replacement);
    const after = textarea.value.slice(pos);
    textarea.value = before + after;
    textarea.setSelectionRange(before.length, before.length);
    textarea.dispatchEvent(new Event("input"));
    textarea.focus();
  };

  let mentionPopover: HTMLElement | null = null;

  const closeMentionPopover = () => { mentionPopover?.remove(); mentionPopover = null; };

  const openMentionPopover = (query: string) => {
    closeMentionPopover();
    const results = searchMentionTargets(app, query);
    if (results.length === 0) return;
    mentionPopover = inputRow.createDiv("claude-mention-popover");
    for (const target of results) {
      const opt = mentionPopover.createDiv({ cls: "claude-mention-option" });
      if (target.kind === "folder") {
        opt.createSpan({ text: `📁 ${target.name}/`, cls: "claude-mention-option-name" });
        opt.createSpan({ text: `${target.fileCount} files`, cls: "claude-mention-option-path" });
        opt.onmousedown = (e) => {
          e.preventDefault();
          commitMention(target.name + "/");
          closeMentionPopover();
        };
      } else {
        opt.createSpan({ text: target.file.basename, cls: "claude-mention-option-name" });
        opt.createSpan({ text: target.file.path,     cls: "claude-mention-option-path" });
        opt.onmousedown = (e) => {
          e.preventDefault();
          commitMention(target.file.basename);
          closeMentionPopover();
        };
      }
    }
  };

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    updateHighlight(textarea.value);
    renderContextChips(textarea.value);
    const query = getMentionQuery(textarea.value, textarea.selectionStart);
    if (query !== null) openMentionPopover(query);
    else closeMentionPopover();
  });

  updateHighlight("");

  textarea.addEventListener("keydown", (e) => {
    if (mentionPopover && e.key === "Escape") { e.stopPropagation(); closeMentionPopover(); }
  });

  textarea.addEventListener("blur", () => {
    setTimeout(closeMentionPopover, 150);
  });

  renderContextChips("");

  const btnRow = inputRow.createDiv("claude-input-btn-row");

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
