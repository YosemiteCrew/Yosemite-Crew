import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { PackageRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import PackagesTab from './PackagesTab';

const ORG_ID = 'org-avenger-park';
const SPECIALITY_ID = 'spec-dentistry';

/**
 * Dental care package: 72 + (310 - 10%) + (120 x 2) = 591 after item discounts,
 * less the 5% package discount = 561.45, printed as `$561` (formatMoney rounds to
 * whole units). The org has no subscription seeded, so `useCurrencyForPrimaryOrg`
 * falls back to USD - which is what every amount below is asserted in.
 */
const DENTAL: PackageRevamp = {
  id: 'pkg-dental-care',
  code: 'PKG-DEN-01',
  name: 'Dental care package',
  description:
    'Consultation, scale and polish under general anaesthetic, and a full-mouth radiograph.',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  durationText: '2 h 15 min',
  isBookable: true,
  isInpatientPreferred: true,
  leadCount: 1,
  supportCount: 2,
  additionalDiscount: 5,
  breakdown: [
    {
      id: 'bd-1',
      code: 'DEN-001',
      type: 'CONSULTATION',
      name: 'Dental consultation',
      unitPrice: 72,
      quantity: 1,
      discount: 0,
    },
    {
      id: 'bd-2',
      code: 'DEN-014',
      type: 'PROCEDURE',
      name: 'Scale and polish under general anaesthetic',
      unitPrice: 310,
      quantity: 1,
      discount: 10,
    },
    {
      id: 'bd-3',
      code: 'DEN-032',
      type: 'LAB',
      name: 'Dental radiograph (full mouth)',
      unitPrice: 120,
      quantity: 2,
      discount: 0,
    },
  ],
  status: 'ACTIVE',
  createdAt: '2026-05-04T09:00:00.000Z',
};

/** 64 + (145 - 20%) = 180, no package discount, and a deliberately empty description. */
const SENIOR: PackageRevamp = {
  id: 'pkg-senior-wellness',
  code: 'PKG-DEN-02',
  name: 'Senior wellness bundle',
  description: '',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  durationText: '45 min',
  isBookable: false,
  isInpatientPreferred: false,
  leadCount: 1,
  supportCount: 0,
  additionalDiscount: 0,
  breakdown: [
    {
      id: 'bd-4',
      code: 'GER-004',
      type: 'CONSULTATION',
      name: 'Geriatric consultation',
      unitPrice: 64,
      quantity: 1,
      discount: 0,
    },
    {
      id: 'bd-5',
      code: 'LAB-221',
      type: 'LAB',
      name: 'Senior blood panel',
      unitPrice: 145,
      quantity: 1,
      discount: 20,
    },
  ],
  status: 'ACTIVE',
  createdAt: '2026-05-06T11:30:00.000Z',
};

/**
 * Seeds the real store instead of mocking the catalog service.
 *
 * `loadSpecialityCatalog` returns on its first line when `loadedSpecialityIds`
 * already holds the key it is about to fetch, and the key is
 * `<specialityId>:active` for a non-archive load - so seeding that one string is
 * what keeps the mount off the network. Nothing else is stubbed: the store, the
 * tab and the card are all the real ones.
 *
 * Both packages carry a populated `breakdown` for the same reason. Toggling a
 * breakdown open on a package that has none calls `hydratePackageDetail`, which
 * does go to the API.
 */
const seed = (packages: PackageRevamp[] = [DENTAL, SENIOR]) => {
  useRevampCatalogStore.setState({
    packages,
    loadedSpecialityIds: [`${SPECIALITY_ID}:active`],
  });
};

const wideGrids = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll('[style*="grid-template-columns"]')] as HTMLElement[];

const tracksOf = (element: HTMLElement) =>
  getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/);

const meta = {
  title: 'Organization/PackagesTab',
  component: PackagesTab,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The packages tab of one speciality, and specifically the **`PackageCard`** inside it - ' +
          'module-private, so it is driven through the exported tab rather than exported for the ' +
          'sake of a story. That costs one store seed and nothing else.\n\n' +
          'The card has three states no static snapshot reaches. Its layout is **container-queried**: ' +
          'a five-track single row at `@2xl` and up, a two-column stack below it, with the three ' +
          'circular actions moving from the right edge to a row above the data. Its **breakdown ' +
          'table** is collapsed except on the first card, where it opens on mount. And its archive ' +
          'action opens a **confirmation dialog that portals to `document.body`**, so it is not ' +
          'inside `canvasElement` at all.\n\n' +
          'Both grids exist in the DOM at every width - one of them is always `display: none` - so ' +
          'every label and every amount is in the document twice. The stories below read computed ' +
          'track counts off whichever grid is actually visible, because a dropped or malformed ' +
          '`gridTemplateColumns` collapses silently to a single column and looks like a design ' +
          'choice.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    specialityId: SPECIALITY_ID,
    organisationId: ORG_ID,
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
} satisfies Meta<typeof PackagesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cards: Story = {
  name: 'Package cards (wide container)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText('Dental care package')).toBeInTheDocument();
    await expect(canvas.getByText('Senior wellness bundle')).toBeInTheDocument();

    /* Five fields, five tracks, on the grid that carries the template inline:
       `auto minmax(0,220px) auto auto auto`. Only the description track is
       constrained, because it is the only field allowed to wrap (line-clamp-2);
       the other four are `whitespace-nowrap` and size to their content. Lose the
       template and all five stack into one column, which still looks deliberate. */
    const [dentalGrid, seniorGrid] = wideGrids(canvasElement);
    await expect(tracksOf(dentalGrid)).toHaveLength(5);
    await expect(dentalGrid.children).toHaveLength(5);
    await expect(within(dentalGrid).getByText('PKG-DEN-01')).toBeInTheDocument();
    await expect(within(dentalGrid).getByText('2 h 15 min')).toBeInTheDocument();
    await expect(within(dentalGrid).getByText('5%')).toBeInTheDocument();
    await expect(within(dentalGrid).getByText('$561')).toBeInTheDocument();

    // An empty description is an em dash, not a blank cell - the label would
    // otherwise sit over nothing and read as a rendering failure.
    await expect(within(seniorGrid).getByText('—')).toBeInTheDocument();
    await expect(within(seniorGrid).getByText('$180')).toBeInTheDocument();

    /* Badges are per-package, not decoration: only the dental package is bookable
       and in-patient preferred, so the second card carries none. */
    await expect(canvas.getByText('Bookable')).toBeInTheDocument();
    await expect(canvas.getByText('In-patient')).toBeInTheDocument();

    // Actions sit to the right of the data at this width. One accessible copy of
    // each - the narrow row exists but is `display: none`.
    const edit = canvas.getByRole('button', { name: 'Edit Dental care package' });
    await expect(canvas.getAllByRole('button', { name: /^Edit / })).toHaveLength(2);
    await expect(edit.getBoundingClientRect().left).toBeGreaterThan(
      dentalGrid.getBoundingClientRect().right - 1
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two packages at page width. The first card opens its breakdown on mount - that is a real ' +
          'rule in the component (`index === 0 && breakdown.length > 0`), not a story setting - so ' +
          'the tab always leads with one fully expanded costing.',
      },
    },
  },
};

export const BreakdownExpanded: Story = {
  name: 'Breakdown table (toggled open)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', {
      name: 'View breakdown of Senior wellness bundle',
    });

    await userEvent.click(toggle);

    // The label is the state: it flips to "Hide", and the chevron rotates 180deg -
    // read after the 150ms transform transition rather than in the same frame.
    const hide = await canvas.findByRole('button', {
      name: 'Hide breakdown of Senior wellness bundle',
    });
    await waitFor(() => {
      const icon = hide.querySelector('svg') as SVGElement;
      expect(getComputedStyle(icon).transform).toBe('matrix(-1, 0, 0, -1, 0, 0)');
    });

    /* Assert the table it revealed, not that a flag flipped. Eight columns with
       `editable={false}` (a ninth actions column appears only in the editor), one
       row per breakdown item, and the footer total agreeing with the card's own
       "Total amount" - both are computed from the same items, so a divergence here
       is a real arithmetic bug rather than a formatting one. */
    const table = canvasElement.querySelectorAll('table')[1] as HTMLTableElement;
    await expect(table.querySelectorAll('thead th')).toHaveLength(8);
    await expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    await expect(within(table).getByText('Senior blood panel')).toBeInTheDocument();
    await expect(within(table).getByText('-20%')).toBeInTheDocument();
    await expect(within(table).getByText('Total cost')).toBeInTheDocument();
    await expect(within(table).getByText('$180')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The costing behind a package: unit price, quantity, gross, the per-item discount and the ' +
          'net, then the package-level discount and the total. It is the read-only form - the same ' +
          'table renders quantity and discount as inputs inside the package editor, with a ninth ' +
          'column of remove buttons.',
      },
    },
  },
};

export const ActionTooltip: Story = {
  name: 'Card action tooltip',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', {
      name: 'View breakdown of Senior wellness bundle',
    });

    /* Opened through the shared helper, which re-dispatches until the bubble
       appears. GlassTooltip binds `mouseenter` natively inside an effect, and a
       play function routinely starts before that effect has flushed - a single
       `userEvent.hover` lands on an element with no listener and is lost, leaving
       a green story that proved nothing. */
    const bubble = await openGlassTooltip(toggle);
    /* Exact, not `toHaveTextContent`, which is a substring match and would pass on
       the button's own name. That is the distinction this story exists to hold:
       the tooltip says "View breakdown" and the accessible name says which package
       it belongs to, and the two are allowed to drift apart only in that
       direction. */
    await expect(bubble.textContent).toBe('View breakdown');
    await expect(toggle).toHaveAccessibleName('View breakdown of Senior wellness bundle');
    // One bubble, not one-or-more: a leftover from an earlier trigger portals to
    // the same body and would read as a success here.
    await expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1);

    await closeGlassTooltip(toggle);
    await expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The three card actions are icon-only, so the tooltip is the only place their meaning is ' +
          "written down. The text is not the button's accessible name: the name is scoped to the " +
          'package ("View breakdown of Senior wellness bundle") so a screen reader user can tell the ' +
          'cards apart, while the tooltip stays short.',
      },
    },
  },
};

export const NarrowContainer: Story = {
  name: 'Narrow container (side drawer)',
  decorators: [
    (Story) => (
      <div className="min-h-[560px] w-[420px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText('Dental care package')).toBeInTheDocument();

    /* Below `@2xl` the single row becomes a two-column stack of five cells, with
       the description spanning both. The count matters as much as the template:
       two tracks and five children is the stack; two tracks and four children
       would mean a field silently vanished. */
    const narrowGrid = canvasElement.querySelector('.grid-cols-2') as HTMLElement;
    await expect(tracksOf(narrowGrid)).toHaveLength(2);
    await expect(narrowGrid.children).toHaveLength(5);

    const description = within(narrowGrid).getByText('Description').parentElement as HTMLElement;
    await expect(getComputedStyle(description).gridColumnStart).toBe('span 2');

    // Duration is a field of its own here. In the wide row it sits third; the two
    // grids carry the same five fields in a different order, which is why both are
    // in the DOM rather than one being reflowed.
    await expect(within(narrowGrid).getByText('2 h 15 min')).toBeInTheDocument();

    /* The actions move above the data. Still exactly one accessible copy of each -
       the wide row is `display: none` - and it now sits ABOVE the grid rather than
       to its right, which is the whole point of the second row existing. */
    const edit = canvas.getByRole('button', { name: 'Edit Dental care package' });
    await expect(canvas.getAllByRole('button', { name: /^Edit / })).toHaveLength(2);
    await expect(edit.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      narrowGrid.getBoundingClientRect().top
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same card in a narrow container - what it looks like inside a side drawer rather than ' +
          'on the page. The width here is set on the wrapper, not by the viewport: the breakpoint is ' +
          "a container query against the card's own `@container`, so a narrow browser window would " +
          'not reproduce it and a wide one cannot hide it.',
      },
    },
  },
};

export const ArchiveConfirmation: Story = {
  name: 'Archive confirmation (portalled)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = () => document.querySelector('dialog[open]');
    await expect(dialog()).toBeNull();

    await userEvent.click(
      await canvas.findByRole('button', { name: 'Archive Dental care package' })
    );

    /* The dialog portals to `document.body`, so nothing it renders is inside
       `canvasElement` - a query against the canvas finds nothing and, worse, the
       "closed at rest" check above would pass for the same reason rather than
       because the dialog was closed. Closed is also not unmounted here: the
       element keeps its place in the DOM without the `open` attribute. */
    await waitFor(() => expect(dialog()).not.toBeNull());
    const panel = within(dialog() as HTMLElement);
    await expect(panel.getByRole('heading', { name: 'Archive package' })).toBeInTheDocument();
    await expect(panel.getByText('Dental care package')).toBeInTheDocument();
    await expect(panel.getByText(/restore it later from the/)).toBeInTheDocument();

    // Cancel then Archive, side by side in a two-track grid: the destructive one is
    // second, so it is never the button under the cursor when the dialog opens.
    const actions = panel.getByText('Cancel').closest('.grid') as HTMLElement;
    await expect(tracksOf(actions)).toHaveLength(2);
    await expect(actions.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Archiving is confirmed, not immediate, and the copy says what archiving actually does - ' +
          'the package leaves the active lists and the package builder but stays restorable from the ' +
          'Archive tab. Confirming calls the store, so this story stops at the open dialog.',
      },
    },
  },
};
