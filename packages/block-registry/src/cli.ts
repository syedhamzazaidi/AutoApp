#!/usr/bin/env node
import { activateBlock, deactivateBlock, listRecipes } from "./activate.js";
import { readManifest, validateManifestSchema } from "./manifest.js";

const [, , command, blockId] = process.argv;

async function main() {
  switch (command) {
    case "validate": {
      const manifest = readManifest();
      const errors = validateManifestSchema(manifest);
      if (errors.length) {
        console.error("Manifest validation failed:");
        errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
      }
      console.log("Manifest valid");
      break;
    }
    case "activate": {
      if (!blockId) {
        console.error("Usage: blocks activate <blockId>");
        console.error("Available blocks:", listRecipes().map((r) => r.id).join(", "));
        process.exit(1);
      }
      const manifest = activateBlock(blockId, { runMigrations: process.env.RUN_MIGRATIONS === "1" });
      console.log(`Activated block: ${blockId}`);
      console.log(JSON.stringify(manifest.blocks[blockId], null, 2));
      break;
    }
    case "deactivate": {
      if (!blockId) {
        console.error("Usage: blocks deactivate <blockId>");
        process.exit(1);
      }
      deactivateBlock(blockId);
      console.log(`Deactivated block: ${blockId}`);
      break;
    }
    case "list": {
      listRecipes().forEach((r) => console.log(`${r.id}: ${r.description}`));
      break;
    }
    default:
      console.log("Usage: blocks <validate|activate|deactivate|list> [blockId]");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
