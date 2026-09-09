import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import DocsSearch from './DocsSearch';
import type { SearchDoc } from './searchIndex';
import './docs.css';

const INDEX_URL = '/docs/search-index.json';

/**
 * A small stand-in for the real 52-page, 108 KB corpus - just enough to show
 * the two rules the component's own header comment claims: a title hit
 * outranks a body hit, and every term in the query has to match or the
 * document drops out entirely (so a second word can remove a result the
 * first word matched on its own).
 */
const DOCS: SearchDoc[] = [
  {
    title: 'User API',
    href: '/docs/apps/backend/routers/user',
    section: 'Backend API',
    text: 'requireWebAuth guards every route. UserController.getById returns the caller organisationId scoped profile.',
  },
  {
    title: 'Organisation settings',
    href: '/docs/apps/backend/routers/organisation',
    section: 'Backend API',
    text: 'Update the name, address and billing details for an organisation. Calls the organisationId scoped endpoints.',
  },
  {
    title: 'Design tokens',
    href: '/docs/ui-system/design-tokens',
    section: 'UI System',
    text: 'Colour, spacing and radius variables that back every warm-bone surface in the frontend.',
  },
  {
    title: 'Rate limits',
    href: '/docs/policies/rate-limits',
    section: 'Policies',
    text: 'Every API key is capped at 600 requests per minute; user endpoints share a lower per-user budget.',
  },
];

/**
 * The whole index is one `fetch(INDEX_URL)`, so the stories stub
 * `globalThis.fetch` the way the rest of the suite does (see
 * Footer.stories.tsx) - capture the real one, answer only this URL, and fall
 * through to it (and so to the Storybook offline guard) for anything else.
 */
const withIndex = (docs: SearchDoc[]) => () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith(INDEX_URL)) {
      return Promise.resolve(
        new Response(JSON.stringify(docs), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return original.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
  };
};

/** Never settles, so `docs` stays null and the panel reads its "Loading" line. */
const withPendingIndex = () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith(INDEX_URL)) return new Promise<Response>(() => {});
    return original.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
  };
};

/** A 500. The component's `.then` throws on a non-ok response and its `.catch` turns that into `loadFailed`. */
const withFailingIndex = () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith(INDEX_URL)) {
      return Promise.resolve(
        new Response('', { status: 500, statusText: 'Internal Server Error' })
      );
    }
    return original.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
  };
};

const searchbox = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('combobox', { name: 'Search the documentation' });

const meta = {
  title: 'Docs/DocsSearch',
  component: DocsSearch,
  parameters: {
    layout: 'centered',
    // Results render as next/link, which wants the App Router mock mounted.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Client-side search for the documentation site. The index is a prerendered JSON route, ' +
          'fetched once on first focus rather than on mount, so a reader who never searches never ' +
          'pays for it - it is 108 KB for the whole 52-page corpus.\n\n' +
          "Matching is deliberately simple: every term in the query must appear in a document's " +
          'title or body text, or that document is dropped entirely, so a second word can remove a ' +
          'result the first word matched on its own. A title hit outranks a body hit (10 points ' +
          'against 1), ties break alphabetically by title, and the list is capped at 8 results. ' +
          'There is no scoring library behind any of this - the corpus is small enough that it does ' +
          'not need one.\n\n' +
          'The results panel only opens once there is text to show it for; focusing an empty field ' +
          'starts the fetch but shows nothing. A mousedown outside the component closes the panel ' +
          'without clearing what was typed, and selecting a result does the same.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: withIndex(DOCS),
} satisfies Meta<typeof DocsSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Title outranks a body hit',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = searchbox(canvasElement);
    await userEvent.click(input);
    await userEvent.type(input, 'user');

    const options = await canvas.findAllByRole('option');
    // "User API" matches in its title (10 points); "Rate limits" only matches
    // in its body text ("user endpoints", 1 point) - and still outranks it,
    // despite alphabetical order putting "Rate limits" first.
    await expect(options).toHaveLength(2);
    await expect(options[0]).toHaveTextContent('User API');
    await expect(options[1]).toHaveTextContent('Rate limits');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
  },
};

export const NarrowsWithASecondTerm: Story = {
  name: 'A second term narrows the match',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = searchbox(canvasElement);
    await userEvent.click(input);
    // "organisation" alone would also match "Organisation settings" - adding
    // "user" drops it, since every term has to appear on a surviving document.
    await userEvent.type(input, 'user organisation');

    const options = await canvas.findAllByRole('option');
    await expect(options).toHaveLength(1);
    await expect(options[0]).toHaveTextContent('User API');
  },
};

export const NoMatches: Story = {
  name: 'No matches',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = searchbox(canvasElement);
    await userEvent.click(input);
    await userEvent.type(input, 'radiograph');

    await expect(await canvas.findByText('No matches for “radiograph”.')).toBeVisible();
    await expect(canvas.queryAllByRole('option')).toHaveLength(0);
  },
};

export const LoadingTheIndex: Story = {
  name: 'Loading the index',
  beforeEach: withPendingIndex,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = searchbox(canvasElement);
    await userEvent.click(input);
    await userEvent.type(input, 'user');

    await expect(await canvas.findByText('Loading…')).toBeVisible();
    await expect(canvas.queryAllByRole('option')).toHaveLength(0);
  },
};

export const IndexUnavailable: Story = {
  name: 'Index could not be loaded',
  beforeEach: withFailingIndex,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = searchbox(canvasElement);
    await userEvent.click(input);
    await userEvent.type(input, 'user');

    await expect(
      await canvas.findByText('Search is unavailable right now. Use the sidebar to browse.')
    ).toBeVisible();
    await expect(canvas.queryAllByRole('option')).toHaveLength(0);
  },
};

export const SelectingAResultCloses: Story = {
  name: 'Selecting a result closes the panel',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = searchbox(canvasElement);
    await userEvent.click(input);
    await userEvent.type(input, 'user');

    const options = await canvas.findAllByRole('option');
    await userEvent.click(options[0]);

    // The panel closes on selection; the typed query is left in the field.
    await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
    await expect(input).toHaveValue('user');
  },
};
