import { loadCorpus, type DocEntry } from './corpus';

/**
 * The documentation sidebar.
 *
 * Order is declared here because it is editorial - Guides before Apps before
 * UI System - and nothing in the files themselves expresses it. Everything
 * else is derived: entries are looked up by frontmatter `id`, so a renamed or
 * deleted page fails the build rather than silently vanishing from the nav.
 *
 * The Backend API section is deliberately not listed page by page. It is the
 * 36 router references, they are generated from the routers, and enumerating
 * them here would mean editing this file every time a router is added.
 */

export interface NavLink {
  kind: 'link';
  id: string;
  title: string;
  href: string;
}

export interface NavSection {
  kind: 'section';
  label: string;
  /** Collapsed by default in the sidebar. */
  collapsed?: boolean;
  items: NavLink[];
}

export type NavNode = NavLink | NavSection;

/** Ordered ids. `AUTO_BACKEND_ROUTERS` expands to every router reference page. */
const AUTO_BACKEND_ROUTERS = Symbol('auto:backend-routers');

type SectionSpec = {
  label: string;
  collapsed?: boolean;
  items: (string | typeof AUTO_BACKEND_ROUTERS)[];
};

const ROOT_ID = 'overview';

const SECTIONS: SectionSpec[] = [
  {
    label: 'Guides',
    items: ['notification-setup-guide', 'backend-chat-implementation'],
  },
  {
    label: 'Apps',
    items: ['frontend-app', 'backend-app', 'openapi', 'mobile-app'],
  },
  {
    label: 'Backend API',
    collapsed: true,
    items: ['backend-index', AUTO_BACKEND_ROUTERS],
  },
  {
    label: 'UI System',
    items: [
      'ui-system/overview',
      'ui-system/design-tokens',
      'ui-system/component-taxonomy',
      'ui-system/contribution-guide',
      'ui-system/validation-matrix',
    ],
  },
  {
    label: 'Policies',
    items: ['contributing', 'code-of-conduct', 'security'],
  },
];

const ROUTER_DIR = 'apps/backend/routers/';

const toLink = (entry: DocEntry): NavLink => ({
  kind: 'link',
  id: entry.id,
  title: entry.title,
  href: entry.href,
});

export const buildDocsNav = (corpus: DocEntry[] = loadCorpus()): NavNode[] => {
  const byId = new Map(corpus.map((entry) => [entry.id, entry]));
  const used = new Set<string>();

  const take = (id: string): NavLink => {
    const entry = byId.get(id);
    if (!entry) {
      throw new Error(
        `Docs nav references id "${id}", which no page in content/docs declares. ` +
          'Either the page was renamed and the nav was not, or the id is a typo.'
      );
    }
    used.add(id);
    return toLink(entry);
  };

  const routerPages = corpus
    .filter((entry) => entry.file.startsWith(ROUTER_DIR))
    .sort((a, b) => a.title.localeCompare(b.title));

  const nodes: NavNode[] = [take(ROOT_ID)];

  for (const section of SECTIONS) {
    const items: NavLink[] = [];
    for (const item of section.items) {
      if (item === AUTO_BACKEND_ROUTERS) {
        for (const page of routerPages) {
          used.add(page.id);
          items.push(toLink(page));
        }
      } else {
        items.push(take(item));
      }
    }
    nodes.push({
      kind: 'section',
      label: section.label,
      collapsed: section.collapsed,
      items,
    });
  }

  /*
   * A page that exists but appears nowhere in the nav is unreachable except by
   * URL. That is how a documentation site quietly loses pages, so it is an
   * error rather than a warning.
   */
  const orphans = corpus.filter((entry) => !used.has(entry.id));
  if (orphans.length) {
    throw new Error(
      `${orphans.length} docs page(s) are not in the sidebar and would be unreachable: ` +
        orphans.map((entry) => entry.file).join(', ')
    );
  }

  return nodes;
};

export const flattenNav = (nodes: NavNode[]): NavLink[] =>
  nodes.flatMap((node) => (node.kind === 'link' ? [node] : node.items));
