import { authClient } from "./auth-client.js";

const messagesEl = document.getElementById("messages");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const chatBarEl = document.getElementById("chat-bar");
const AGENT_TYPING_ID = "agent-typing-indicator";
const AGENT_STREAMING_ID = "agent-streaming-message";
const AGENT_PHASE_LABELS = {
  planning: "Planning changes…",
  applying: "Applying patches…",
  building: "Running build…",
};
const chatToggleEl = document.getElementById("chat-toggle");
const profileToggleEl = document.getElementById("profile-toggle");
const profileAvatarEl = document.getElementById("profile-avatar");
const profileDropdownEl = document.getElementById("profile-dropdown");
const profileNameEl = document.getElementById("profile-name");
const profileEmailEl = document.getElementById("profile-email");
const signOutEl = document.getElementById("sign-out");
const projectPanelEl = document.getElementById("project-panel");
const projectStatusEl = document.getElementById("project-status");
const projectCreateEl = document.getElementById("project-create");
const projectListEl = document.getElementById("project-list");
const projectDetailsEl = document.getElementById("project-details");
const projectNameEl = document.getElementById("project-name");
const projectSandboxStatusEl = document.getElementById("project-sandbox-status");
const fileTreeEl = document.getElementById("file-tree");

let currentProject = null;
let statusPollTimer = null;
const projectToggleEl = document.getElementById("project-toggle");
const projectCloseEl = document.getElementById("project-close");
const projectNameDialogEl = document.getElementById("project-name-dialog");
const projectNameInputEl = document.getElementById("project-name-input");
const projectNameSubmitEl = document.getElementById("project-name-submit");
const projectNameCancelEl = document.getElementById("project-name-cancel");
const previewCanvasEl = document.querySelector(".preview-canvas");
const previewIframeEl = document.getElementById("preview-iframe");
const previewBackBtn = document.getElementById("preview-back");
const previewForwardBtn = document.getElementById("preview-forward");
const previewRefreshBtn = document.getElementById("preview-refresh");
const previewUrlEl = document.getElementById("preview-url");

function isChatExpanded() {
  return chatBarEl?.classList.contains("expanded") ?? false;
}

function setChatExpanded(open) {
  if (!chatBarEl) return;

  chatBarEl.classList.toggle("expanded", open);
  chatToggleEl?.setAttribute("aria-expanded", String(open));
}

function toggleChatExpanded() {
  setChatExpanded(!isChatExpanded());
}

function expandChatBarOnSend() {
  setChatExpanded(true);
}

function collapseChatOnPreviewInteraction(event) {
  if (!isChatExpanded()) return;
  if (event.target.closest("#chat-bar")) return;

  setChatExpanded(false);
}

function updateChatToggleVisibility() {
  if (!chatToggleEl || !messagesEl) return;

  const hasMessages = messagesEl.children.length > 0;
  chatToggleEl.hidden = !hasMessages;

  if (!hasMessages && isChatExpanded()) {
    setChatExpanded(false);
  }
}

function appendOptimisticUserMessage(content) {
  if (!messagesEl) return;

  const msg = document.createElement("div");
  msg.className = "msg user";
  msg.textContent = content;
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  updateChatToggleVisibility();
}

function showAgentTypingIndicator() {
  if (!messagesEl) return;

  hideAgentTypingIndicator();

  const indicator = document.createElement("div");
  indicator.id = AGENT_TYPING_ID;
  indicator.className = "msg assistant typing-indicator";
  indicator.setAttribute("role", "status");
  indicator.innerHTML = `<span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span><span class="visually-hidden">Assistant is thinking</span>`;
  messagesEl.appendChild(indicator);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  updateChatToggleVisibility();
}

function hideAgentTypingIndicator() {
  document.getElementById(AGENT_TYPING_ID)?.remove();
}

function updateAgentPhaseLabel(phase) {
  const label = AGENT_PHASE_LABELS[phase];
  if (!label) return;

  const indicator = document.getElementById(AGENT_TYPING_ID);
  const hiddenLabel = indicator?.querySelector(".visually-hidden");
  if (hiddenLabel) hiddenLabel.textContent = label;
}

function ensureStreamingMessage() {
  if (!messagesEl) return null;

  let streamingEl = document.getElementById(AGENT_STREAMING_ID);
  if (streamingEl) return streamingEl;

  hideAgentTypingIndicator();

  streamingEl = document.createElement("div");
  streamingEl.id = AGENT_STREAMING_ID;
  streamingEl.className = "msg assistant streaming-message";
  streamingEl.setAttribute("role", "status");
  streamingEl.textContent = "";
  messagesEl.appendChild(streamingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  updateChatToggleVisibility();
  return streamingEl;
}

function appendStreamingToken(delta) {
  const streamingEl = ensureStreamingMessage();
  if (!streamingEl) return;

  streamingEl.textContent += delta;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function finalizeStreamingMessage(content, { isError = false } = {}) {
  const streamingEl = document.getElementById(AGENT_STREAMING_ID);
  if (!streamingEl) {
    appendAssistantMessage(content, { isError });
    return;
  }

  streamingEl.id = "";
  streamingEl.classList.remove("streaming-message");
  if (isError) {
    streamingEl.classList.add("error");
  }
  streamingEl.textContent = content;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendAssistantMessage(content, { isError = false } = {}) {
  if (!messagesEl) return;

  const msg = document.createElement("div");
  msg.className = isError ? "msg assistant error" : "msg assistant";
  msg.textContent = content;
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  updateChatToggleVisibility();
}

function removeStreamingMessage() {
  document.getElementById(AGENT_STREAMING_ID)?.remove();
}

function setAgentTurnInFlight(inFlight) {
  const sendIcon = sendBtn?.querySelector(".prompt-send-icon");

  if (inFlight) {
    sendBtn.disabled = true;
    sendBtn.setAttribute("aria-busy", "true");
    if (sendIcon) sendIcon.textContent = "…";
    promptEl.disabled = true;
    chatBarEl?.classList.add("is-agent-loading");
    showAgentTypingIndicator();
    return;
  }

  sendBtn.disabled = false;
  sendBtn.removeAttribute("aria-busy");
  if (sendIcon) sendIcon.textContent = "→";
  promptEl.disabled = false;
  chatBarEl?.classList.remove("is-agent-loading");
  hideAgentTypingIndicator();
}

function setProjectPanelOpen(open) {
  if (!projectPanelEl || !projectToggleEl) return;

  projectPanelEl.hidden = !open;
  projectToggleEl.setAttribute("aria-expanded", String(open));
  projectToggleEl.textContent = open ? "Hide project" : "Project";
}

projectToggleEl?.addEventListener("click", () => {
  const isOpen = projectToggleEl.getAttribute("aria-expanded") === "true";
  setProjectPanelOpen(!isOpen);
});

projectCloseEl?.addEventListener("click", () => {
  setProjectPanelOpen(false);
});

const PREVIEW_NAV_MESSAGE = "endian:preview-navigation";

const previewNav = {
  urls: [],
  index: 0,
  pending: null,
  skipNextLoad: false,
  initialLoad: true,
  historyBlocked: false,
};

function previewUrlsMatch(a, b) {
  if (!a || !b) return false;

  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a === b;
  }
}

function getPreviewUrl() {
  try {
    return previewIframeEl?.contentWindow?.location.href ?? null;
  } catch {
    return null;
  }
}

function getDisplayedPreviewUrl() {
  const liveUrl = getPreviewUrl();
  if (liveUrl) return liveUrl;

  const stackUrl = previewNav.urls[previewNav.index];
  if (stackUrl) return stackUrl;

  return previewIframeEl?.getAttribute("src") || previewIframeEl?.src || currentProject?.previewUrl || "";
}

function updatePreviewUrlDisplay() {
  if (!previewUrlEl) return;
  previewUrlEl.value = getDisplayedPreviewUrl();
}

function refreshPreview() {
  if (!previewIframeEl) return;

  const currentUrl = getDisplayedPreviewUrl();

  try {
    previewIframeEl.contentWindow.location.reload();
    return;
  } catch {
    // Cross-origin or blocked — fall back to resetting src.
  }

  previewNav.skipNextLoad = true;
  previewIframeEl.src = currentUrl;
  updatePreviewUrlDisplay();
}

function updatePreviewNavButtons() {
  if (!previewBackBtn || !previewForwardBtn) return;

  const canGoBack = !previewNav.historyBlocked && previewNav.index > 0;
  const canGoForward =
    !previewNav.historyBlocked && previewNav.index < previewNav.urls.length - 1;

  previewBackBtn.disabled = !canGoBack;
  previewForwardBtn.disabled = !canGoForward;
  updatePreviewUrlDisplay();
}

function truncatePreviewForwardHistory() {
  if (previewNav.index < previewNav.urls.length - 1) {
    previewNav.urls = previewNav.urls.slice(0, previewNav.index + 1);
  }
}

function onPreviewLoad() {
  if (!previewIframeEl) return;

  if (previewNav.pending === "back") {
    previewNav.index = Math.max(0, previewNav.index - 1);
    previewNav.pending = null;
    updatePreviewNavButtons();
    return;
  }

  if (previewNav.pending === "forward") {
    previewNav.index = Math.min(previewNav.urls.length - 1, previewNav.index + 1);
    previewNav.pending = null;
    updatePreviewNavButtons();
    return;
  }

  if (previewNav.skipNextLoad) {
    previewNav.skipNextLoad = false;
    updatePreviewNavButtons();
    return;
  }

  if (previewNav.initialLoad) {
    previewNav.initialLoad = false;
    updatePreviewNavButtons();
    return;
  }

  const url = getPreviewUrl();
  const currentUrl = previewNav.urls[previewNav.index];

  if (url && url !== currentUrl) {
    truncatePreviewForwardHistory();
    previewNav.urls.push(url);
    previewNav.index = previewNav.urls.length - 1;
  } else if (!url) {
    truncatePreviewForwardHistory();
    previewNav.urls.push(null);
    previewNav.index = previewNav.urls.length - 1;
  }

  updatePreviewNavButtons();
}

function onPreviewSpaNavigation(event) {
  if (!previewIframeEl || event.source !== previewIframeEl.contentWindow) return;

  const data = event.data;
  if (!data || data.type !== PREVIEW_NAV_MESSAGE || !data.url) return;

  const { url, navigationType = "push" } = data;
  const currentUrl = previewNav.urls[previewNav.index];

  if (navigationType === "replace") {
    previewNav.urls[previewNav.index] = url;
  } else if (navigationType === "pop") {
    if (previewNav.index > 0 && previewUrlsMatch(previewNav.urls[previewNav.index - 1], url)) {
      previewNav.index -= 1;
    } else if (
      previewNav.index < previewNav.urls.length - 1 &&
      previewUrlsMatch(previewNav.urls[previewNav.index + 1], url)
    ) {
      previewNav.index += 1;
    } else {
      const idx = previewNav.urls.findIndex((entry) => previewUrlsMatch(entry, url));
      if (idx >= 0) previewNav.index = idx;
    }
  } else if (!previewUrlsMatch(currentUrl, url)) {
    truncatePreviewForwardHistory();
    previewNav.urls.push(url);
    previewNav.index = previewNav.urls.length - 1;
  } else if (previewNav.index === 0 && previewNav.urls.length === 1) {
    previewNav.urls[0] = url;
  }

  updatePreviewNavButtons();
}

function navigatePreviewBack() {
  if (!previewIframeEl || previewNav.index <= 0 || previewNav.historyBlocked) return;

  try {
    previewIframeEl.contentWindow.history.back();
    return;
  } catch {
    // Fall back to resetting iframe src when history API is blocked.
  }

  const targetUrl = previewNav.urls[previewNav.index - 1];
  if (!targetUrl) return;

  previewNav.index -= 1;
  previewNav.skipNextLoad = true;
  previewIframeEl.src = targetUrl;
  updatePreviewNavButtons();
}

function navigatePreviewForward() {
  if (
    !previewIframeEl ||
    previewNav.index >= previewNav.urls.length - 1 ||
    previewNav.historyBlocked
  ) {
    return;
  }

  try {
    previewIframeEl.contentWindow.history.forward();
    return;
  } catch {
    // Fall back to resetting iframe src when history API is blocked.
  }

  const targetUrl = previewNav.urls[previewNav.index + 1];
  if (!targetUrl) return;

  previewNav.index += 1;
  previewNav.skipNextLoad = true;
  previewIframeEl.src = targetUrl;
  updatePreviewNavButtons();
}

function initPreviewNavigation() {
  if (!previewIframeEl || !previewBackBtn || !previewForwardBtn) return;

  previewNav.urls = [previewIframeEl.getAttribute("src") || previewIframeEl.src];
  previewNav.index = 0;
  previewIframeEl.addEventListener("load", onPreviewLoad);
  window.addEventListener("message", onPreviewSpaNavigation);
  previewBackBtn.addEventListener("click", navigatePreviewBack);
  previewForwardBtn.addEventListener("click", navigatePreviewForward);
  previewRefreshBtn?.addEventListener("click", refreshPreview);
  updatePreviewNavButtons();
  updatePreviewUrlDisplay();
}

initPreviewNavigation();

function initPreviewChatDismiss() {
  previewCanvasEl?.addEventListener("mousedown", collapseChatOnPreviewInteraction);

  window.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (document.activeElement === previewIframeEl) {
        setChatExpanded(false);
      }
    }, 0);
  });
}

initPreviewChatDismiss();

function getInitials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function renderProfileAvatar(user) {
  if (!profileAvatarEl || !user) return;

  profileAvatarEl.innerHTML = "";

  if (user.image) {
    const img = document.createElement("img");
    img.src = user.image;
    img.alt = "";
    profileAvatarEl.appendChild(img);
    return;
  }

  profileAvatarEl.textContent = getInitials(user.name, user.email);
}

function setProfileDropdownOpen(open) {
  if (!profileToggleEl || !profileDropdownEl) return;

  profileToggleEl.setAttribute("aria-expanded", String(open));
  profileDropdownEl.hidden = !open;
}

function renderProfileDetails(user) {
  if (!user) return;

  if (profileNameEl) {
    profileNameEl.textContent = user.name || user.email || "Account";
  }

  if (profileEmailEl) {
    profileEmailEl.textContent = user.email || "";
  }

  renderProfileAvatar(user);
}

async function loadUser() {
  const res = await fetch("/api/me", { credentials: "include" });
  if (!res.ok) {
    window.location.href = `/login?redirect=${encodeURIComponent("/builder")}`;
    return;
  }

  const data = await res.json();
  const user = data.user ?? data.session?.user;
  renderProfileDetails(user);
}

function setProjectStatus(message, { visible = true } = {}) {
  if (!projectStatusEl) return;
  projectStatusEl.hidden = !visible;
  projectStatusEl.textContent = message ?? "";
}

let projectNameDialogResolver = null;

function closeProjectNameDialog(result = null) {
  if (!projectNameDialogEl) return;

  projectNameDialogEl.hidden = true;
  const resolve = projectNameDialogResolver;
  projectNameDialogResolver = null;
  resolve?.(result);
}

function openProjectNameDialog(defaultName = "My app") {
  if (!projectNameDialogEl || !projectNameInputEl) {
    return Promise.resolve(window.prompt("Project name", defaultName));
  }

  closeProjectNameDialog(null);

  return new Promise((resolve) => {
    projectNameDialogResolver = resolve;
    projectNameInputEl.value = defaultName;
    projectNameDialogEl.hidden = false;

    window.requestAnimationFrame(() => {
      projectNameInputEl.focus();
      projectNameInputEl.select();
    });
  });
}

function submitProjectNameDialog() {
  if (!projectNameInputEl) return;

  const name = projectNameInputEl.value.trim();
  closeProjectNameDialog(name || "Untitled project");
}

projectNameSubmitEl?.addEventListener("click", submitProjectNameDialog);
projectNameCancelEl?.addEventListener("click", () => closeProjectNameDialog(null));

projectNameInputEl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitProjectNameDialog();
  }
});

projectNameDialogEl?.addEventListener("click", (event) => {
  if (event.target === projectNameDialogEl) {
    closeProjectNameDialog(null);
  }
});

function renderProjectList(projects) {
  if (!projectListEl) return;

  if (!projects.length) {
    projectListEl.innerHTML = `<li class="project-list-empty">No projects yet.</li>`;
    return;
  }

  projectListEl.innerHTML = projects
    .map(
      (project) =>
        `<li><button type="button" class="btn btn-ghost btn-sm project-list-item${currentProject?.id === project.id ? " is-active" : ""}" data-project-id="${escapeHtml(project.id)}">${escapeHtml(project.name)}</button></li>`,
    )
    .join("");

  projectListEl.querySelectorAll("[data-project-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectProject(button.getAttribute("data-project-id"));
    });
  });
}

function renderProjectDetails(project) {
  if (!projectDetailsEl || !projectNameEl || !projectSandboxStatusEl) return;

  projectDetailsEl.hidden = !project;
  if (!project) return;

  projectNameEl.textContent = project.name;
  projectSandboxStatusEl.textContent = project.sandboxStatus ?? "unknown";
}

function setPreviewUrl(url) {
  if (!previewIframeEl || !url) return;

  previewNav.urls = [url];
  previewNav.index = 0;
  previewNav.initialLoad = true;
  previewIframeEl.src = url;
  updatePreviewNavButtons();
  updatePreviewUrlDisplay();
}

async function loadProjects() {
  const res = await fetch("/api/projects", { credentials: "include" });
  if (res.status === 401) {
    window.location.href = `/login?redirect=${encodeURIComponent("/builder")}`;
    return [];
  }

  const { projects } = await res.json();
  renderProjectList(projects);
  return projects;
}

async function refreshCurrentProject() {
  if (!currentProject?.id) return null;

  const res = await fetch(`/api/projects/${currentProject.id}`, { credentials: "include" });
  if (!res.ok) return currentProject;

  const { project } = await res.json();
  currentProject = project;
  renderProjectDetails(project);

  if (project.previewUrl && project.previewUrl !== previewIframeEl?.src) {
    if (project.sandboxStatus === "ready") {
      setProjectStatus("");
      setPreviewUrl(project.previewUrl);
    }
  }

  if (project.sandboxStatus === "starting" || project.sandboxStatus === "pending") {
    setProjectStatus("Starting workspace…");
    scheduleProjectStatusPoll();
  } else if (project.sandboxStatus === "failed") {
    setProjectStatus("Workspace failed to start. Try creating a new project.", { visible: true });
    clearProjectStatusPoll();
  } else {
    setProjectStatus("");
    clearProjectStatusPoll();
  }

  return project;
}

function scheduleProjectStatusPoll() {
  clearProjectStatusPoll();
  statusPollTimer = window.setInterval(() => {
    refreshCurrentProject();
  }, 4000);
}

function clearProjectStatusPoll() {
  if (statusPollTimer) {
    window.clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

async function selectProject(projectId) {
  if (!projectId) return;

  currentProject = { id: projectId };
  setProjectPanelOpen(true);
  await refreshCurrentProject();
  await loadProjects();
  await loadMessages();

  if (currentProject?.sandboxStatus === "ready" && currentProject.previewUrl) {
    setPreviewUrl(currentProject.previewUrl);
  }
}

async function createProject() {
  const name = await openProjectNameDialog("My app");
  if (name === null) return;

  setProjectStatus("Creating project…");
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });

  if (res.status === 401) {
    window.location.href = `/login?redirect=${encodeURIComponent("/builder")}`;
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    setProjectStatus(body.error || "Failed to create project");
    return;
  }

  const { project } = await res.json();
  currentProject = project;
  renderProjectDetails(project);
  await loadProjects();
  await loadMessages();
  setProjectStatus("Starting workspace…");
  scheduleProjectStatusPoll();
}

projectCreateEl?.addEventListener("click", createProject);

async function ensureProjectSelected() {
  const projects = await loadProjects();
  if (currentProject?.id) {
    await refreshCurrentProject();
    return;
  }

  if (projects.length > 0) {
    await selectProject(projects[0].id);
    return;
  }

  setProjectPanelOpen(true);
  setProjectStatus("Create a project to start building.");
}

async function loadMessages() {
  if (!currentProject?.id) {
    if (messagesEl) messagesEl.innerHTML = "";
    updateChatToggleVisibility();
    return;
  }

  const res = await fetch(`/api/projects/${currentProject.id}/messages`, { credentials: "include" });
  if (res.status === 401) {
    window.location.href = `/login?redirect=${encodeURIComponent("/builder")}`;
    return;
  }

  const { messages } = await res.json();
  messagesEl.innerHTML = messages
    .map(
      (m) =>
        `<div class="msg ${m.role === "user" ? "user" : "assistant"}">${escapeHtml(m.content)}</div>`,
    )
    .join("");
  messagesEl.scrollTop = messagesEl.scrollHeight;
  updateChatToggleVisibility();

  if (messagesEl.children.length > 0) {
    setChatExpanded(true);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function parseSseEvents(buffer) {
  const events = [];
  const chunks = buffer.split("\n\n");
  const remainder = chunks.pop() ?? "";

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;

    let event = "message";
    const dataLines = [];

    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) continue;

    try {
      events.push({ event, data: JSON.parse(dataLines.join("\n")) });
    } catch {
      // Ignore malformed SSE payloads.
    }
  }

  return { events, remainder };
}

async function consumeAgentTurnStream(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming is not supported in this browser");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let streamedText = "";
  let finalReply = null;
  let shouldRefreshPreview = false;
  let buildFailed = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseEvents(buffer);
    buffer = parsed.remainder;

    for (const { event, data } of parsed.events) {
      if (event === "status" && data?.phase) {
        updateAgentPhaseLabel(data.phase);
      } else if (event === "token" && data?.delta) {
        streamedText += data.delta;
      } else if (event === "done") {
        finalReply = data?.reply ?? streamedText;
        buildFailed = Boolean(data?.buildFailed);
        shouldRefreshPreview =
          (data?.patchCount ?? 0) > 0 || data?.workType === "block_activation";
      } else if (event === "error") {
        throw new Error(data?.message || "Agent turn failed");
      }
    }
  }

  if (finalReply) {
    finalizeStreamingMessage(finalReply, { isError: buildFailed });
    if (shouldRefreshPreview) refreshPreview();
    return;
  }

  if (streamedText) {
    finalizeStreamingMessage(streamedText);
    return;
  }

  removeStreamingMessage();
  await loadMessages();
}

async function sendPrompt() {
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  if (!currentProject?.id) {
    appendAssistantMessage("Create or select a project first.", { isError: true });
    setProjectPanelOpen(true);
    return;
  }

  expandChatBarOnSend();
  appendOptimisticUserMessage(prompt);
  promptEl.value = "";
  setAgentTurnInFlight(true);

  try {
    const res = await fetch(`/api/projects/${currentProject.id}/agent-turn/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt }),
    });

    if (res.status === 401) {
      window.location.href = `/login?redirect=${encodeURIComponent("/builder")}`;
      return;
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        // Non-JSON error body.
      }
      throw new Error(message);
    }

    await consumeAgentTurnStream(res);
  } catch (error) {
    removeStreamingMessage();
    const message = error instanceof Error ? error.message : String(error);
    appendAssistantMessage(`Error: ${message}`, { isError: true });
  } finally {
    setAgentTurnInFlight(false);
  }
}

profileToggleEl?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = profileToggleEl.getAttribute("aria-expanded") === "true";
  setProfileDropdownOpen(!isOpen);
});

signOutEl?.addEventListener("click", async (event) => {
  event.preventDefault();
  setProfileDropdownOpen(false);
  await authClient.signOut();
  window.location.href = "/login";
});

document.addEventListener("click", (event) => {
  if (!profileDropdownEl || profileDropdownEl.hidden) return;
  if (event.target.closest(".profile-menu")) return;
  setProfileDropdownOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (projectNameDialogEl && !projectNameDialogEl.hidden) {
      closeProjectNameDialog(null);
      return;
    }

    setProfileDropdownOpen(false);
    if (isChatExpanded()) {
      setChatExpanded(false);
    }
  }
});

chatToggleEl?.addEventListener("click", toggleChatExpanded);

sendBtn?.addEventListener("click", sendPrompt);
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendPrompt();
});

loadUser();
ensureProjectSelected();
