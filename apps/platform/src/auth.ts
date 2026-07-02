import { betterAuth } from "better-auth";

const port = Number(process.env.PORT ?? 3001);
const baseURL = process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`;
const secret = process.env.BETTER_AUTH_SECRET?.trim();
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const authDisabled =
  process.env.BUILDER_AUTH_DISABLED === "1" || process.env.BUILDER_AUTH_DISABLED === "true";

if (!authDisabled && !secret) {
  console.warn(
    "[auth] BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32",
  );
}

if (!authDisabled && (!googleClientId || !googleClientSecret)) {
  console.warn(
    "[auth] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for builder sign-in.",
  );
}

export const auth = betterAuth({
  baseURL,
  secret: secret ?? "dev-insecure-secret-change-me",
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
});
