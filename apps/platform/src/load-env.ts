import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(platformRoot, "../..");

config({ path: path.join(platformRoot, ".env") });
config({ path: path.join(repoRoot, ".env") });
