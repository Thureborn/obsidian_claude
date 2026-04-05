import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE, STORAGE_KEY } from "../constants";
import { Chat } from "../types/chat/Chat";
import { DndMode } from "../types/chat/DndMode";
import { SageId } from "../types/sages/SageId";
import { SagesRun } from "../types/sages/SagesRun";
import { NavPanel, renderNavbar, renderChatsPanel, renderSettingsPanel } from "./navbar";
import { renderChatPanel } from "./chat-panel";
import { callClaude } from "../api/chat";
import { buildChatContext } from "../vault/context";
import {
  routePrompt, buildInitialRun, runWave1, runWave2, reRun,
} from "../api/sages";
import ClaudeDndPlugin from "../main";

export class ClaudeChatView extends ItemView {
  plugin: ClaudeDndPlugin;
  chats: Chat[] = [];
  activeChatId: string | null = null;
  loading = false;
  activePanel: NavPanel = "none";

  private elNavbar: HTMLElement;
  private elSubpanel: HTMLElement;
  private elChat: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: ClaudeDndPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Claude DnD Chat"; }
  getIcon() { return "message-square"; }

  async onOpen() {
    this.loadChats();
    this.buildLayout();
    this.refresh();
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  private buildLayout() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("claude-dnd-plugin");
    this.elNavbar   = containerEl.createDiv("claude-navbar-wrap");
    this.elSubpanel = containerEl.createDiv("claude-subpanel-wrap");
    this.elChat     = containerEl.createDiv("claude-chat-wrap");
  }

  private refresh() {
    this.renderNavbar();
    this.renderSubpanel();
    this.renderChat();
  }

  private renderNavbar() {
    renderNavbar(this.elNavbar, this.activePanel, {
      onNewChat: () => {
        this.createChat();
        this.activePanel = "none";
        this.refresh();
      },
      onPanelChange: (panel) => {
        this.activePanel = panel;
        this.renderNavbar();
        this.renderSubpanel();
        this.elChat.toggleClass("hidden", panel !== "none");
      },
    });
  }

  private renderSubpanel() {
    this.elSubpanel.empty();
    const visible = this.activePanel !== "none";
    this.elSubpanel.toggleClass("visible", visible);
    this.elChat.toggleClass("hidden", visible);

    if (this.activePanel === "chats") {
      renderChatsPanel(this.elSubpanel, this.chats, this.activeChatId, {
        onSelectChat: (id) => {
          this.activeChatId = id;
          this.activePanel = "none";
          this.renderNavbar();
          this.renderSubpanel();
          this.renderChat();
        },
        onRenameChat: (id, name) => {
          this.renameChat(id, name);
          this.renderSubpanel();
          if (id === this.activeChatId) this.renderChat();
        },
        onDeleteChat: (id) => {
          this.deleteChat(id);
          this.renderSubpanel();
          this.renderChat();
        },
      });
    } else if (this.activePanel === "settings") {
      renderSettingsPanel(this.elSubpanel, this.plugin);
    }
  }

  private renderChat() {
    const chat = this.getActiveChat();
    if (!chat) return;
    renderChatPanel(this.elChat, this.app, chat, this.loading, {
      onSend:            (text, auto) => this.handleSend(text, auto),
      onClear:           () => { chat.messages = []; this.saveChats(); this.renderChat(); },
      onModeChange:      (mode: DndMode) => { chat.mode = mode; this.saveChats(); this.renderChat(); },
      onRename:          (name) => { this.renameChat(chat.id, name); this.renderChat(); },
      onContextLevelChange: (level) => { chat.contextLevel = level; this.saveChats(); },
      onSagesContinue:   (idx, correction) => this.handleSagesContinue(idx, correction),
      onSagesReRun:      (idx, instruction, addSages) => this.handleSagesReRun(idx, instruction, addSages),
    });
  }

  // ── Chat management ───────────────────────────────────────────────────────

  private loadChats() {
    const raw = localStorage.getItem(STORAGE_KEY);
    this.chats = raw ? JSON.parse(raw) : [];
    if (this.chats.length === 0) this.createChat();
    else this.activeChatId = this.chats[this.chats.length - 1].id;
  }

  private saveChats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.chats));
  }

  private createChat(mode: DndMode = "general") {
    const chat: Chat = {
      id: Date.now().toString(),
      name: `Chat ${this.chats.length + 1}`,
      mode,
      messages: [],
      createdAt: Date.now(),
      contextLevel: this.plugin.settings.defaultContextLevel,
    };
    this.chats.push(chat);
    this.activeChatId = chat.id;
    this.saveChats();
    return chat;
  }

  private deleteChat(id: string) {
    this.chats = this.chats.filter((c) => c.id !== id);
    if (this.activeChatId === id) {
      this.activeChatId = this.chats[this.chats.length - 1]?.id ?? null;
      if (!this.activeChatId) this.createChat();
    }
    this.saveChats();
  }

  private renameChat(id: string, name: string) {
    const c = this.chats.find((c) => c.id === id);
    if (c) { c.name = name; this.saveChats(); }
  }

  private getActiveChat(): Chat | undefined {
    return this.chats.find((c) => c.id === this.activeChatId);
  }

  // ── Normal send ───────────────────────────────────────────────────────────

  private async handleSend(text: string, autoMode?: boolean) {
    const chat = this.getActiveChat();
    if (!chat || this.loading) return;

    if (chat.mode === "sages") {
      await this.handleSagesStart(chat, text, autoMode ?? false);
    } else {
      await this.handleNormalSend(chat, text);
    }
  }

  private async handleNormalSend(chat: Chat, text: string) {
    chat.messages.push({ role: "user", content: text });
    this.saveChats();
    this.loading = true;
    this.renderChat();

    try {
      const context = await buildChatContext(this.app, chat.mode, text, chat.contextLevel);
      const reply = await callClaude(chat, text, this.plugin.settings, context);
      chat.messages.push({ role: "assistant", content: reply });
    } catch (err) {
      new Notice(`Claude error: ${err.message}`);
      chat.messages.push({ role: "assistant", content: `Error: ${err.message}` });
    } finally {
      this.loading = false;
      this.saveChats();
      this.renderChat();
    }
  }

  // ── Sages orchestration ───────────────────────────────────────────────────

  private async handleSagesStart(chat: Chat, prompt: string, autoMode: boolean) {
    this.loading = true;

    // Push user message
    chat.messages.push({ role: "user", content: prompt });

    // Push a sages run message (will be updated in place)
    const runMsgIdx = chat.messages.length;
    const placeholderRun: SagesRun = {
      id: Date.now().toString(),
      prompt,
      autoMode,
      version: 1,
      status: "routing",
      synthesis: "",
      waves: [],
    };
    chat.messages.push({ role: "assistant", sagesRun: placeholderRun, content: "" });
    this.saveChats();
    this.renderChat();

    try {
      const routerResult = await routePrompt(this.app, prompt, this.plugin.settings);

      let run = buildInitialRun(prompt, autoMode, routerResult);
      chat.messages[runMsgIdx].sagesRun = run;
      this.saveChats();
      this.renderChat();

      const onProgress = (updated: SagesRun) => {
        chat.messages[runMsgIdx].sagesRun = updated;
        this.saveChats();
        this.renderChat();
      };

      run = await runWave1(this.app, run, chat.contextLevel, this.plugin.settings, onProgress);
      chat.messages[runMsgIdx].sagesRun = run;
      this.saveChats();

      if (autoMode) {
        run = await runWave2(this.app, run, chat.contextLevel, this.plugin.settings, onProgress);
        chat.messages[runMsgIdx].sagesRun = run;
        this.saveChats();
      }

    } catch (err) {
      new Notice(`Sages error: ${err.message}`);
      const run = chat.messages[runMsgIdx].sagesRun;
      if (run) run.status = "error";
    } finally {
      this.loading = false;
      this.saveChats();
      this.renderChat();
    }
  }

  private async handleSagesContinue(messageIndex: number, correction: string) {
    const chat = this.getActiveChat();
    if (!chat) return;

    const msg = chat.messages[messageIndex];
    if (!msg?.sagesRun) return;

    const run = msg.sagesRun;
    if (correction) run.waves[0].userCorrection = correction;

    this.loading = true;
    this.renderChat();

    try {
      const updated = await runWave2(this.app, run, chat.contextLevel, this.plugin.settings, (r) => {
        msg.sagesRun = r;
        this.saveChats();
        this.renderChat();
      });
      msg.sagesRun = updated;
    } catch (err) {
      new Notice(`Sages Wave 2 error: ${err.message}`);
      run.status = "error";
    } finally {
      this.loading = false;
      this.saveChats();
      this.renderChat();
    }
  }

  private async handleSagesReRun(
    messageIndex: number,
    instruction: string,
    addSages: SageId[]
  ) {
    const chat = this.getActiveChat();
    if (!chat) return;

    const msg = chat.messages[messageIndex];
    if (!msg?.sagesRun) return;

    this.loading = true;
    this.renderChat();

    try {
      const newRun = await reRun(this.app, msg.sagesRun, instruction, addSages, chat.contextLevel, this.plugin.settings, (r) => {
        msg.sagesRun = r;
        this.saveChats();
        this.renderChat();
      });
      msg.sagesRun = newRun;
    } catch (err) {
      new Notice(`Sages re-run error: ${err.message}`);
    } finally {
      this.loading = false;
      this.saveChats();
      this.renderChat();
    }
  }
}
