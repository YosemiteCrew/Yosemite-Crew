import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { useOrgStore } from '@/app/stores/orgStore';
import CompanionsTable from './CompanionsTable';

const ORG_ID = 'org-companions-table-story';

const ROSTER: Array<[string, string, string, string]> = [
  ['Kizie', 'Doe', 'Beagle', 'dog'],
  ['Bailey', 'Lang', 'Labrador retriever', 'dog'],
  ['Nala', 'Ferreira', 'Ragdoll', 'cat'],
  ['Ollie', 'Nowak', 'Border collie', 'dog'],
  ['Pepper', 'Haddad', 'Domestic shorthair', 'cat'],
  ['Rufus', 'Ibrahim', 'Cocker spaniel', 'dog'],
  ['Suki', 'Vasquez', 'Bengal', 'cat'],
  ['Tilly', 'Okafor', 'Whippet', 'dog'],
  ['Waffles', 'Brenner', 'Dachshund', 'dog'],
  ['Yuki', 'Sorensen', 'Siberian', 'cat'],
  ['Zephyr', 'Marchetti', 'Andalusian', 'horse'],
  ['Comet', 'Whitfield', 'Shetland pony', 'horse'],
];

const companion = (index: number): CompanionParent => {
  const [name, lastName, breed, type] = ROSTER[index];
  return {
    companion: {
      id: `companion-${index + 1}`,
      organisationId: ORG_ID,
      parentId: `parent-${index + 1}`,
      name,
      type: type as CompanionParent['companion']['type'],
      breed,
      dateOfBirth: new Date('2021-06-14T00:00:00.000Z'),
      gender: index % 2 === 0 ? 'female' : 'male',
      isInsured: false,
      status: index % 5 === 4 ? 'archived' : 'active',
    },
    parent: {
      id: `parent-${index + 1}`,
      firstName: ['Sky', 'Marta', 'Ana', 'Piotr', 'Yara', 'Sami'][index % 6],
      lastName,
      email: `owner${index + 1}@example.com`,
      address: {},
      createdFrom: 'pms',
    },
  };
};

const TWELVE = ROSTER.map((_, index) => companion(index));
const FOUR = TWELVE.slice(0, 4);

/** A second registered parent, which draws the `+ CO-PARENT` marker. */
const withCoParent = (item: CompanionParent): CompanionParent => ({
  ...item,
  companion: {
    ...item.companion,
    parentLinks: [{ role: 'CO_PARENT', status: 'ACTIVE' }],
  } as CompanionParent['companion'],
});

/**
 * Seeds only the primary organisation id, and a unique one.
 *
 * It is not decoration: `useCompanionTerminologyText` falls back to a
 * localStorage-backed PENDING term when there is no org id at all, so an
 * unseeded story would render "Patient"/"Pet" columns and footers depending on
 * what another story wrote to localStorage earlier in the session. With an org id
 * and no org record the terminology resolves to the COMPANION default every time.
 * Nothing here touches the network - the last-visit lookup reads the appointment
 * store, which has nothing for this org.
 */
const seedOrg = () => {
  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
};

/**
 * The footer caption, present whenever the list is not empty.
 *
 * Matched on its own text rather than by position: the caption is a bare `<span>`
 * among dozens of other spans in the rows above it, and the anchored pattern
 * cannot collide with the preview decorator's sr-only `<h1>`.
 */
const footerText = (canvas: ReturnType<typeof within>): string | undefined =>
  canvas.queryByText(/^Showing \d/)?.textContent?.trim();

const rowCount = (canvas: ReturnType<typeof within>): number =>
  canvas.queryAllByRole('button', { name: 'Companion row actions' }).length;

const headerOf = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('.yc-table-head') as HTMLElement;

/**
 * The header's resolved grid tracks.
 *
 * `GRID_COLS` declares SIX columns and adds a seventh (Patient ID) only at `xl`,
 * while the header always renders seven spans - the extra one is `hidden xl:block`,
 * a DOM child either way. So the child count alone cannot tell the two layouts
 * apart, and the stories that assert seven tracks have to pin a width above 1280
 * or they are asserting whatever the preview panel happened to be.
 */
const headerTracks = (canvasElement: HTMLElement): string[] =>
  getComputedStyle(headerOf(canvasElement)).gridTemplateColumns.trim().split(/\s+/);

const meta = {
  title: 'Tables/CompanionsTable',
  component: CompanionsTable,
  parameters: {
    layout: 'fullscreen',
    // Row actions and the name button push through next/navigation's router.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The companion directory table, and specifically **its own pager** - not the shared ' +
          '`GenericTable` one. This table pages in local state at a fixed 10 rows, clamps the ' +
          'effective page during render (so a filter that shrinks the list never flashes an empty ' +
          'slice), and draws a footer the other tables do not have: a left-aligned ' +
          '`Showing 1-10 of 12 companions` count with a numbered rail on the right.\n\n' +
          'Almost none of that had ever been rendered. The rail is gated on `totalPages > 1`, so ' +
          'any story with a short fixture shows a bare count line; page 2, a disabled Previous and ' +
          'a disabled Next exist only after a click; and the whole footer disappears when the list ' +
          'is empty.\n\n' +
          'Note the two different asymmetries. The rail is `totalPages > 1`, but the FOOTER is ' +
          '`filteredList.length > 0` - so a single page of results still gets a count line with ' +
          'nothing next to it, and an empty list gets no footer at all rather than "Showing 0 of ' +
          '0". Below 768 the table becomes a card list, which now takes the same paged slice and ' +
          'the same footer - it used to render every companion at once with no count at all, ' +
          'which the phone story below is here to show.\n\n' +
          'The noun in the count is the org’s companion terminology, so it reads "patients" for a ' +
          'hospital and "animals" for a breeder.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: TWELVE,
    setActiveCompanion: fn(),
    setViewCompanion: fn(),
    setCompanionInfoInitialLabel: fn(),
    setBookAppointment: fn(),
    setAddTask: fn(),
    setChangeStatusPopup: fn(),
    canEditAppointments: true,
    canEditTasks: true,
    canEditCompanions: true,
  },
  beforeEach: seedOrg,
  decorators: [
    (Story) => (
      <div className="h-[560px] w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompanionsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {
  name: 'Pager, first page of two',
  /* Pinned as a GLOBAL at 1440, not 1280: the Patient ID column is `hidden
     xl:block` and `GRID_COLS` grows its seventh track at exactly 1280, so at the
     laptop preset a preview scrollbar decides how many columns this story is
     about. `parameters.viewport.defaultViewport` was removed in Storybook 10 and
     would render the panel width regardless. */
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Ten of twelve on screen, and the count line says exactly that.
    await expect(rowCount(canvas)).toBe(10);
    await expect(footerText(canvas)).toBe('Showing 1-10 of 12 companions');

    /* The rail: two numbered buttons and no third, so the page count is derived
       from the list rather than fixed. `aria-current` is the only thing marking
       the active page for a screen reader - the rest is a background wash. */
    const page1 = canvas.getByRole('button', { name: 'Page 1' });
    await expect(page1).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByRole('button', { name: 'Page 2' })).not.toHaveAttribute(
      'aria-current'
    );
    await expect(canvas.queryByRole('button', { name: 'Page 3' })).not.toBeInTheDocument();

    // The steppers are rendered and DISABLED at the ends, not hidden.
    await expect(canvas.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Next page' })).toBeEnabled();

    /* Seven header cells AND seven resolved tracks: the last cell is an empty
       spacer over the kebab column, and the Patient ID cell only earns a track
       above 1280. Both numbers are asserted because either one alone passes on a
       layout that dropped the other. */
    const header = headerOf(canvasElement);
    await expect(header.children).toHaveLength(7);
    await expect(headerTracks(canvasElement)).toHaveLength(7);
    await expect(within(header).getByText('Last visit')).toBeInTheDocument();
    await expect(within(header).getByText('Patient ID')).toBeVisible();

    // Page one is the first ten of the roster, so the eleventh is not on it.
    await expect(canvas.getByText('Kizie · Doe')).toBeInTheDocument();
    await expect(canvas.queryByText('Zephyr · Marchetti')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Twelve companions at the fixed page size of ten. The last-visit column reads `-` for ' +
          'every row here because the appointment store is empty for this org, which is also what ' +
          'a genuinely new practice sees.',
      },
    },
  },
};

export const SecondPage: Story = {
  name: 'Pager, page two',
  // 1440 for the seven-column layout, as in the first story above.
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Page 2' }));

    // The remainder page: two rows, and the range moves rather than the total.
    await waitFor(() => expect(footerText(canvas)).toBe('Showing 11-12 of 12 companions'));
    await expect(rowCount(canvas)).toBe(2);
    await expect(canvas.getByText('Zephyr · Marchetti')).toBeInTheDocument();
    await expect(canvas.getByText('Comet · Whitfield')).toBeInTheDocument();
    await expect(canvas.queryByText('Kizie · Doe')).not.toBeInTheDocument();

    // Both ends flip together - this is the frame no static snapshot contained.
    await expect(canvas.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(canvas.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute(
      'aria-current'
    );
    await expect(canvas.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Next page' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The disabled Next is the detail worth looking at: it keeps its border and only drops to ' +
          '40% opacity, so at a glance the rail looks the same as it does on page one.',
      },
    },
  },
};

export const SinglePage: Story = {
  name: 'One page - count, no rail',
  // 1440 for the seven-column layout, as in the first story above.
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: { filteredList: FOUR },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The count line stays; everything to the right of it is gone.
    await expect(footerText(canvas)).toBe('Showing 1-4 of 4 companions');
    await expect(rowCount(canvas)).toBe(4);
    await expect(canvas.queryByRole('button', { name: 'Page 1' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Previous page' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What most practices see. The footer keeps its full height and border for one lonely ' +
          'sentence, which is the layout decision this frame exists to expose.',
      },
    },
  },
};

export const NoCompanions: Story = {
  name: 'Empty - no footer at all',
  // 1440 for the seven-column layout, as in the first story above.
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: { filteredList: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('No patients yet')).toBeVisible();
    // Not "Showing 0-0 of 0": the whole footer is gated on the list being
    // non-empty, so the empty table has no count line and no border above it.
    await expect(footerText(canvas)).toBeUndefined();
    await expect(rowCount(canvas)).toBe(0);
    // The header row survives at full width, so the columns are still readable
    // with no rows under them.
    await expect(headerOf(canvasElement).children).toHaveLength(7);
    await expect(headerTracks(canvasElement)).toHaveLength(7);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A filter that matches nothing. The empty message is a plain centred sentence inside the ' +
          'scroll area rather than the shared `NoDataMessage` card the `GenericTable` pages use - ' +
          'two different empty states in one product.',
      },
    },
  },
};

export const PhoneCards: Story = {
  name: 'Phone: paged cards',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert, and `useIsPhone` reads a real media query - so
  // the wrong spelling here would silently draw the desktop table.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Ten of twelve, and the same count line the table draws. This branch used
       to map the whole `filteredList`, so a large directory mounted every card
       at once and the phone user never saw the total. */
    await waitFor(() => expect(canvas.getAllByTitle('Open companion history')).toHaveLength(10));
    await expect(footerText(canvas)).toBe('Showing 1-10 of 12 companions');
    await expect(canvas.queryByText('Comet · Whitfield')).not.toBeInTheDocument();

    // The rail pages the cards exactly as it pages the rows above 768.
    await userEvent.click(canvas.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(footerText(canvas)).toBe('Showing 11-12 of 12 companions'));
    await expect(canvas.getAllByTitle('Open companion history')).toHaveLength(2);
    await expect(canvas.getByText('Comet · Whitfield')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Next page' })).toBeDisabled();

    // And no kebabs: the phone card is a single tap target onto the history page.
    await expect(rowCount(canvas)).toBe(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          '`useIsPhone` is false during SSR and the first client render and flips after mount, so ' +
          'this is a post-mount swap into a completely different tree - not a CSS breakpoint. The ' +
          'pager rides along into that tree: same page size, same footer, same numbered rail, ' +
          'wrapped onto more than one line when the directory is long enough to need it.',
      },
    },
  },
};

export const GridCoParent: Story = {
  name: 'Grid view, co-parented patient',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: { viewMode: 'grid', filteredList: [withCoParent(TWELVE[0]), TWELVE[1]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The grid card used to drop this marker while the table row and the phone
       card both drew it, so grid view never showed a second registered parent -
       information that matters for consent and billing. */
    await expect(canvas.getByText('+ CO-PARENT')).toBeVisible();
    await expect(canvas.getAllByText('+ CO-PARENT')).toHaveLength(1);
    await expect(canvas.getByText('Kizie · Doe')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Grid and list are a toggle on the same screen, so the two cards have to carry the same ' +
          'markers. Only the first patient here has a co-parent, which is why exactly one pill is ' +
          'asserted.',
      },
    },
  },
};
