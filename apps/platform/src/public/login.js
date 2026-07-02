import { authClient } from "./auth-client.js";

const params = new URLSearchParams(window.location.search);
const redirectTo = params.get("redirect") || "/builder";
const errorEl = document.getElementById("error");
const signInBtn = document.getElementById("google-signin");

signInBtn.addEventListener("click", async () => {
  errorEl.hidden = true;
  signInBtn.disabled = true;

  try {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTo,
    });
  } catch (error) {
    errorEl.hidden = false;
    errorEl.textContent =
      error instanceof Error ? error.message : "Sign-in failed. Try again.";
    signInBtn.disabled = false;
  }
});
