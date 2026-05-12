const STORAGE_KEY = "pip-dsa-timer-state";

const state = {
  problems: [],
  sessionName: "",
  sessionMinutes: 90,
  isRunning: false,
  isEditing: false,
  remainingSeconds: 0,
  endTimestamp: null,
  lastSessionSummary: null,
  pipWindow: null,
  pipProblemListElement: null,
  pipTimerElement: null,
};

const elements = {
  form: document.getElementById("problemForm"),
  composerPanel: document.getElementById("composerPanel"),
  editSessionButton: document.getElementById("editSessionButton"),
  sessionNameInput: document.getElementById("sessionNameInput"),
  sessionTimeInput: document.getElementById("sessionTimeInput"),
  sessionRows: document.getElementById("sessionRows"),
  addRowButton: document.getElementById("addRowButton"),
  problemsList: document.getElementById("problemsList"),
  queueStats: document.getElementById("queueStats"),
  sessionSummaryText: document.getElementById("sessionSummaryText"),
  timerDisplay: document.getElementById("timerDisplay"),
  startButton: document.getElementById("startButton"),
  closeSessionButton: document.getElementById("closeSessionButton"),
  openPipButton: document.getElementById("openPipButton"),
  sessionSummaryModal: document.getElementById("sessionSummaryModal"),
  summarySessionName: document.getElementById("summarySessionName"),
  summaryElapsedTime: document.getElementById("summaryElapsedTime"),
  summaryPlannedTime: document.getElementById("summaryPlannedTime"),
  summaryStatusCounts: document.getElementById("summaryStatusCounts"),
  summaryProblemList: document.getElementById("summaryProblemList"),
  closeSummaryButton: document.getElementById("closeSummaryButton"),
  problemItemTemplate: document.getElementById("problemItemTemplate"),
  sessionProblemRowTemplate: document.getElementById("sessionProblemRowTemplate"),
};

let tickIntervalId = null;
let audioContext = null;
let lastRenderedProblemsSignature = "";
const DEFAULT_SESSION_ROWS = 1;
const DEFAULT_SESSION_MINUTES = 90;
const DEFAULT_PROBLEM_STATUS = "unsolved";

initialize();

function initialize() {
  hydrateState();
  state.isEditing = state.problems.length === 0;
  ensureSessionRows();
  syncSessionNameInput();
  syncSessionInput();
  bindEvents();
  if (state.problems.length > 0 && state.remainingSeconds <= 0) {
    syncRemainingToSession();
  }
  if (state.isRunning && state.endTimestamp) {
    const nextRemaining = Math.max(0, Math.ceil((state.endTimestamp - Date.now()) / 1000));
    state.remainingSeconds = nextRemaining;
    if (nextRemaining === 0) {
      finishTimer();
    } else {
      startTicking();
    }
  }
  render();
}

function bindEvents() {
  elements.form.addEventListener("submit", handleAddProblem);
  elements.addRowButton.addEventListener("click", () => addSessionRow());
  elements.editSessionButton.addEventListener("click", openSessionEditor);
  elements.startButton.addEventListener("click", handleStart);
  elements.closeSessionButton.addEventListener("click", clearAllProblems);
  elements.closeSummaryButton.addEventListener("click", closeSessionSummary);
  elements.openPipButton.addEventListener("click", openPipWindow);
  document.addEventListener("keydown", handleKeyboardShortcuts);
  window.addEventListener("beforeunload", persistState);
}

function hydrateState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const saved = JSON.parse(raw);
    state.problems = Array.isArray(saved.problems)
      ? saved.problems.map((problem) => ({
          ...problem,
          status: normalizeProblemStatus(problem.status),
        }))
      : [];
    state.sessionName = typeof saved.sessionName === "string" ? saved.sessionName : "";
    state.sessionMinutes = Number.isFinite(saved.sessionMinutes) ? saved.sessionMinutes : DEFAULT_SESSION_MINUTES;
    state.isRunning = Boolean(saved.isRunning);
    state.remainingSeconds = Number.isFinite(saved.remainingSeconds) ? saved.remainingSeconds : 0;
    state.endTimestamp = typeof saved.endTimestamp === "number" ? saved.endTimestamp : null;
  } catch (error) {
    console.error("Unable to restore state", error);
  }
}

function persistState() {
  const serializableState = {
    problems: state.problems,
    sessionName: state.sessionName,
    sessionMinutes: state.sessionMinutes,
    isRunning: state.isRunning,
    remainingSeconds: state.remainingSeconds,
    endTimestamp: state.endTimestamp,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState));
}

function handleAddProblem(event) {
  event.preventDefault();

  const sessionName = elements.sessionNameInput.value.trim();
  const sessionMinutes = Number(elements.sessionTimeInput.value);
  const rows = getSessionRowValues();
  const validProblems = rows.filter((row) => row.name);

  if (!Number.isFinite(sessionMinutes) || sessionMinutes < 1) {
    elements.sessionTimeInput.focus();
    return;
  }

  if (validProblems.length === 0) {
    focusFirstSessionNameInput();
    return;
  }

  handleStop();
  state.sessionName = sessionName;
  state.sessionMinutes = sessionMinutes;

  state.problems = validProblems.map((problemData) => ({
      id: crypto.randomUUID(),
      name: problemData.name,
      link: problemData.link,
      status: DEFAULT_PROBLEM_STATUS,
    }));
  state.isEditing = false;
  syncRemainingToSession();

  resetSessionRows();
  syncSessionNameInput();
  syncSessionInput();
  persistState();
  render();
}

function handleStart() {
  if (state.problems.length === 0) {
    return;
  }

  if (state.remainingSeconds <= 0) {
    syncRemainingToSession();
  }

  if (state.remainingSeconds <= 0 || state.isRunning) {
    return;
  }

  state.isRunning = true;
  state.endTimestamp = Date.now() + state.remainingSeconds * 1000;
  startTicking();
  persistState();
  render();
}

function handleStop() {
  if (!state.isRunning) {
    return;
  }

  state.isRunning = false;
  state.endTimestamp = null;
  stopTicking();
  persistState();
  render();
}

function handleReset() {
  state.isRunning = false;
  state.endTimestamp = null;
  stopTicking();
  syncRemainingToSession();
  persistState();
  render();
}

function handleKeyboardShortcuts(event) {
  if (event.target instanceof HTMLInputElement) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (!state.isRunning) {
      handleStart();
    }
  }

  if (event.key.toLowerCase() === "c") {
    clearAllProblems();
  }

  if (event.key.toLowerCase() === "n") {
    if (!state.isRunning && !state.isEditing && state.problems.length > 0) {
      openSessionEditor();
      return;
    }
    focusFirstSessionNameInput();
  }
}

function clearAllProblems() {
  if (state.problems.length === 0) {
    return;
  }

  state.lastSessionSummary = buildSessionSummary();
  handleStop();
  resetSessionState();
  render();
}

function resetSessionState() {
  state.problems = [];
  state.sessionName = "";
  state.sessionMinutes = DEFAULT_SESSION_MINUTES;
  state.isEditing = true;
  state.remainingSeconds = 0;
  state.endTimestamp = null;
  syncSessionNameInput();
  syncSessionInput();
  resetSessionRows();
  persistState();
}

function removeProblem(problemId) {
  state.problems = state.problems.filter((problem) => problem.id !== problemId);

  if (state.problems.length === 0) {
    handleStop();
    resetSessionState();
    render();
    return;
  }

  persistState();
  render();
}

function syncRemainingToSession() {
  state.remainingSeconds = state.problems.length > 0 ? state.sessionMinutes * 60 : 0;
}

function startTicking() {
  stopTicking();
  tickIntervalId = window.setInterval(() => {
    if (!state.endTimestamp) {
      return;
    }

    state.remainingSeconds = Math.max(0, Math.ceil((state.endTimestamp - Date.now()) / 1000));
    if (state.remainingSeconds === 0) {
      finishTimer();
      return;
    }

    persistState();
    render();
  }, 250);
}

function stopTicking() {
  if (tickIntervalId !== null) {
    window.clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
}

function finishTimer() {
  state.remainingSeconds = 0;
  state.isRunning = false;
  state.endTimestamp = null;
  stopTicking();
  playTimeUpSound();
  persistState();
  render();
}

function playTimeUpSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  audioContext = audioContext || new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.6);
}

function render() {
  const isFinished = !state.isRunning && state.remainingSeconds === 0 && state.problems.length > 0;
  const formattedTime = formatTime(state.remainingSeconds);
  const timerLabel = formatTimeLeft(state.remainingSeconds);
  const sessionLabel = getSessionLabel();
  const showComposer = !state.isRunning && (state.problems.length === 0 || state.isEditing);
  const problemsSignature = getProblemsRenderSignature();

  elements.composerPanel.classList.toggle("hidden", !showComposer);
  elements.editSessionButton.classList.toggle("hidden", state.problems.length === 0 || state.isEditing);
  elements.editSessionButton.disabled = state.isRunning;
  elements.timerDisplay.classList.toggle("is-finished", isFinished);
  elements.timerDisplay.textContent = timerLabel;

  elements.startButton.disabled = state.problems.length === 0 || state.isRunning;
  elements.closeSessionButton.disabled = state.problems.length === 0;
  elements.openPipButton.disabled = !supportsPip();
  elements.queueStats.textContent = `${state.problems.length} problem${state.problems.length === 1 ? "" : "s"} • ${state.sessionMinutes} min session`;
  elements.sessionSummaryText.textContent = `${sessionLabel} has ${state.problems.length === 1 ? "1 problem" : `${state.problems.length} problems`} with one shared timer.`;

  if (problemsSignature !== lastRenderedProblemsSignature) {
    renderProblems();
    lastRenderedProblemsSignature = problemsSignature;
  }
  renderSessionSummary();
  renderPip(timerLabel);
}

function renderProblems() {
  elements.problemsList.replaceChildren();

  if (state.problems.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent = "No problems yet. Add one to start a session.";
    elements.problemsList.append(emptyState);
    return;
  }

  for (const [index, problem] of state.problems.entries()) {
    const fragment = elements.problemItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".problem-item");
    const title = fragment.querySelector(".problem-title");
    const meta = fragment.querySelector(".problem-meta");
    const statusButtons = fragment.querySelectorAll(".problem-status-button");
    const link = fragment.querySelector(".problem-link");
    const removeButton = fragment.querySelector(".remove-button");
    const currentStatus = normalizeProblemStatus(problem.status);

    title.textContent = problem.name;
    meta.textContent = `Problem ${index + 1} of ${state.problems.length}`;
    for (const statusButton of statusButtons) {
      const nextStatus = statusButton.dataset.status;
      statusButton.classList.toggle("is-active", nextStatus === currentStatus);
      statusButton.setAttribute("aria-pressed", String(nextStatus === currentStatus));
      statusButton.addEventListener("click", () => updateProblemStatus(problem.id, nextStatus));
    }
    removeButton.disabled = state.isRunning;
    removeButton.addEventListener("click", () => removeProblem(problem.id));

    if (problem.link) {
      link.href = problem.link;
      link.classList.remove("hidden");
    }

    elements.problemsList.append(fragment);
  }
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTimeLeft(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const totalMinutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (safeSeconds === 0) {
    return "0m";
  }

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, "0")}m`;
  }

  if (totalMinutes > 0 && seconds === 0) {
    return `${totalMinutes}m`;
  }

  return `${totalMinutes}:${String(seconds).padStart(2, "0")}m`;
}

function supportsPip() {
  return "documentPictureInPicture" in window || "open" in window;
}

async function openPipWindow() {
  const initialTime = formatTimeLeft(state.remainingSeconds);

  if ("documentPictureInPicture" in window) {
    try {
      const pip = await window.documentPictureInPicture.requestWindow({ width: 280, height: 360 });
      state.pipWindow = pip;
      setupPipDocument(pip.document, initialTime);
      pip.addEventListener("pagehide", () => {
        state.pipWindow = null;
        state.pipProblemListElement = null;
        state.pipTimerElement = null;
      });
      return;
    } catch (error) {
      console.warn("Document Picture-in-Picture unavailable, falling back to popup window.", error);
    }
  }

  const popup = window.open("", "pip-dsa-timer", "width=280,height=360,resizable=yes,alwaysRaised=yes");
  if (!popup) {
    return;
  }
  state.pipWindow = popup;
  setupPipDocument(popup.document, initialTime);
  popup.addEventListener("beforeunload", () => {
    state.pipWindow = null;
    state.pipProblemListElement = null;
    state.pipTimerElement = null;
  });
}

function setupPipDocument(doc, formattedTime) {
  doc.body.innerHTML = "";
  doc.title = "Mirror OA";
  const style = doc.createElement("style");
  style.textContent = `
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Manrope", sans-serif;
      color: #101a33;
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 24%),
        linear-gradient(180deg, #ffffff 0%, #f7f9ff 100%);
    }
    .pip-shell {
      min-height: 100vh;
      padding: 10px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 10px;
      box-sizing: border-box;
    }
    .pip-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 16px;
      border: 1px solid #dbe4ff;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 20px 50px rgba(37, 99, 235, 0.08);
    }
    .pip-title {
      color: #2563eb;
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }
    .pip-session-meta {
      color: #65708c;
      font-size: 0.78rem;
    }
    .pip-timer {
      font-size: 1.45rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .pip-list {
      margin: 0;
      padding: 12px;
      list-style: none;
      border-radius: 16px;
      border: 1px solid #dbe4ff;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 20px 50px rgba(37, 99, 235, 0.08);
      overflow: auto;
    }
    .pip-list-item + .pip-list-item {
      margin-top: 8px;
    }
    .pip-problem-link,
    .pip-problem-text {
      display: block;
      padding: 8px 10px;
      border-radius: 12px;
      color: #101a33;
      text-decoration: none;
      background: #f8fbff;
      border: 1px solid transparent;
      font-size: 0.88rem;
      line-height: 1.35;
      word-break: break-word;
      font-weight: 700;
    }
    .pip-problem-link.is-active,
    .pip-problem-text.is-active {
      border-color: #cddcff;
      background: #eef4ff;
    }
    .pip-problem-link {
      color: #1d4ed8;
    }
    .pip-empty {
      color: #65708c;
      font-size: 0.84rem;
      text-align: center;
      padding: 8px;
    }
  `;
  doc.head.replaceChildren(style);

  const shell = doc.createElement("div");
  shell.className = "pip-shell";
  shell.innerHTML = `
    <div class="pip-header">
      <div>
        <div class="pip-title">${escapeHtml(getSessionLabel())}</div>
        <div class="pip-session-meta">${state.problems.length} problem${state.problems.length === 1 ? "" : "s"} • ${state.sessionMinutes} min</div>
      </div>
      <div class="pip-timer">${formattedTime}</div>
    </div>
    <ul class="pip-list"></ul>
  `;
  doc.body.append(shell);
  state.pipProblemListElement = shell.querySelector(".pip-list");
  state.pipTimerElement = shell.querySelector(".pip-timer");
  renderPipProblemList();
}

function renderPip(formattedTime) {
  if (!state.pipWindow || state.pipWindow.closed) {
    state.pipWindow = null;
    state.pipProblemListElement = null;
    state.pipTimerElement = null;
    return;
  }

  const titleNode = state.pipWindow.document.querySelector(".pip-title");
  if (titleNode) {
    titleNode.textContent = getSessionLabel();
  }
  const metaNode = state.pipWindow.document.querySelector(".pip-session-meta");
  if (metaNode) {
    metaNode.textContent = `${state.problems.length} problem${state.problems.length === 1 ? "" : "s"} • ${state.sessionMinutes} min`;
  }
  renderPipProblemList();
  if (state.pipTimerElement) {
    state.pipTimerElement.textContent = formattedTime;
    state.pipTimerElement.style.color = state.remainingSeconds === 0 && state.problems.length > 0 ? "#ff6b6b" : "#101a33";
  }
}

function renderPipProblemList() {
  if (!state.pipWindow || state.pipWindow.closed) {
    return;
  }

  const list = state.pipProblemListElement || state.pipWindow.document.querySelector(".pip-list");
  if (!list) {
    return;
  }

  state.pipProblemListElement = list;
  list.replaceChildren();

  if (state.problems.length === 0) {
    const emptyItem = state.pipWindow.document.createElement("li");
    emptyItem.className = "pip-empty";
    emptyItem.textContent = "No session problems yet.";
    list.append(emptyItem);
    return;
  }

  for (const [index, problem] of state.problems.entries()) {
    const item = state.pipWindow.document.createElement("li");
    item.className = "pip-list-item";

    const node = state.pipWindow.document.createElement(problem.link ? "a" : "div");
    node.className = problem.link ? "pip-problem-link" : "pip-problem-text";

    if (problem.link) {
      node.href = problem.link;
      node.target = "_blank";
      node.rel = "noreferrer";
    }

    node.textContent = `${index + 1}. ${problem.name}`;
    item.append(node);
    list.append(item);
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureSessionRows() {
  if (elements.sessionRows.children.length > 0) {
    return;
  }

  for (let index = 0; index < DEFAULT_SESSION_ROWS; index += 1) {
    addSessionRow();
  }
}

function addSessionRow(initialValues = {}) {
  const fragment = elements.sessionProblemRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".session-row");
  const rowTitle = fragment.querySelector(".session-row-title");
  const nameInput = fragment.querySelector(".session-problem-name");
  const linkInput = fragment.querySelector(".session-problem-link");
  const removeButton = fragment.querySelector(".remove-row-button");

  rowTitle.textContent = `Problem ${elements.sessionRows.children.length + 1}`;
  nameInput.value = initialValues.name ?? "";
  linkInput.value = initialValues.link ?? "";
  removeButton.addEventListener("click", () => {
    if (elements.sessionRows.children.length <= 1) {
      clearSessionRow(row);
      focusFirstSessionNameInput();
      return;
    }

    row.remove();
    renumberSessionRows();
  });

  elements.sessionRows.append(fragment);
}

function clearSessionRow(row) {
  row.querySelector(".session-problem-name").value = "";
  row.querySelector(".session-problem-link").value = "";
}

function renumberSessionRows() {
  Array.from(elements.sessionRows.children).forEach((row, index) => {
    const title = row.querySelector(".session-row-title");
    title.textContent = `Problem ${index + 1}`;
  });
}

function resetSessionRows() {
  elements.sessionRows.replaceChildren();
  ensureSessionRows();
  focusFirstSessionNameInput();
}

function populateSessionRows(problems) {
  elements.sessionRows.replaceChildren();

  if (problems.length === 0) {
    ensureSessionRows();
    focusFirstSessionNameInput();
    return;
  }

  for (const problem of problems) {
    addSessionRow({ name: problem.name, link: problem.link });
  }

  focusFirstSessionNameInput();
}

function openSessionEditor() {
  if (state.isRunning) {
    return;
  }

  state.isEditing = true;
  syncSessionNameInput();
  syncSessionInput();
  populateSessionRows(state.problems);
  render();
}

function focusFirstSessionNameInput() {
  const firstInput = elements.sessionRows.querySelector(".session-problem-name");
  firstInput?.focus();
}

function syncSessionNameInput() {
  elements.sessionNameInput.value = state.sessionName;
}

function syncSessionInput() {
  elements.sessionTimeInput.value = String(state.sessionMinutes || DEFAULT_SESSION_MINUTES);
}

function getSessionLabel() {
  return state.sessionName || "Untitled session";
}

function getSessionRowValues() {
  return Array.from(elements.sessionRows.children).map((row) => ({
    name: row.querySelector(".session-problem-name").value.trim(),
    link: row.querySelector(".session-problem-link").value.trim(),
  }));
}

function normalizeProblemStatus(status) {
  if (status === "solved" || status === "attempted") {
    return status;
  }

  return DEFAULT_PROBLEM_STATUS;
}

function getProblemsRenderSignature() {
  return JSON.stringify({
    isRunning: state.isRunning,
    problems: state.problems.map((problem) => ({
      id: problem.id,
      name: problem.name,
      link: problem.link,
      status: normalizeProblemStatus(problem.status),
    })),
  });
}

function buildSessionSummary() {
  const plannedSeconds = state.sessionMinutes * 60;
  const elapsedSeconds = Math.max(0, plannedSeconds - state.remainingSeconds);
  const problems = state.problems.map((problem) => ({
    name: problem.name,
    status: normalizeProblemStatus(problem.status),
  }));

  return {
    sessionName: getSessionLabel(),
    plannedSeconds,
    elapsedSeconds,
    counts: {
      solved: problems.filter((problem) => problem.status === "solved").length,
      attempted: problems.filter((problem) => problem.status === "attempted").length,
      unsolved: problems.filter((problem) => problem.status === "unsolved").length,
    },
    problems,
  };
}

function renderSessionSummary() {
  const summary = state.lastSessionSummary;
  const isVisible = Boolean(summary);
  elements.sessionSummaryModal.classList.toggle("hidden", !isVisible);

  if (!summary) {
    return;
  }

  elements.summarySessionName.textContent = `${summary.sessionName} is complete.`;
  elements.summaryElapsedTime.textContent = formatDuration(summary.elapsedSeconds);
  elements.summaryPlannedTime.textContent = formatDuration(summary.plannedSeconds);

  elements.summaryStatusCounts.replaceChildren(
    createSummaryCountPill("solved", summary.counts.solved),
    createSummaryCountPill("attempted", summary.counts.attempted),
    createSummaryCountPill("unsolved", summary.counts.unsolved),
  );

  elements.summaryProblemList.replaceChildren(
    ...summary.problems.map((problem) => createSummaryProblemItem(problem)),
  );
}

function createSummaryCountPill(status, value) {
  const pill = document.createElement("article");
  pill.className = "summary-count-pill";
  pill.dataset.status = status;

  const label = document.createElement("span");
  label.className = "summary-count-label";
  label.textContent = getStatusLabel(status);

  const count = document.createElement("strong");
  count.className = "summary-count-value";
  count.textContent = String(value);

  pill.append(label, count);
  return pill;
}

function createSummaryProblemItem(problem) {
  const item = document.createElement("li");
  item.className = "summary-problem-item";

  const name = document.createElement("span");
  name.className = "summary-problem-name";
  name.textContent = problem.name;

  const status = document.createElement("span");
  status.className = "summary-problem-status";
  status.dataset.status = problem.status;
  status.textContent = getStatusLabel(problem.status);

  item.append(name, status);
  return item;
}

function closeSessionSummary() {
  state.lastSessionSummary = null;
  render();
}

function getStatusLabel(status) {
  if (status === "solved") {
    return "Solved";
  }

  if (status === "attempted") {
    return "Attempted";
  }

  return "Unsolved";
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return formatTime(totalSeconds);
}

function updateProblemStatus(problemId, nextStatus) {
  const normalizedStatus = normalizeProblemStatus(nextStatus);
  const problem = state.problems.find((entry) => entry.id === problemId);

  if (!problem || problem.status === normalizedStatus) {
    return;
  }

  problem.status = normalizedStatus;
  persistState();
  render();
}