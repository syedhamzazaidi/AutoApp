import { useState } from "react";
import { AdminLayout } from "./AdminLayout";
import { OverviewTab } from "./tabs/OverviewTab";
import { BlockTabRenderer } from "./tabs/BlockTabRenderer";
import { useEnabledBlockTabs } from "./hooks/useEnabledBlockTabs";

export function AdminDashboard() {
  const tabs = useEnabledBlockTabs();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <AdminLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabs={[{ id: "overview", label: "Overview" }, ...tabs.map((t) => ({ id: t.blockId, label: t.label }))]}
    >
      {activeTab === "overview" && <OverviewTab />}
      {tabs.map(
        (tab) => activeTab === tab.blockId && <BlockTabRenderer key={tab.blockId} tab={tab} />,
      )}
    </AdminLayout>
  );
}

export { AdminLayout } from "./AdminLayout";
