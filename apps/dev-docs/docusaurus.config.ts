import type { Config } from "@docusaurus/types";
import type { Options, ThemeConfig } from "@docusaurus/preset-classic";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "Yosemite Crew Developer Docs",
  tagline: "Build, integrate, and launch on Yosemite Crew.",
  favicon: "img/favicon.ico",
  url: "http://localhost:3000",
  baseUrl: "/dev-docs/",
  organizationName: "yosemite-crew",
  projectName: "developer-docs",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  trailingSlash: false,
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          showLastUpdateTime: true,
          showLastUpdateAuthor: false,
          editUrl: undefined,
        },
        blog: false,
        pages: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Options,
    ],
  ],
  plugins: [
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        indexDocs: true,
        indexPages: true,
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        docsRouteBasePath: "/",
      },
    ],
  ],
  themeConfig: {
    image: "img/social-card.png",
    navbar: {
      title: "Developer Docs",
      logo: {
        alt: "Yosemite Crew",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "doc",
          docId: "overview",
          position: "left",
          label: "Overview",
        },
        { href: "https://yosemitecrew.com", label: "Main site", position: "right" },
        { href: "https://github.com/YosemiteCrew/Yosemite-Crew", label: "GitHub", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Overview",
              to: "/",
            },
            {
              label: "Notification setup",
              to: "/guides/notification-setup",
            },
            {
              label: "Frontend app",
              to: "/apps/frontend",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Support",
              href: "https://yosemitecrew.com/contact",
            },
            {
              label: "Status",
              href: "https://status.yosemitecrew.com",
            },
            {
              label: "Changelog",
              href: "https://yosemitecrew.com",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "Homepage",
              href: "https://yosemitecrew.com",
            },
            {
              label: "GitHub",
              href: "https://github.com/YosemiteCrew/Yosemite-Crew",
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Yosemite Crew. Built with Docusaurus`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json"],
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
  } satisfies ThemeConfig,
};

export default config;
