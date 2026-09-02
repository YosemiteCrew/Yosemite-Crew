import type { Config } from '@docusaurus/types';
import type { Options, ThemeConfig } from '@docusaurus/preset-classic';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Yosemite Crew Developer Docs',
  tagline: 'Build, integrate, and launch on Yosemite Crew.',
  favicon: 'img/favicon.ico',
  /*
   * The deployed origin, not localhost. Docusaurus bakes `url` into every
   * canonical link, `og:url` and `og:image`, so with localhost here the live
   * site told search engines its canonical home was http://localhost:3000 and
   * every shared link previewed a social card nobody outside the developer's
   * machine could load. Overridable so a preview deploy can set its own.
   */
  url: process.env.DEV_DOCS_URL ?? 'https://yosemitecrew.com',
  baseUrl: '/dev-docs/',
  organizationName: 'yosemite-crew',
  projectName: 'developer-docs',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  /*
   * Stays false, deliberately.
   *
   * The built site is served as static files from the Next app's `public/`
   * directory, and that app has `trailingSlash` unset, i.e. false - so it
   * 308-redirects `/dev-docs/x/` to `/dev-docs/x`. Setting this to true would
   * make Docusaurus link to the slashed form, get redirected to the
   * extensionless one, and 404 exactly as before. The extensionless links this
   * emits are resolved by a rewrite in apps/frontend/next.config.ts instead.
   */
  trailingSlash: false,
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          showLastUpdateTime: true,
          showLastUpdateAuthor: false,
          editUrl: undefined,
        },
        blog: false,
        pages: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Options,
    ],
  ],
  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexDocs: true,
        indexPages: true,
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        docsRouteBasePath: '/',
        // The chat guide's code samples name server-only env vars (e.g. the
        // Stream API secret). The indexer ingests code blocks, which put those
        // names into search-index.json - a browser artifact - and security
        // scanners rightly treat server-secret NAMES in browser artifacts as a
        // finding. The page stays fully readable; it is only excluded from the
        // search index. Renaming the vars in the samples would break them.
        ignoreFiles: [/guides\/backend-chat/],
      },
    ],
  ],
  themeConfig: {
    image: 'img/social-card.png',
    navbar: {
      title: 'Developer Docs',
      logo: {
        alt: 'Yosemite Crew',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'overview',
          position: 'left',
          label: 'Overview',
        },
        { href: 'https://yosemitecrew.com', label: 'Main site', position: 'right' },
        {
          href: 'https://github.com/YosemiteCrew/Yosemite-Crew',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Overview',
              to: '/',
            },
            {
              label: 'Notification setup',
              to: '/guides/notification-setup',
            },
            {
              label: 'Frontend app',
              to: '/apps/frontend',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Support',
              href: 'https://yosemitecrew.com/contact',
            },
            {
              label: 'Status',
              href: 'https://status.yosemitecrew.com',
            },
            {
              label: 'Changelog',
              href: 'https://yosemitecrew.com',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Homepage',
              href: 'https://yosemitecrew.com',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/YosemiteCrew/Yosemite-Crew',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Yosemite Crew. Built with Docusaurus`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
  } satisfies ThemeConfig,
};

export default config;
