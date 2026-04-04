import { SagesRun, SageId, SageResult } from "./types";
import { SAGE_LABELS, WAVE1_SAGES } from "./constants";

export interface SagesViewCallbacks {
  onContinueToWave2: (correction: string) => void;
  onReRun: (instruction: string, addSages: SageId[]) => void;
}

export function renderSagesRun(
  container: HTMLElement,
  run: SagesRun,
  cb: SagesViewCallbacks
): void {
  container.empty();
  container.addClass("claude-sages-run");

  const statusLabel: Record<SagesRun["status"], string> = {
    routing:           "Routing...",
    wave1:             "Wave 1 running...",
    paused_after_wave1: "Wave 1 complete",
    wave2:             "Wave 2 running...",
    synthesising:      "Synthesising...",
    done:              "Complete",
    error:             "Error",
  };

  // ── Run header ──
  const runHeader = container.createDiv("claude-sages-header");
  runHeader.createEl("span", {
    cls: "claude-sages-title",
    text: `Sages Council — Draft ${run.version}`,
  });
  runHeader.createEl("span", {
    cls: "claude-sages-status",
    text: statusLabel[run.status],
  });

  // ── Synthesis (shown first when done) ──
  if (run.status === "done" && run.synthesis) {
    const synthWrap = container.createDiv("claude-sages-synthesis");
    const synthHead = synthWrap.createDiv("claude-sages-synthesis-header");
    synthHead.createEl("span", { text: "Synthesis", cls: "claude-sages-synthesis-title" });

    const copyBtn = synthHead.createEl("button", {
      text: "Copy Markdown",
      cls: "claude-sages-copy-btn",
    });
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(run.synthesis).then(() => {
        copyBtn.setText("Copied!");
        setTimeout(() => copyBtn.setText("Copy Markdown"), 1500);
      });
    };

    const synthBody = synthWrap.createDiv("claude-sages-synthesis-body");
    synthBody.setText(run.synthesis);
  }

  // ── Waves ──
  for (const wave of run.waves) {
    const waveEl = container.createDiv("claude-sages-wave");
    const waveHead = waveEl.createDiv("claude-sages-wave-header");
    waveHead.createEl("span", { text: wave.label, cls: "claude-sages-wave-label" });

    for (const sage of wave.sages) {
      renderSageEntry(waveEl, sage);
    }
  }

  // ── Pause between waves ──
  if (run.status === "paused_after_wave1") {
    renderWavePause(container, cb);
  }

  // ── Re-run panel (shown when done) ──
  if (run.status === "done") {
    renderReRunPanel(container, run, cb);
  }
}

function renderSageEntry(container: HTMLElement, sage: SageResult): void {
  const el = container.createDiv("claude-sage-entry");
  el.addClass(`claude-sage-${sage.status}`);

  const head = el.createDiv("claude-sage-entry-head");
  const toggle = head.createEl("button", { cls: "claude-sage-toggle", text: "▶" });
  head.createEl("span", { text: SAGE_LABELS[sage.sageId], cls: "claude-sage-name" });

  const badge = head.createEl("span", {
    cls: `claude-sage-badge claude-sage-badge-${sage.status}`,
    text: sage.status === "running"
      ? "Running..."
      : sage.status === "retrying"
      ? "Retrying..."
      : sage.status,
  });

  const body = el.createDiv("claude-sage-entry-body");
  body.addClass("hidden");

  if (sage.status === "done" || sage.status === "skipped") {
    body.setText(sage.output);
    toggle.onclick = () => {
      const open = body.hasClass("hidden");
      body.toggleClass("hidden", !open);
      toggle.setText(open ? "▼" : "▶");
    };
  } else if (sage.status === "retrying") {
    // Show the retry message inline without needing to expand
    body.setText(sage.output);
    body.removeClass("hidden");
  }
}

function renderWavePause(
  container: HTMLElement,
  cb: SagesViewCallbacks
): void {
  const pause = container.createDiv("claude-sages-pause");
  pause.createEl("p", {
    text: "Wave 1 complete. Add any corrections or notes before Wave 2, or continue directly.",
    cls: "claude-sages-pause-label",
  });

  const textarea = pause.createEl("textarea", {
    cls: "claude-sages-pause-input",
    attr: { placeholder: "Optional: change monsters, add corrections, redirect focus...", rows: "3" },
  });

  const continueBtn = pause.createEl("button", {
    text: "Continue to Wave 2",
    cls: "claude-sages-continue-btn",
  });

  continueBtn.onclick = () => {
    continueBtn.disabled = true;
    continueBtn.setText("Running Wave 2...");
    cb.onContinueToWave2(textarea.value.trim());
  };
}

function renderReRunPanel(
  container: HTMLElement,
  run: SagesRun,
  cb: SagesViewCallbacks
): void {
  const panel = container.createDiv("claude-sages-rerun");
  panel.createEl("p", {
    text: "Re-run with changes or add skipped sages:",
    cls: "claude-sages-rerun-label",
  });

  const textarea = panel.createEl("textarea", {
    cls: "claude-sages-pause-input",
    attr: {
      placeholder: "Describe changes: swap monsters, adjust the trap, add the NPC sage...",
      rows: "3",
    },
  });

  // Skipped sage toggles
  const skipped = run.waves
    .flatMap((w) => w.sages)
    .filter((s) => s.status === "skipped");

  const addSages: Set<SageId> = new Set();

  if (skipped.length > 0) {
    const skipWrap = panel.createDiv("claude-sages-rerun-skipped");
    skipWrap.createEl("span", { text: "Add skipped sages:", cls: "claude-sages-rerun-skip-label" });

    for (const sage of skipped) {
      const btn = skipWrap.createEl("button", {
        text: SAGE_LABELS[sage.sageId],
        cls: "claude-sage-add-btn",
      });
      btn.onclick = () => {
        if (addSages.has(sage.sageId)) {
          addSages.delete(sage.sageId);
          btn.removeClass("active");
        } else {
          addSages.add(sage.sageId);
          btn.addClass("active");
        }
      };
    }
  }

  const reRunBtn = panel.createEl("button", {
    text: "Re-run",
    cls: "claude-sages-rerun-btn",
  });

  reRunBtn.onclick = () => {
    const instruction = textarea.value.trim();
    if (!instruction && addSages.size === 0) return;
    reRunBtn.disabled = true;
    reRunBtn.setText("Running...");
    cb.onReRun(instruction, Array.from(addSages));
  };
}