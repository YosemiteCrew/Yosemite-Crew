import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { IoSearchOutline } from 'react-icons/io5';

import WorkspaceSearchResultRow from './WorkspaceSearchResultRow';

const Badge = ({ label }: { label: string }) => (
  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-caption-2 font-medium text-text-brand">
    {label}
  </span>
);

/**
 * An ATCvet class path: the origin line opens with its group, so two sibling
 * classes truncate to the same visible text and only the title tells them apart.
 */
const LONG_NAME = 'Amoxicillin and beta-lactamase inhibitor 250 mg/62.5 mg tablets for dogs';
const LONG_ORIGIN = 'QJ01CR02 - ANTIBACTERIALS FOR SYSTEMIC USE - Combinations of penicillins';

/** The row is an `<li>`; every workspace search bar renders it inside a results `<ul>`. */
const InResultsList = (Story: React.ComponentType) => (
  <ul
    aria-label="Search results"
    className="w-[420px] max-w-full overflow-hidden rounded-2xl border border-card-border bg-neutral-0 py-1"
  >
    <Story />
  </ul>
);

const meta = {
  title: 'Workspace/WorkspaceSearchResultRow',
  component: WorkspaceSearchResultRow,
  decorators: [InResultsList],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The one result row every AppointmentWorkspace search bar renders - services and ' +
          'packages, medicines, SOAP templates, the summary step - so they share a single ' +
          'structure: leading icon, name over an optional origin line, a source badge, and a ' +
          'right-aligned price / stock / status column.\n\n' +
          'Two behaviours are invisible at rest. The name and the origin both `truncate`, and ' +
          'the origin is the line that loses meaning when it clips - an ATCvet class path opens ' +
          'with its group, so two sibling classes read identically once cut. The full string ' +
          'stays in the DOM for assistive tech and is repeated as `title` for a sighted hover, ' +
          'but only while the row is enabled: a disabled row swaps that title for its ' +
          '`disabledReason`, which is the more useful thing to say about a row that cannot be ' +
          'picked.\n\n' +
          'The badge and meta are `shrink-0` against the `min-w-0 flex-1` name column, so a ' +
          'long name gives up width rather than pushing the price out of the panel.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    name: 'Consultation - 30 min',
    badge: <Badge label="Service" />,
    meta: '€65.00',
    onSelect: fn(),
  },
} satisfies Meta<typeof WorkspaceSearchResultRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Service: Story = {
  name: 'Service with price',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole('button');
    await expect(row).toHaveTextContent('Consultation - 30 min');
    await expect(row).toHaveTextContent('Service');
    await expect(row).toHaveTextContent('€65.00');
    // The default leading affordance is the plus glyph.
    await expect(row.querySelector('svg')).not.toBeNull();

    await userEvent.click(row);
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
  },
};

export const PackageComponent: Story = {
  name: 'Package component with origin line',
  args: {
    name: 'Dental radiographs',
    origin: 'Dental scale and polish',
    badge: <Badge label="Package" />,
    meta: 'Included',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const origin = canvas.getByText('Dental scale and polish');
    await expect(origin).toBeInTheDocument();
    // The origin sits UNDER the name, as a second line, not beside it.
    await expect(origin.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      canvas.getByText('Dental radiographs').getBoundingClientRect().bottom - 1
    );
    // Enabled rows repeat both lines as hover titles.
    await expect(canvas.getByText('Dental radiographs')).toHaveAttribute(
      'title',
      'Dental radiographs'
    );
    await expect(origin).toHaveAttribute('title', 'Dental scale and polish');
  },
};

export const Medication: Story = {
  name: 'Medication with stock meta',
  args: {
    name: 'Meloxicam 1.5 mg/ml oral suspension',
    badge: <Badge label="Medication" />,
    meta: '12 in stock',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Meloxicam 1.5 mg/ml oral suspension')).toBeInTheDocument();
    await expect(canvas.getByText('12 in stock')).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  name: 'Disabled with a reason',
  args: {
    name: 'Consultation - 30 min',
    disabled: true,
    disabledReason: 'Added',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole('button');
    await expect(row).toBeDisabled();
    /* The reason is both visible text and the button's own title, and the name
       loses its hover title so the two do not fight over the tooltip. */
    await expect(row).toHaveAttribute('title', 'Added');
    await expect(canvas.getByText('Added')).toBeInTheDocument();
    await expect(canvas.getByText('Consultation - 30 min')).not.toHaveAttribute('title');

    await userEvent.click(row);
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

export const CustomLeadingIcon: Story = {
  name: 'Search glyph instead of plus',
  args: {
    name: 'Dermatology consult template',
    leadingIcon: <IoSearchOutline aria-hidden="true" className="shrink-0" />,
    badge: <Badge label="Template" />,
    meta: undefined,
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button');
    await expect(row.querySelector('svg')).not.toBeNull();
    await expect(row).toHaveTextContent('Dermatology consult template');
  },
};

export const NoLeadingIcon: Story = {
  name: 'No leading icon',
  args: { leadingIcon: null },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button');
    // `null` removes the affordance rather than rendering an empty slot.
    await expect(row.querySelector('svg')).toBeNull();
  },
};

export const LongName: Story = {
  name: 'Long name and origin truncate',
  args: {
    name: LONG_NAME,
    origin: LONG_ORIGIN,
    badge: <Badge label="Medication" />,
    meta: '40 in stock',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByText(LONG_NAME);
    const origin = canvas.getByText(LONG_ORIGIN);

    for (const line of [name, origin]) {
      const style = getComputedStyle(line);
      await expect(style.textOverflow).toBe('ellipsis');
      await expect(style.whiteSpace).toBe('nowrap');
      // Genuinely clipped, not merely styled to clip.
      await expect(line.scrollWidth).toBeGreaterThan(line.clientWidth);
      // The full text survives for hover and assistive tech.
      await expect(line).toHaveAttribute('title', line.textContent ?? '');
    }
    // The meta column kept its width; the name is what gave way.
    const row = canvas.getByRole('button');
    await expect(canvas.getByText('40 in stock').getBoundingClientRect().right).toBeLessThanOrEqual(
      row.getBoundingClientRect().right
    );
  },
};

export const ResultsList: Story = {
  name: 'Several rows in one panel',
  render: (args) => (
    <>
      <WorkspaceSearchResultRow {...args} />
      <WorkspaceSearchResultRow
        {...args}
        name="Dental scale and polish"
        badge={<Badge label="Package" />}
        meta="€180.00"
      />
      <WorkspaceSearchResultRow
        {...args}
        name="Dental radiographs"
        origin="Dental scale and polish"
        badge={<Badge label="Package" />}
        meta="Included"
      />
      <WorkspaceSearchResultRow
        {...args}
        name="Nail clip"
        disabled
        disabledReason="Added"
        meta="€12.00"
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole('button');
    await expect(rows).toHaveLength(4);
    await expect(rows[3]).toBeDisabled();
    // Every row is a full-width button, so the hit target is the row rather than the name.
    const widths = rows.map((row) => Math.round(row.getBoundingClientRect().width));
    await expect(new Set(widths).size).toBe(1);
  },
};
