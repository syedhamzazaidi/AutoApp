import { authClient } from "./auth-client.js";

const messagesEl = document.getElementById("messages");
const promptEl = document.getElementById("prompt");
const planModeEl = document.getElementById("planMode");
const chatBarEl = document.getElementById("chat-bar");
const profileToggleEl = document.getElementById("profile-toggle");
const profileAvatarEl = document.getElementById("profile-avatar");
const profileDropdownEl = document.getElementById("profile-dropdown");
const profileNameEl = document.getElementById("profile-name");
const profileEmailEl = document.getElementById("profile-email");
const signOutEl = document.getElementById("sign-out");
const builderMainEl = document.querySelector(".builder-main");
const projectPanelEl = document.getElementById("project-panel");
const projectToggleEl = document.getElementById("project-toggle");

const CHAT_EXPAND_MS = 2500;
let chatCollapseTimer;

function setProjectPanelOpen(open) {
  if (!builderMainEl || !projectPanelEl || !projectToggleEl) return;

  builderMainEl.classList.toggle("project-open", open);
  projectPanelEl.hidden = !open;
  projectToggleEl.setAttribute("aria-expanded", String(open));
  projectToggleEl.textContent = open ? "Hide project" : "Project";
}

projectToggleEl?.addEventListener("click", () => {
  const isOpen = projectToggleEl.getAttribute("aria-expanded") === "true";
  setProjectPanelOpen(!isOpen);
});

function expandChatBar() {
  if (!chatBarEl) return;

  chatBarEl.classList.add("expanded");
  clearTimeout(chatCollapseTimer);
  chatCollapseTimer = setTimeout(() => {
    chatBarEl.classList.remove("expanded");
  }, CHAT_EXPAND_MS);
}

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

async function loadMessages() {
  const res = await fetch("/api/messages", { credentials: "include" });
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
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function sendPrompt() {
  const prompt = promptEl.value.trim();
  if (!prompt) return;
  promptEl.value = "";

  const sendBtn = document.getElementById("send");
  sendBtn.disabled = true;
  sendBtn.textContent = "…";

  try {
    const res = await fetch("/api/agent-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt, planMode: planModeEl.checked }),
    });

    if (res.status === 401) {
      window.location.href = `/login?redirect=${encodeURIComponent("/builder")}`;
      return;
    }

    await loadMessages();
    expandChatBar();
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
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
    setProfileDropdownOpen(false);
  }
});

document.getElementById("send").addEventListener("click", sendPrompt);
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendPrompt();
});

loadUser();
loadMessages();
