import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { PhoneRecordDetails } from './PhoneCompanionRecord';

/**
 * The exact six rows `PhoneCompanionRecord` builds, in the order it builds them.
 *
 * The page does not hand this component a hand-written list: it runs
 * `buildCompanionDetails` and then keeps whichever of its nine details match
 * `['Blood Group', 'Microchip ID', 'Allergies', 'Age / DOB', 'Weight', <patient id label>]`.
 * `flatMap` preserves the source order rather than the filter order, which is why
 * Patient ID leads and Blood Group sits fourth. Reordering the filter array would
 * change nothing on screen - worth knowing before anyone "fixes" the order there.
 *
 * The patient-ID label is whatever `replaceCompanionText('Patient ID')` returns,
 * so a practice that renames companions to patients (or the reverse) renames this
 * row too. It is spelled out here rather than left as 'Patient ID' by accident.
 */
const ROWS = [
  { label: 'Patient ID', value: 'YC-4471-POPPY' },
  { label: 'Age / DOB', value: '6 yrs 2 mos · 14 Mar 2020' },
  { label: 'Weight', value: '11.4 kg' },
  { label: 'Blood Group', value: 'DEA 1.1 negative' },
  { label: 'Microchip ID', value: '981020034512789' },
  { label: 'Allergies', value: 'Cephalosporins; poultry protein' },
];

const meta = {
  title: 'CompanionHistory/PhoneRecordDetails',
  component: PhoneRecordDetails,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The collapsible secondary-details drawer on the bespoke phone companion record. It ' +
          'had never been drawn, and it could not be: it is a module-private component whose ' +
          'open state is a local `useState(false)`, inside a screen that only mounts below ' +
          '768px, below a history timeline that needs the appointment, task and audit services ' +
          'to render at all. It is exported now so the open state can be reviewed without ' +
          'standing up that whole page.\n\n' +
          'Two things are worth looking at rather than reading past.\n\n' +
          'The trigger promises three fields - "microchip, insurance, blood group" - and the ' +
          'drawer has never contained an insurance row. `buildCompanionDetails` produces nine ' +
          'details and none of them is insurance, so the caller cannot pass one; the subtitle ' +
          'names a field the component has no way to show.\n\n' +
          'The rows are a `grid-cols-[100px_minmax(0,1fr)]` pair, not a flex row with a gap. ' +
          'The label column is a hard 100px at every width, so on a 375px screen a long label ' +
          'wraps inside its own column rather than pushing the value off the right edge - and ' +
          'the value column is `minmax(0,1fr)` with `break-words`, which is what keeps a ' +
          '15-digit microchip number from widening the whole sheet.',
      },
    },
  },
  tags: ['autodocs'],
  args: { rows: ROWS },
  // Pinned as a global: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and would render this phone sheet at full panel width while
  // still passing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [
    (Story) => (
      <div className="min-h-[420px] bg-[var(--screen)] px-[18px] py-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneRecordDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The chevron element inside the disclosure trigger. */
const chevron = (canvasElement: HTMLElement): SVGElement => {
  const icon = canvasElement.querySelector('button svg');
  if (!icon) throw new Error('No chevron inside the disclosure trigger.');
  return icon as SVGElement;
};

/**
 * The chevron's own rotation, read after `transition-transform` has settled.
 *
 * Read off the standalone `rotate` property, NOT off `transform`. Tailwind v4
 * compiles `rotate-180` to `rotate: 180deg` rather than to a `transform`
 * function, so a flipped chevron computes `transform: none` and
 * `rotate: 180deg`. Asserting `matrix(-1, 0, 0, -1, 0, 0)` was therefore reading
 * a property this component never sets, on an element that really was upside
 * down - a failure about the test, not about the chevron.
 *
 * The flip is still animated: v4 expands `transition-transform` to
 * `transition-property: transform, translate, scale, rotate`, so a synchronous
 * read can land on an interpolated angle and these are polled.
 */
const chevronRotation = (canvasElement: HTMLElement): string =>
  getComputedStyle(chevron(canvasElement)).rotate;

export const Collapsed: Story = {
  name: 'Collapsed (resting)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { expanded: false });

    /* The whole trigger line, not just the subtitle fragment: the bold "Details"
       and the lighter subtitle are two spans in one row, and reading the button's
       own text is what catches a wrap or a lost separator between them. The
       subtitle names insurance, which the open story shows is never there. */
    await expect(toggle.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Details · microchip, insurance, blood group'
    );

    // Closed means UNMOUNTED here, not hidden: the `<dl>` is behind a ternary, so
    // none of the six values exists in the DOM to be found by a search or a screen
    // reader while the drawer is shut.
    await expect(canvasElement.querySelector('dl')).toBeNull();
    await expect(canvas.queryByText('981020034512789')).not.toBeInTheDocument();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A single full-width `--inset` pill, 12.5px bold label plus a lighter subtitle on one ' +
          'line, chevron right-aligned. Nothing announces how many fields are inside.',
      },
    },
  },
};

export const Expanded: Story = {
  name: 'Expanded (six rows)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { expanded: false });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const list = await waitFor(() => {
      const el = canvasElement.querySelector('dl');
      if (!el) throw new Error('The details list did not mount.');
      return el;
    });

    // Six rows, in the order `buildCompanionDetails` emits them.
    await expect(list.children).toHaveLength(6);
    await expect([...list.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
      'Patient ID',
      'Age / DOB',
      'Weight',
      'Blood Group',
      'Microchip ID',
      'Allergies',
    ]);
    await expect(canvas.getByText('981020034512789')).toBeInTheDocument();
    await expect(canvas.getByText('Cephalosporins; poultry protein')).toBeInTheDocument();

    /* The trigger says "microchip, insurance, blood group". There is no insurance
       row and there is no way for the caller to supply one, so the subtitle is
       advertising a field the drawer cannot contain. */
    await expect(canvas.queryByText('Insurance')).not.toBeInTheDocument();

    /* One column for the list, two tracks per row, and the label track is a hard
       100px. `display` is asserted first on purpose: a non-grid element reports
       `grid-template-columns: none`, which splits to one entry and would have made
       the single-track check below pass on an element that had lost its grid
       entirely. A single-track ROW would mean the label/value pair had collapsed
       into a stack, which looks deliberate enough that nobody would report it. */
    await expect(getComputedStyle(list).display).toBe('grid');
    const listTracks = getComputedStyle(list).gridTemplateColumns.trim().split(/\s+/);
    await expect(listTracks).toHaveLength(1);
    await expect(listTracks[0]).toMatch(/^\d+(\.\d+)?px$/);
    const firstRow = list.children[0] as HTMLElement;
    const tracks = getComputedStyle(firstRow).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(2);
    await expect(tracks[0]).toBe('100px');
    await expect(firstRow.children).toHaveLength(2);

    /* The chevron is upside down. The utility class is asserted next to the
       computed angle on purpose: together they separate "the flip was never
       asked for" from "it was asked for and did not resolve", which a single
       read of either one cannot. */
    await expect(chevron(canvasElement).getAttribute('class')).toContain('rotate-180');
    await waitFor(() => {
      expect(chevronRotation(canvasElement)).toBe('180deg');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The open drawer. Values are bold `--ink` against `--ink-faint` labels, and the value ' +
          'column carries `break-words` so a microchip number or a two-drug allergy list wraps ' +
          'instead of widening the sheet past the 375px screen.',
      },
    },
  },
};

export const CollapsesAgain: Story = {
  name: 'Collapses on a second tap',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { expanded: false });

    await userEvent.click(toggle);
    const bloodGroup = await canvas.findByText('DEA 1.1 negative');
    await expect(bloodGroup).toBeInTheDocument();

    await userEvent.click(toggle);
    await waitFor(() => {
      expect(canvasElement.querySelector('dl')).toBeNull();
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    /* Back to no rotation at all. The class is the exact half of this - it is gone
       or it is not - and the computed angle is the half that proves the flip
       actually unwound rather than sticking at 180deg. Either spelling of zero is
       accepted: which of `none` and `0deg` a browser reports for an unrotated
       element is not part of this component's contract, and 180deg fails both. */
    await expect(chevron(canvasElement).getAttribute('class')).not.toContain('rotate-180');
    await waitFor(() => {
      expect(chevronRotation(canvasElement)).toMatch(/^(none|0deg)$/);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same button is the close affordance - there is no separate dismiss - so the ' +
          'chevron flipping back is the only feedback that the tap registered. Asserting the ' +
          'computed `rotate` returns to `none` is what separates "closed" from "the rows ' +
          'unmounted but the chevron stayed upside down".',
      },
    },
  },
};

export const SingleRow: Story = {
  name: 'One row (sparse record)',
  args: {
    rows: [{ label: 'Patient ID', value: 'YC-9902-BRAMBLE' }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { expanded: false }));

    const list = await waitFor(() => {
      const el = canvasElement.querySelector('dl');
      if (!el) throw new Error('The details list did not mount.');
      return el;
    });
    await expect(list.children).toHaveLength(1);
    await expect([...list.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
      'Patient ID',
    ]);
    await expect([...list.querySelectorAll('dd')].map((dd) => dd.textContent)).toEqual([
      'YC-9902-BRAMBLE',
    ]);

    /* The common real case, and the one the copy handles worst: a record with no
       microchip, no blood group and no allergies still opens a drawer that
       promises all three. `buildCompanionDetails` renders a missing value as '-',
       and the page keeps those rows, so a sparse companion gets a list of dashes
       rather than a shorter list. */
    await expect(canvas.getByText('· microchip, insurance, blood group')).toBeInTheDocument();
    await expect(canvas.queryByText('Microchip ID')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The page hides the drawer entirely when `detailRows` is empty, but not when it is ' +
          'nearly empty. One row still gets the full pill and the full subtitle, which is the ' +
          'shape a newly registered companion lands in.',
      },
    },
  },
};
