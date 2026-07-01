const messagesEl = document.getElementById("messages");
const promptEl = document.getElementById("prompt");
const planModeEl = document.getElementById("planMode");

async function loadMessages() {
  const res = await fetch("/api/messages");
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
    await fetch("/api/agent-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, planMode: planModeEl.checked }),
    });
    await loadMessages();
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  }
}

document.getElementById("send").addEventListener("click", sendPrompt);
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendPrompt();
});

loadMessages();
