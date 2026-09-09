import type { Meta, StoryObj } from '@storybook/react';
import type { Element, Root, Text } from 'hast';
import DocsShell from './DocsShell';
import type { NavNode } from './docsNav';
import type { TocEntry } from './render';

/**
 * Hand-built HAST, standing in for what render.ts's sanitised pipeline would
 * hand back for a real markdown page - headings with ids for the table of
 * contents, a paragraph, an in-corpus link and a fenced code block.
 */
const text = (value: string): Text => ({ type: 'text', value });

const el = (
  tagName: string,
  children: Element['children'],
  properties: Element['properties'] = {}
): Element => ({ type: 'element', tagName, properties, children });

const SAMPLE_TREE: Root = {
  type: 'root',
  children: [
    el('h2', [text('Installation')], { id: 'installation' }),
    el('p', [
      text('Add the SDK with your package manager of choice: '),
      el('code', [text('pnpm add @yosemite-crew/sdk')]),
      text('.'),
    ]),
    el('h2', [text('Authentication')], { id: 'authentication' }),
    el('p', [
      text('Every request needs an API key, generated from the '),
      el('a', [text('developer portal')], { href: '/developers' }),
      text('.'),
    ]),
    el('h3', [text('Request headers')], { id: 'request-headers' }),
    el('pre', [
      el('code', [text('Authorization: Bearer <token>\nContent-Type: application/json')], {
        className: ['language-http'],
      }),
    ]),
    el('h2', [text('Rate limits')], { id: 'rate-limits' }),
    el('p', [text('The default plan allows 600 requests per minute per organisation.')]),
  ],
};

const NAV: NavNode[] = [
  { kind: 'link', id: 'overview', title: 'Overview', href: '/docs' },
  {
    kind: 'section',
    label: 'Guides',
    items: [
      {
        kind: 'link',
        id: 'notification-setup-guide',
        title: 'Notification setup guide',
        href: '/docs/notification-setup-guide',
      },
      {
        kind: 'link',
        id: 'backend-chat-implementation',
        title: 'Backend chat implementation',
        href: '/docs/backend-chat-implementation',
      },
    ],
  },
  {
    kind: 'section',
    label: 'Apps',
    items: [
      { kind: 'link', id: 'frontend-app', title: 'Frontend app', href: '/docs/frontend-app' },
      { kind: 'link', id: 'backend-app', title: 'Backend app', href: '/docs/backend-app' },
      { kind: 'link', id: 'openapi', title: 'OpenAPI reference', href: '/docs/openapi' },
    ],
  },
  {
    kind: 'section',
    label: 'Backend API',
    collapsed: true,
    items: [
      {
        kind: 'link',
        id: 'backend-index',
        title: 'Backend API index',
        href: '/docs/backend-index',
      },
    ],
  },
];

const TOC: TocEntry[] = [
  { id: 'installation', text: 'Installation', depth: 2 },
  { id: 'authentication', text: 'Authentication', depth: 2 },
  { id: 'request-headers', text: 'Request headers', depth: 3 },
  { id: 'rate-limits', text: 'Rate limits', depth: 2 },
];

const EDIT_URL =
  'https://github.com/YosemiteCrew/Yosemite-Crew/edit/dev/apps/frontend/content/docs/notification-setup-guide.md';

const docsShellMeta = {
  title: 'Docs/DocsShell',
  component: DocsShell,
  parameters: {
    layout: 'fullscreen',
    // DocsSidebar reads the active route through next/navigation, both to
    // highlight the current link and to auto-expand the section it lives in.
    nextjs: { appDirectory: true, navigation: { pathname: '/docs/notification-setup-guide' } },
    docs: {
      description: {
        component:
          'Chrome for every public documentation page: the top bar, the collapsible sidebar nav, ' +
          'the breadcrumb trail, the page title, the sanitised document body, and the on-page ' +
          'table of contents. The body is a HAST tree rendered through `toJsxRuntime`, never an ' +
          'HTML string - render.ts sanitises the corpus markdown before this component ever sees ' +
          'it, so there is no raw-HTML sink for a contributed doc page to exploit. `embedOpenApi` ' +
          'additionally mounts a sandboxed iframe for the Redoc viewer, set only by the OpenAPI ' +
          'reference page.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    embedOpenApi: { control: 'boolean' },
  },
  args: {
    nav: NAV,
    toc: TOC,
    title: 'Notification setup guide',
    breadcrumb: ['Docs', 'Guides', 'Notification setup guide'],
    tree: SAMPLE_TREE,
    editUrl: EDIT_URL,
    embedOpenApi: false,
  },
} satisfies Meta<typeof DocsShell>;

export default docsShellMeta;
type DocsShellStory = StoryObj<typeof docsShellMeta>;

export const Default: DocsShellStory = {};

export const NoTableOfContents: DocsShellStory = {
  name: 'No table of contents',
  args: { toc: [] },
  parameters: {
    docs: {
      description: {
        story:
          'A page with no h2/h3 headings gets an empty `toc`, and the "On this page" rail is ' +
          'omitted entirely rather than rendered with nothing in it.',
      },
    },
  },
};

export const OpenApiReference: DocsShellStory = {
  name: 'OpenAPI reference (embedded viewer)',
  args: {
    embedOpenApi: true,
    title: 'API Reference',
    breadcrumb: ['Docs', 'Apps', 'API Reference'],
  },
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/docs/openapi' } },
    docs: {
      description: {
        story:
          'The sandboxed Redoc viewer renders below the document body - allowed to run scripts ' +
          'and fetch the same-origin spec, and nothing else.',
      },
    },
  },
};

export const DeepLinkIntoCollapsedSection: DocsShellStory = {
  name: 'Deep link into a collapsed section',
  args: {
    title: 'Backend API index',
    breadcrumb: ['Docs', 'Backend API', 'Backend API index'],
  },
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/docs/backend-index' } },
    docs: {
      description: {
        story:
          'Backend API is collapsed by default, but landing on one of its pages expands it anyway: ' +
          'DocsSidebar starts a section open whenever it contains the current route, so a reader ' +
          'who follows a deep link never lands inside a collapsed tree with no idea where they are.',
      },
    },
  },
};
