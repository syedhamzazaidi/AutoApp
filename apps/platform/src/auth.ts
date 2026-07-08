import { betterAuth } from "better-auth";
import pg from "pg";

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

function createDatabasePool(): pg.Pool | undefined {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    if (authDisabled || process.env.VITEST === "true") {
      return undefined;
    }
    console.warn("[auth] DATABASE_URL is not set; Better Auth will run without persistence.");
    return undefined;
  }

  return new pg.Pool({ connectionString });
}

const database = createDatabasePool();

export const auth = betterAuth({
  baseURL,
  secret: secret ?? "dev-insecure-secret-change-me",
  ...(database ? { database } : {}),
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
