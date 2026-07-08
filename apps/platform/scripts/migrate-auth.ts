import "../src/load-env.js";
import { runAuthMigrations } from "../src/auth.js";

await runAuthMigrations();
console.log("Better Auth migrations complete");
