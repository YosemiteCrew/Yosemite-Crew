import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { ServiceRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import ServicesTab from './ServicesTab';

const ORG_ID = 'org-avenger-park';
const SPECIALITY_ID = 'spec-dentistry';

const service = (over: Partial<ServiceRevamp> = {}): ServiceRevamp => ({
  id: 'svc-1',
  code: 'DEN-001',
  name: 'Dental consultation',
  description: 'Oral exam, charting and a treatment plan.',
  type: 'CONSULTATION',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  grossAmount: 72,
  defaultDiscount: 0,
  maxDiscount: 20,
  durationMinutes: 30,
  isBookable: true,
  isInpatientPreferred: false,
  status: 'ACTIVE',
  createdAt: '2026-05-04T09:00:00.000Z',
  ...over,
});

const SERVICES: ServiceRevamp[] = [
  service(),
  service({
    id: 'svc-2',
    code: 'DEN-014',
    name: 'Scale and polish under general anaesthetic',
    description: 'Full mouth scale, polish and post-op analgesia.',
    type: 'PROCEDURE',
    grossAmount: 310,
    defaultDiscount: 12.5,
    maxDiscount: 25,
    durationMinutes: 90,
    isInpatientPreferred: true,
  }),
  service({
    id: 'svc-3',
    code: 'DEN-032',
    name: 'Dental radiograph (full mouth)',
    description: '',
    type: 'LAB',
    grossAmount: 120,
    durationMinutes: 20,
    isBookable: false,
  }),
];

const PRACTITIONERS = [
  { id: 'p-1', name: 'Dr. Elena Marsh' },
  { id: 'p-2', name: 'Dr. Ravi Patel' },
  { id: 'p-3', name: 'Tom Reyes' },
  { id: 'p-4', name: 'Priya Raman' },
];

/**
 * Seeds the real store rather than mocking it.
 *
 * `loadSpecialityCatalog` returns at its first line when the key is already in
 * `loadedSpecialityIds`, so seeding that key is what keeps the mount off the network -
 * no service stub, and the component under review is the real one.
 */
const seed = (services: ServiceRevamp[] = SERVICES) => {
  useRevampCatalogStore.setState({
    services,
    loadedSpecialityIds: [`${SPECIALITY_ID}:active`],
  });
};

const meta = {
  title: 'Organization/ServicesTab',
  component: ServicesTab,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The services table of one speciality. Its rows carry two surfaces that only exist ' +
          'after a click, and neither had ever been drawn: the **row kebab menu** and the ' +
          '**expanded detail grid**.\n\n' +
          'Both are module-private, so they are driven through the exported tab rather than ' +
          'exported for the sake of a story. That costs a store seed and nothing else - ' +
          '`loadSpecialityCatalog` bails out on its first line once the speciality key is in ' +
          '`loadedSpecialityIds`, so the real store, the real component and no network.\n\n' +
          'The layout is **container-queried, not viewport-queried**. The seven-column table is ' +
          '`hidden @3xl:grid` and the stacked card is `@3xl:hidden`, both resolving against the ' +
          "tab's own `@container`. A story that renders this in a narrow box shows only the " +
          'stacked form however wide the browser is, which is why the width is set on the ' +
          'wrapper here rather than left to the viewport.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    specialityId: SPECIALITY_ID,
    organisationId: ORG_ID,
    specialityName: 'Dentistry',
    practitioners: PRACTITIONERS,
  },
  decorators: [
    (Story) => (
      <div className="min-h-[560px] w-[1100px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    seed();
  },
} satisfies Meta<typeof ServicesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Table: Story = {
  name: 'Service table',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* TWO nodes per service, not one. Each row renders the wide table form and the
       stacked card form side by side and lets a container query hide one - so every
       name, price and kebab exists twice in the DOM at every width. `getByText` does
       not filter on `display`, so it is `getAllByText` here; a role query sees only
       one, because `hidden` takes the other out of the accessibility tree. Worth
       knowing before writing any more queries against this table. */
    expect(await canvas.findAllByText('Dental consultation')).toHaveLength(2);
    await expect(
      canvas.getAllByRole('button', { name: 'Actions for Dental consultation' })
    ).toHaveLength(1);

    /* Seven header cells and seven tracks. This is a CSS grid pretending to be a
       table, so nothing enforces that agreement - a template with six tracks and
       seven children silently wraps the last one onto a second line, and the
       `44px` action column is the one that would go. */
    const header = canvasElement.querySelector('.yc-table-head') as HTMLElement;
    await expect(header.children).toHaveLength(7);
    await expect(getComputedStyle(header).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(7);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting table at container width. Duration and price are right-aligned and ' +
          '`tabular-nums`, so the digits line up down the column rather than drifting.',
      },
    },
  },
};

export const RowMenuOpen: Story = {
  name: 'Row kebab menu (open)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const kebab = (await canvas.findAllByRole('button', { name: /^Actions for / }))[0];
    await expect(kebab).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(kebab);
    await expect(kebab).toHaveAttribute('aria-expanded', 'true');

    // Assert the panel drew its two rows, not merely that the flag flipped.
    const edit = await canvas.findByRole('button', { name: 'Edit' });
    const archive = await canvas.findByRole('button', { name: 'Archive' });
    await expect(edit).toBeInTheDocument();
    /* Archive is the destructive one and is the only item tinted --danger-text.
       Read it after the transition rather than in the same frame: these rows carry
       `transition-colors`, so a single read can catch an interpolated value. */
    await waitFor(() => {
      expect(getComputedStyle(archive).color).not.toBe(getComputedStyle(edit).color);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two rows, absolutely positioned under the trigger at `top-8`, on `--screen` with a ' +
          '`--hairline` border. It is not portalled, so it is clipped by any scrolling ancestor - ' +
          'and it closes on blur as well as Escape, which is why the menu items rather than the ' +
          'wrapper carry the key handler.',
      },
    },
  },
};

export const RowMenuClosesOnEscape: Story = {
  name: 'Row kebab closes on Escape',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const kebab = (await canvas.findAllByRole('button', { name: /^Actions for / }))[0];
    await userEvent.click(kebab);
    expect(await canvas.findByRole('button', { name: 'Archive' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(canvas.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    });
    await expect(kebab).toHaveAttribute('aria-expanded', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Escape is handled on the three native controls, not on the positioning wrapper - the ' +
          'wrapper has no interactive semantics of its own, and focus is always on one of the ' +
          'buttons while the menu is open.',
      },
    },
  },
};

export const RowExpanded: Story = {
  name: 'Row detail (expanded)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = (await canvas.findAllByRole('button', { expanded: false }))[0];
    await expect(canvas.queryByText('Max disc.')).not.toBeInTheDocument();

    await userEvent.click(name);

    // The detail grid is four columns at this container width, not two.
    const label = await canvas.findByText('Max disc.');
    const grid = label.closest('.grid') as HTMLElement;
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
    await expect(canvas.getByText('Code')).toBeInTheDocument();
    await expect(canvas.getByText('Description')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The eight verbose catalogue fields the design keeps out of the row: code, type, gross, ' +
          'total, both discounts, in-patient preference and the full description, which spans the ' +
          'whole width. Two columns in a narrow container, four at `@3xl`.',
      },
    },
  },
};

export const EmptyState: Story = {
  name: 'No services',
  beforeEach: () => {
    seed([]);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText(/No services/i)).toBeInTheDocument();
    /* Empty is not the same as loading, and the copy alone cannot tell them apart:
       assert the loader has gone AND that no row survived, since a filter bug that
       hid every row would render this same sentence. */
    await expect(canvas.queryByLabelText('Loading services')).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button', { name: /^Actions for / })).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Loaded and genuinely empty, which is a different state from loading: the loader shows ' +
          'only while `loadedSpecialityIds` lacks this speciality, so both are reachable with the ' +
          'same empty list.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading',
  beforeEach: () => {
    // No key in loadedSpecialityIds - the state before the catalog answers.
    useRevampCatalogStore.setState({ services: [], loadedSpecialityIds: [] });
  },
  parameters: {
    docs: {
      description: {
        story:
          "The inline loader. `loading` is derived from the absence of this speciality's key " +
          'rather than from a flag, so it is the same condition that triggers the fetch.',
      },
    },
  },
};
