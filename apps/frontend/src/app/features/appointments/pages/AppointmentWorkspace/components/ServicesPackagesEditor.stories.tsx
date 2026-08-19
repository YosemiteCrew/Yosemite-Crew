import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { LineItem } from '@/app/features/appointments/types/workspace';
import ServicesPackagesEditor from './ServicesPackagesEditor';

const WELLNESS = 'Senior wellness package';
const DENTAL = 'Dental package - grade 2';

const PACKAGE: LineItem = {
  id: 'line-wellness',
  refId: 'pkg-senior-wellness',
  kind: 'PACKAGE',
  name: WELLNESS,
  qty: 1,
  instructions: 'Annual senior screen',
  unitPriceCents: 24_000,
  amountCents: 21_600,
  breakdown: [
    {
      id: 'brk-exam',
      name: 'Physical examination',
      qty: 1,
      instructions: 'Service',
      unitPriceCents: 6_000,
      amountCents: 6_000,
    },
    {
      id: 'brk-bloods',
      name: 'Senior blood panel',
      qty: 1,
      instructions: 'Diagnostic',
      unitPriceCents: 12_000,
      discountPercent: 10,
      discountCents: 1_200,
      amountCents: 10_800,
    },
    {
      id: 'brk-urine',
      name: 'Urinalysis',
      qty: 2,
      instructions: 'Diagnostic',
      unitPriceCents: 2_400,
      amountCents: 4_800,
    },
  ],
};

/** A second package, so the exclusivity of `expandedPackageId` is observable. */
const SECOND_PACKAGE: LineItem = {
  id: 'line-dental',
  refId: 'pkg-dental-2',
  kind: 'PACKAGE',
  name: DENTAL,
  qty: 1,
  instructions: 'Scale, polish, two extractions',
  unitPriceCents: 31_000,
  amountCents: 31_000,
  breakdown: [
    {
      id: 'brk-ga',
      name: 'General anaesthesia (45 min)',
      qty: 1,
      instructions: 'Procedure',
      unitPriceCents: 14_000,
      amountCents: 14_000,
    },
    {
      id: 'brk-extraction',
      name: 'Extraction - single rooted',
      qty: 2,
      instructions: 'Procedure',
      unitPriceCents: 8_500,
      amountCents: 17_000,
    },
  ],
};

const SERVICE: LineItem = {
  id: 'line-consult',
  refId: 'svc-consult',
  kind: 'SERVICE',
  name: 'Consultation - 30 min',
  qty: 1,
  instructions: 'Outpatient',
  unitPriceCents: 9_000,
  amountCents: 9_000,
};

/** A package the catalogue promised a breakdown for and did not deliver. */
const EMPTY_PACKAGE: LineItem = {
  id: 'line-empty',
  refId: 'pkg-empty',
  kind: 'PACKAGE',
  name: 'Puppy starter package',
  qty: 1,
  instructions: 'Bundled at booking',
  unitPriceCents: 12_000,
  amountCents: 12_000,
  breakdown: [],
};

/**
 * The USED column tracks of a grid element - five above `sm:`, one below it.
 *
 * `getComputedStyle(...).gridTemplateColumns` resolves to used track sizes on a
 * laid-out grid container, never to the authored keywords, so a collapsed row
 * reports a single pixel width rather than `none`.
 */
const tracks = (el: HTMLElement) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/);

const meta = {
  title: 'Workspace/ServicesPackagesEditor',
  component: ServicesPackagesEditor,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The Treatment step's services and packages table. Its rows are ordinary enough; the " +
          'surface that had never been drawn is the **inline Breakdown**, a nested ' +
          '`SectionContainer` that only a package row can open and only through the dark ' +
          'eye/eye-off button on that row.\n\n' +
          'It is worth rendering because of how it lines up. The breakdown deliberately repeats no ' +
          "headings of its own: its rows reuse the parent's `ROW_GRID` template " +
          '(`sm:grid-cols-[1.6fr_100px_1.4fr_110px_120px]`) so the component names sit under Name, ' +
          'the quantities under Qty. and the amounts under Amount. Nothing enforces that ' +
          'agreement - the two grids are separate elements that happen to share a constant - so a ' +
          'change to one silently misaligns the other, and only a rendered story shows it.\n\n' +
          'Two edges are drawn as well: `expandedPackageId` is a single id, so opening one ' +
          'breakdown closes the other; and the block is gated on `expanded && breakdown.length > ' +
          '0`, so a package whose breakdown came back empty toggles its own icon and renders ' +
          'nothing at all.\n\n' +
          'Below 640px the shared template collapses to one column and the Instructions and Amount ' +
          'headings are `hidden`, so the alignment the breakdown depends on does not exist at ' +
          'phone width. That is its own story.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    items: [SERVICE, PACKAGE, SECOND_PACKAGE],
    catalogItems: [],
    readOnly: false,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onRemoveItem: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[900px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ServicesPackagesEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BreakdownExpanded: Story = {
  name: 'Package breakdown expanded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Breakdown')).not.toBeInTheDocument();
    // Only packages carry the toggle: the service row has no eye button.
    await expect(canvas.getAllByRole('button', { name: /breakdown$/ })).toHaveLength(2);

    await userEvent.click(canvas.getByRole('button', { name: `View ${WELLNESS} breakdown` }));

    expect(await canvas.findByText('Breakdown')).toBeInTheDocument();

    // The three component rows, with their own quantities and amounts.
    await expect(canvas.getByText('Physical examination')).toBeInTheDocument();
    await expect(canvas.getByText('Senior blood panel')).toBeInTheDocument();
    await expect(canvas.getByText('Urinalysis')).toBeInTheDocument();
    await expect(canvas.getByText('x2')).toBeInTheDocument();
    // Discounted component: 12000 gross less 10% renders as the NET 108, not 120.
    await expect(canvas.getByText('$108')).toBeInTheDocument();

    /* The alignment contract. The headings and the breakdown rows are separate
       elements that only agree because they share one string constant, so both the
       track count and the child count have to hold on both sides - five children
       against four tracks wraps the last cell onto a second line rather than
       erroring. The pixel widths are deliberately NOT compared: the breakdown sits
       inside a nested SectionContainer with its own padding, so its fr tracks
       resolve against a narrower box than the headings do. */
    const headings = canvasElement.querySelector('.yc-table-head') as HTMLElement;
    const componentRow = canvas.getByText('Physical examination').parentElement as HTMLElement;
    await expect(tracks(headings)).toHaveLength(5);
    await expect(tracks(componentRow)).toHaveLength(5);
    await expect(headings.children).toHaveLength(5);
    await expect(componentRow.children).toHaveLength(5);
  },
  parameters: {
    docs: {
      description: {
        story:
          'One package opened. The nested container is `bg-neutral-0` on the card, titled ' +
          '"Breakdown", and its rows carry no borders of their own - the alignment with the ' +
          'headings above is the only thing telling a reader which number is which.',
      },
    },
  },
};

export const BreakdownIsExclusive: Story = {
  name: 'Opening one breakdown closes the other',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `View ${WELLNESS} breakdown` }));
    expect(await canvas.findByText('Senior blood panel')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: `View ${DENTAL} breakdown` }));

    // One breakdown at a time, and it is the second package's content now.
    await waitFor(() => {
      expect(canvas.queryByText('Senior blood panel')).not.toBeInTheDocument();
    });
    await expect(canvas.getAllByText('Breakdown')).toHaveLength(1);
    await expect(canvas.getByText('General anaesthesia (45 min)')).toBeInTheDocument();
    await expect(canvas.getByText('Extraction - single rooted')).toBeInTheDocument();

    /* The icon and the accessible name both swap on the open row, so the two
       toggles are never in the same state - which is the only visual cue that the
       first package closed. */
    await expect(
      canvas.getByRole('button', { name: `Hide ${DENTAL} breakdown` })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: `View ${WELLNESS} breakdown` })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`expandedPackageId` holds one id, not a set. Two packages can never be open together, ' +
          'which is easy to miss when every row has its own button.',
      },
    },
  },
};

export const EmptyBreakdownRendersNothing: Story = {
  name: 'Package with an empty breakdown',
  args: { items: [EMPTY_PACKAGE] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'View Puppy starter package breakdown' });
    await userEvent.click(toggle);

    /* The row is expanded - the icon flipped and the label changed - but the block
       is gated on `expanded && breakdown.length > 0`, so nothing appears. From the
       clinician's side the button simply does not work. Drawn so the dead state is
       visible rather than inferred from the source. */
    expect(
      await canvas.findByRole('button', { name: 'Hide Puppy starter package breakdown' })
    ).toBeInTheDocument();
    await expect(canvas.queryByText('Breakdown')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A package whose components came back empty. Nothing distinguishes its toggle from a ' +
          'working one until it is pressed, and pressing it produces no visible change beyond the ' +
          'icon.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No items',
  args: { items: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No services or packages added yet.')).toBeInTheDocument();
    // The headings belong to the populated branch, so they go with the rows.
    await expect(canvasElement.querySelector('.yc-table-head')).toBeNull();
    // Adding stays available even with nothing in the list.
    await expect(
      canvas.getByRole('searchbox', { name: 'Search for services and packages' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The empty list. The search bar sits outside the container and is never gated on ' +
          '`readOnly`, because locking is per item (billed) rather than per section.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the shared grid collapses',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `View ${WELLNESS} breakdown` }));
    expect(await canvas.findByText('Breakdown')).toBeInTheDocument();

    /* `ROW_GRID` only sets its five tracks at `sm:` (640px), so below that both the
       parent rows and the breakdown rows are a single stacked column - and the
       headings row is `hidden sm:block` entirely. The alignment the breakdown
       relies on does not exist here, which is why the components read as a plain
       list at this width. */
    const componentRow = canvas.getByText('Physical examination').parentElement as HTMLElement;
    /* Still a grid, but a one-track one. `grid-template-columns` resolves to the
       USED track sizes on a laid-out grid container, so the single implicit column
       reports a pixel width ('193px' at this viewport) rather than the `none` the
       cascade holds - `none` comes back only from an element that is not a grid at
       all, which is a different failure and an invisible one. Asserting `display`
       first is what keeps the one-track count from passing on such an element. */
    await expect(getComputedStyle(componentRow).display).toBe('grid');
    const rowTracks = tracks(componentRow);
    await expect(rowTracks).toHaveLength(1);
    await expect(rowTracks[0]).toMatch(/^\d+(\.\d+)?px$/);
    await expect(componentRow.children).toHaveLength(5);
    // The headings row is `hidden sm:block`, so there is nothing to align against.
    const headings = canvasElement.querySelector('.yc-table-head') as HTMLElement;
    await expect(getComputedStyle(headings.parentElement as HTMLElement).display).toBe('none');
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the Instructions and Amount cells still render (they are `hidden sm:block` on ' +
          'the headings but not on the breakdown rows), so each component stacks its own name, ' +
          'quantity and amount. Worth a look: it is a different reading order from the desktop ' +
          'table, not a narrower version of it.',
      },
    },
  },
};
