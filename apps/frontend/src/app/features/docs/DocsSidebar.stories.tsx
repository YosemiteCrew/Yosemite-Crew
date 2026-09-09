import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { NavNode } from './docsNav';
import DocsSidebar from './DocsSidebar';
import './docs.css';

/**
 * A trimmed stand-in for the real nav `buildDocsNav` produces: a root link,
 * two open sections, one section declared `collapsed: true` (mirrors the
 * real Backend API section, which stays closed by default because it holds
 * 36 router references), and a Policies section.
 */
const NAV: NavNode[] = [
  { kind: 'link', id: 'overview', title: 'Overview', href: '/docs' },
  {
    kind: 'section',
    label: 'Guides',
    items: [
      {
        kind: 'link',
        id: 'notification-setup-guide',
        title: 'Notification setup',
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
      { kind: 'link', id: 'mobile-app', title: 'Mobile app', href: '/docs/mobile-app' },
    ],
  },
  {
    kind: 'section',
    label: 'Backend API',
    collapsed: true,
    items: [
      { kind: 'link', id: 'backend-index', title: 'Router index', href: '/docs/backend-index' },
      {
        kind: 'link',
        id: 'appointments-router',
        title: 'Appointments router',
        href: '/docs/appointments-router',
      },
      {
        kind: 'link',
        id: 'invoices-router',
        title: 'Invoices router',
        href: '/docs/invoices-router',
      },
    ],
  },
  {
    kind: 'section',
    label: 'Policies',
    items: [
      { kind: 'link', id: 'contributing', title: 'Contributing', href: '/docs/contributing' },
      { kind: 'link', id: 'security', title: 'Security', href: '/docs/security' },
    ],
  },
];

const docsSidebarMeta = {
  title: 'Docs/DocsSidebar',
  component: DocsSidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The documentation sidebar nav. Sections collapse and expand client-side, but every ' +
          'entry is a plain anchor, so the nav works with JavaScript disabled and every page ' +
          "stays crawlable. A section's declared `collapsed` flag is a default only: it is " +
          'overridden and the section opens automatically when it contains the current page, ' +
          'so deep-linking into one of the 36 backend router references does not land the ' +
          'reader in a collapsed tree with no idea where they are.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    nav: NAV,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280, background: 'var(--page)', padding: '20px 12px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocsSidebar>;

export default docsSidebarMeta;
type DocsSidebarStory = StoryObj<typeof docsSidebarMeta>;

export const Default: DocsSidebarStory = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/docs/notification-setup-guide' } },
  },
};

export const ActiveInsideCollapsedSection: DocsSidebarStory = {
  name: 'Active page inside a collapsed section',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/docs/invoices-router' } },
  },
};

export const TopLevelLinkActive: DocsSidebarStory = {
  name: 'Top-level link active',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/docs' } },
  },
};

export const NoActivePage: DocsSidebarStory = {
  name: 'No page matches the current route',
  parameters: {
    // A page that was renamed or removed from the nav: nothing highlights,
    // and the Backend API section stays collapsed since it holds no match.
    nextjs: { appDirectory: true, navigation: { pathname: '/docs/renamed-page' } },
  },
};

export const TogglesASection: DocsSidebarStory = {
  name: 'Clicking a section header toggles it',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/docs/notification-setup-guide' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('button', { name: /Apps/ });
    await expect(header).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(header);

    await expect(header).toHaveAttribute('aria-expanded', 'false');
    const content = canvasElement.querySelector('#docs-section-apps');
    await expect(content).toHaveAttribute('hidden');

    // Toggling back reopens it.
    await userEvent.click(header);
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(content).not.toHaveAttribute('hidden');
  },
};
