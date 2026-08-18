import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
import UniversalSearchPalette from './UniversalSearchPalette';
import { useUniversalSearchStore } from '../../../stores/universalSearchStore';
import { useFormsStore } from '../../../stores/formsStore';
import type { FormsProps } from '../../../features/forms/types/forms';
import {
  getJsonStorageItem,
  removeStorageItem,
  setJsonStorageItem,
} from '../../../lib/browserStorage';

/** Mirrors the palette's own (unexported) localStorage key for the Recent list. */
const RECENTS_STORAGE_KEY = 'yc_universal_search_recents';

type RecentEntry = { title: string; href: string };

const seedRecents = (entries: RecentEntry[]) => {
  const previous = getJsonStorageItem<RecentEntry[]>('local', RECENTS_STORAGE_KEY);
  setJsonStorageItem('local', RECENTS_STORAGE_KEY, entries);
  return () => {
    if (previous) setJsonStorageItem('local', RECENTS_STORAGE_KEY, previous);
    else removeStorageItem('local', RECENTS_STORAGE_KEY);
  };
};

/**
 * Records come straight out of the client stores — the palette itself fetches
 * nothing. Forms are the cheapest module to seed, so they stand in for real
 * results here.
 */
const SEEDED_FORMS = [
  {
    _id: 'form-1',
    name: 'Surgical Consent',
    category: 'Consent form',
    description: 'Signed before any procedure under general anaesthetic',
    status: 'Published',
  },
  {
    _id: 'form-2',
    name: 'Boarding Consent & Emergency Contact',
    category: 'Consent form',
    description: 'Overnight stays, including emergency treatment authorisation',
    status: 'Draft',
  },
] as unknown as FormsProps[];

const seedForms = () => {
  const previousFormsState = useFormsStore.getState();
  useFormsStore.setState({
    formsById: Object.fromEntries(SEEDED_FORMS.map((form) => [String(form._id), form])),
    formIds: SEEDED_FORMS.map((form) => String(form._id)),
  });
  return () => {
    useFormsStore.setState(previousFormsState);
  };
};

/**
 * The palette closes itself in a mount effect (it clears on every route
 * change), so seeding `isOpen` up front would be undone immediately. A parent's
 * effect runs after its children's, which makes this the one place the palette
 * can be opened and stay open.
 */
const OpenPalette = () => {
  useEffect(() => {
    useUniversalSearchStore.getState().open();
    return () => useUniversalSearchStore.getState().close();
  }, []);

  return <UniversalSearchPalette />;
};

const meta = {
  title: 'Layout/UniversalSearch',
  component: UniversalSearchPalette,
  parameters: {
    layout: 'fullscreen',
    // usePathname/useRouter at render — needs the App Router mock.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The ⌘K command palette. A single overlay over the whole app that searches patients, appointments, tasks, ' +
          'invoices, forms and inventory out of the client stores (it issues no requests of its own), plus a trailing ' +
          '"Search in IDEXX Hub" action. Empty query shows the recently opened records over a fixed "Jump to" route list; ' +
          'typing swaps that for grouped results in a fixed module order. Desktop renders a centered dialog behind a ' +
          'backdrop; below 768px it becomes the full-height phone sheet with a Cancel button instead of ESC.',
      },
    },
  },
  render: () => <OpenPalette />,
} satisfies Meta<typeof UniversalSearchPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Empty query. "Recent" lists the last three records opened from the palette
 * (read from localStorage), and "Jump to" holds the seven routes, two of which
 * carry G-D / G-A keycaps. The first row is highlighted and shows the ↵ keycap.
 */
export const EmptyQuery: Story = {
  beforeEach: () =>
    seedRecents([
      { title: 'Bella Fischer', href: '/companions?companionId=c-1' },
      { title: 'Invoice INV-2043', href: '/finance?invoiceId=inv-2043' },
    ]),
};

/**
 * Fills the search field. The palette focuses *and selects* its input on a
 * short timer after opening, so per-keystroke typing races that timer and loses
 * part of the string. Waiting for the focus to land and then setting the value
 * in one change event is what makes the query deterministic.
 */
const typeQuery = async (query: string) => {
  const input = await within(document.body).findByLabelText<HTMLInputElement>(
    'Universal search input'
  );
  await waitFor(() => expect(input).toHaveFocus());
  await fireEvent.change(input, { target: { value: query } });
  await waitFor(() => expect(input).toHaveValue(query));
};

/** Typed query with matches: grouped results plus the IDEXX action in "Actions". */
export const WithResults: Story = {
  beforeEach: () => seedForms(),
  play: () => typeQuery('consent'),
};

/**
 * A query nothing matches. The palette does not render a "no results" message —
 * the IDEXX hand-off is always offered, so "Actions" is the only group left.
 */
export const NoMatches: Story = {
  play: () => typeQuery('microchip audit'),
};

/**
 * Phone. Below 768px the dialog becomes a full-height sheet with a status bar,
 * a Cancel button in place of ESC, and the home indicator.
 */
export const Phone: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: () => seedRecents([{ title: 'Bella Fischer', href: '/companions?companionId=c-1' }]),
};
