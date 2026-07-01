import manifest from "../../lovable.blocks.json";
import type { BlocksManifest } from "@endian/shared";

export function getBlocksManifest(): BlocksManifest {
  return manifest as BlocksManifest;
}

export function isBlockEnabled(blockId: string): boolean {
  return getBlocksManifest().blocks[blockId]?.state === "enabled";
}
