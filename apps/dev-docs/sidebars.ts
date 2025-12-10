import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docs: [
    "overview",
    {
      type: "category",
      label: "Guides",
      collapsed: false,
      items: ["guides/notification-setup-guide", "guides/backend-chat-implementation"],
    },
    {
      type: "category",
      label: "Apps",
      collapsed: false,
      items: ["apps/frontend-app", "apps/backend-app", "apps/mobile-app"],
    },
    {
      type: "category",
      label: "Policies",
      collapsed: false,
      items: ["policies/contributing", "policies/code-of-conduct", "policies/security"],
    },
  ],
};

export default sidebars;
