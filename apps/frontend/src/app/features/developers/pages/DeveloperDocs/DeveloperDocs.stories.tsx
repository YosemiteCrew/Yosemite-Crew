import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { useAuthStore } from '@/app/stores/authStore';
import DeveloperDocs from './DeveloperDocs';

/**
 * Seeds the auth store as a signed-in developer and restores it on unmount.
 *
 * `DevRouteGuard` renders nothing at all while `status` is `idle` or `checking`,
 * and on `/developers/*` it calls `signout()` for an authenticated non-developer.
 * Both of those are network-adjacent dead ends for a story, so the fixture is the
 * one combination that simply passes: an authenticated `developer`. No service is
 * mocked - the guard reads the store directly.
 */
const seedDeveloper = () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({
    status: 'authenticated',
    role: 'developer',
    user: {
      userId: 'dev-storybook',
      email: 'dev@example.test',
      authProfile: null,
      loginMethod: 'emailpassword',
      emailVerified: true,
      getUsername: () => 'dev-storybook',
    },
    attributes: { sub: 'dev-storybook', email: 'dev@example.test' },
  });
  return () => {
    useAuthStore.setState(snapshot);
  };
};

const meta = {
  title: 'Developers/DeveloperDocs',
  component: DeveloperDocs,
  parameters: {
    layout: 'fullscreen',
    // The guard reads `usePathname()`; on a non-`/developers` path it takes a
    // different branch entirely, so the route is pinned to the real one.
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/docs' } },
    docs: {
      description: {
        component:
          'The in-portal API reference. Two of its states had never been drawn, and both are ' +
          'reachable in one click from the resting page.\n\n' +
          '`DocsNavEmpty` replaces the **entire** section list - both headings and all seven ' +
          'items - the moment the search text matches nothing. It is not a row appended below ' +
          'the nav: `filteredNav` drops any section whose items filter to zero, and an empty ' +
          'array swaps the whole map for a single "No matches" line. The Edit-on-GitHub link ' +
          'survives it, which is the only thing left in the rail.\n\n' +
          "The article body is a two-way branch on `activeId === 'appointments'` and nothing " +
          'else. Appointments gets the endpoint strip, the required-fields paragraph, the FHIR ' +
          'note and the two code panels; every other one of the seven articles gets a title, a ' +
          'summary and a "this is seed content" note, with the whole `DocsCode` block ' +
          'unmounted. Six of the seven articles are therefore that second layout, and it had ' +
          'never been rendered.\n\n' +
          'The search filters `label` only, so a query that reads like a topic ("auth", ' +
          '"webhook") works and one that reads like prose ("how do I create a booking") empties ' +
          'the rail.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: seedDeveloper,
} satisfies Meta<typeof DeveloperDocs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The search field, which every story below drives. */
const searchBox = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByLabelText('Search docs');

export const Appointments: Story = {
  name: 'Appointments article (default)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { name: 'Appointments' })).toBeInTheDocument();

    // Seven nav items across two sections, all present before any filtering, and
    // the highlight sits on the one the article is showing.
    await expect(canvasElement.querySelectorAll('.DocsNavItem')).toHaveLength(7);
    await expect(canvas.getByText('Getting started')).toBeInTheDocument();
    await expect(canvas.getByText('Guides')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Appointments API' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    // The appointments-only furniture: endpoint strip plus both code panels.
    await expect(canvas.getByText('POST')).toBeInTheDocument();
    await expect(canvas.getByText('/fhir/v1/appointment/pms')).toBeInTheDocument();
    await expect(canvas.getByText('REQUEST · cURL')).toBeInTheDocument();
    await expect(canvas.getByText('RESPONSE · 201')).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('pre')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The landing article, and the only one of the seven that carries real reference ' +
          'content. `activeId` is seeded to `appointments` rather than to `overview`, so the ' +
          'breadcrumb reads "Docs / APIs / Appointments" on first paint while the nav highlight ' +
          'sits under Getting started.',
      },
    },
  },
};

export const NavEmpty: Story = {
  name: 'No matches (nav emptied)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(searchBox(canvasElement), 'how do I create a booking');

    const empty = await canvas.findByText('No matches');
    await expect(empty).toBeInTheDocument();

    /* The empty line REPLACES the sections; it is not appended to them. Counting
       the nav items is the assertion that separates the two, because the "No
       matches" text is present either way. */
    await expect(canvasElement.querySelectorAll('.DocsNavItem')).toHaveLength(0);

    /* The whole rail is gone, not just the items: both section headings and all
       seven buttons unmount. Asserting the headings separately matters because a
       filter bug that emptied only the items would leave two orphan headings
       above the "No matches" line and still satisfy a check for the line alone. */
    await expect(canvas.queryByText('Getting started')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Guides')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Appointments API' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument();

    // The GitHub link is outside the branch and survives - the only navigation
    // left in the sidebar leaves the app entirely.
    await expect(canvas.getByRole('link', { name: 'Edit on GitHub' })).toBeInTheDocument();

    /* The article does not react to the search at all. Whatever was open stays
       open behind an empty rail, which is what makes this state recoverable
       without a reload. */
    await expect(canvas.getByRole('heading', { name: 'Appointments' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A plain-prose query, which is how a reader who does not already know the section ' +
          'names searches. "No matches" is a bare line in the rail with no clear-search ' +
          'affordance next to it - the only way out is to edit the field.',
      },
    },
  },
};

export const NavFiltered: Story = {
  name: 'Search matching one section',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(searchBox(canvasElement), 'api');

    /* "Appointments API" and "Patients API" match; the Guides section filters to
       zero items and is dropped whole, heading included. That second rule is the
       one worth seeing - a section can disappear while its sibling stays. */
    await waitFor(() => {
      expect(canvas.queryByText('Guides')).not.toBeInTheDocument();
    });
    await expect(canvas.getByText('Getting started')).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('.DocsNavItem')).toHaveLength(2);
    await expect(
      [...canvasElement.querySelectorAll('.DocsNavItem')].map((item) => item.textContent)
    ).toEqual(['Appointments API', 'Patients API']);
    await expect(canvas.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument();
    await expect(canvas.queryByText('No matches')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The in-between state. Matching is a case-insensitive `includes` on the label only, ' +
          'so "api" keeps two items whose titles contain it and drops "Authentication", which ' +
          'is unambiguously an API topic.',
      },
    },
  },
};

export const SeedContentArticle: Story = {
  name: 'Non-appointments article (seed content)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Companions' }));

    const heading = await canvas.findByRole('heading', { name: 'Companions' });
    await expect(heading).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'This reference is seed content. Open the full documentation for the complete API reference.'
      )
    ).toBeInTheDocument();

    /* Everything appointments-specific unmounts together: the endpoint strip, the
       required-fields paragraph, the FHIR note and BOTH code panels. Most
       articles land here, so this - not the appointments page - is the layout a
       reader most often sees. */
    await expect(canvas.queryByText('POST')).not.toBeInTheDocument();
    await expect(canvas.queryByText('REQUEST · cURL')).not.toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('pre')).toHaveLength(0);

    /* The breadcrumb does follow the selection, and it is read off its own element
       rather than by text: "Getting started" and "Companions" both also exist as nav
       labels, so a text query would match the rail and pass with the crumb stale. */
    const crumb = canvasElement.querySelector('.DocsBreadcrumb');
    if (!crumb) throw new Error('The breadcrumb did not render.');
    await expect(crumb.textContent).toBe('Docs / APIs / Companions');
    await expect(canvas.getByText('v1')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The article column collapses to roughly a third of its height here because ' +
          '`DocsCode` is gone, so the page bottom moves a long way up between two adjacent nav ' +
          'items. Worth reviewing next to the appointments story rather than on its own.',
      },
    },
  },
};
