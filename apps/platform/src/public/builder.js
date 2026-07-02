import { authClient } from "./auth-client.js";

const messagesEl = document.getElementById("messages");
const promptEl = document.getElementById("prompt");
const planModeEl = document.getElementById("planMode");
const userLabelEl = document.getElementById("userLabel");
const signOutEl = document.getElementById("sign-out");

async function loadUser() {
  const res = await fetch("/api/me", { credentials: "include" });
  if (!res.ok) {
    window.location.href = `/login?redirect=${encodeURIComponent("/builder")}`;
    return;
  }

  const data = await res.json();
  const user = data.user ?? data.session?.user;
  if (userLabelEl && user?.email) {
    userLabelEl.textContent = user.name ? `${user.name} · ${user.email}` : user.email;
  }
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
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  }
}

signOutEl?.addEventListener("click", async (event) => {
  event.preventDefault();
  await authClient.signOut();
  window.location.href = "/login";
});

document.getElementById("send").addEventListener("click", sendPrompt);
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendPrompt();
});

loadUser();
loadMessages();
