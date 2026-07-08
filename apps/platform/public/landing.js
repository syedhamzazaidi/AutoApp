const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --- Scroll reveal --- */
function initScrollReveal() {
  const revealEls = document.querySelectorAll(".reveal");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
  );

  revealEls.forEach((el) => observer.observe(el));
}

/* --- Animated hero chat mock --- */
function initHeroChat() {
  const promptEl = document.getElementById("mockPrompt");
  const replyEl = document.getElementById("mockReply");
  const fileEl = document.getElementById("mockFile");
  if (!promptEl || !replyEl) return;

  const scenes = [
    { prompt: "Add login", reply: "Activated auth block", file: "auth · enabled ✓" },
    { prompt: "Add a plants page", reply: "Generated PlantsPage.tsx", file: "src/pages/PlantsPage.tsx ✓" },
    { prompt: "Enable file uploads", reply: "Activated storage block", file: "storage · enabled ✓" },
  ];

  if (prefersReducedMotion) {
    promptEl.textContent = scenes[0].prompt;
    replyEl.textContent = scenes[0].reply;
    if (fileEl) fileEl.textContent = scenes[0].file;
    return;
  }

  let sceneIndex = 0;

  const type = (el, text, speed = 45) =>
    new Promise((resolve) => {
      el.textContent = "";
      let i = 0;
      const tick = () => {
        el.textContent = text.slice(0, i + 1);
        i += 1;
        if (i < text.length) {
          setTimeout(tick, speed);
        } else {
          resolve();
        }
      };
      tick();
    });

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function run() {
    while (true) {
      const scene = scenes[sceneIndex];
      replyEl.classList.remove("visible");
      if (fileEl) fileEl.classList.remove("visible");

      await type(promptEl, scene.prompt);
      await wait(400);

      replyEl.textContent = scene.reply;
      replyEl.classList.add("visible");
      await wait(300);

      if (fileEl) {
        fileEl.textContent = scene.file;
        fileEl.classList.add("visible");
      }

      await wait(2400);
      sceneIndex = (sceneIndex + 1) % scenes.length;
    }
  }

  run();
}

document.addEventListener("DOMContentLoaded", () => {
  initScrollReveal();
  initHeroChat();
});
