import { authMetricsTab } from "@/features/auth/metrics.tab";
import { storageMetricsTab } from "@/features/storage/metrics.tab";
import { aiMetricsTab } from "@/features/ai/metrics.tab";
import { isBlockEnabled } from "@/lib/blocks";

const ALL_TABS = [authMetricsTab, storageMetricsTab, aiMetricsTab];

export function useEnabledBlockTabs() {
  return ALL_TABS.filter((tab) => isBlockEnabled(tab.blockId));
}

export type MetricsTab = (typeof ALL_TABS)[number];
