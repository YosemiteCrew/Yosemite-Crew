import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import PastItemsList, { type PastItem } from './PastItemsList';

const SOAP_DETAIL = (
  <div className="flex flex-col gap-1">
    <p>
      <strong>S:</strong> Owner reports intermittent lameness on the left hind limb after exercise.
    </p>
    <p>
      <strong>O:</strong> Grade 2/4 lameness, mild effusion of the stifle, no crepitus. T 38.4, HR
      96, RR 24.
    </p>
    <p>
      <strong>A:</strong> Suspected partial cranial cruciate ligament tear.
    </p>
    <p>
      <strong>P:</strong> NSAID course, strict rest for 14 days, recheck with radiographs.
    </p>
  </div>
);

const ITEMS: PastItem[] = [
  {
    id: 'soap-1',
    title: 'By Dr. Tim Apple',
    date: '12 Mar 2026',
    time: '09:30',
    detail: SOAP_DETAIL,
  },
  {
    id: 'soap-2',
    title: 'By Dr. Ravi Menon',
    date: '04 Feb 2026',
    time: '14:15',
    detail: 'Annual wellness exam. No abnormalities detected. Weight stable at 12.4kg.',
  },
  {
    id: 'soap-3',
    title: 'By Priya Raman',
    date: '19 Dec 2025',
    time: '11:00',
  },
];

const meta = {
  title: 'Workspace/PastItemsList',
  component: PastItemsList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The generic read-only "All <X>" history block reused across the appointment workspace ' +
          'for SOAP notes, results, services and invoices. The list itself is unremarkable; the ' +
          'part that had never been drawn is the **expanded detail block**, which lives on `open` ' +
          "state private to the internal `PastRow` and is reachable only by clicking that row's eye " +
          'button.\n\n' +
          'That makes it exactly the kind of surface that shipped four production bugs on this ' +
          'branch: markup that no snapshot, no unit test and no story ever contained, because it ' +
          'does not exist until someone interacts. Nothing had ever composited an open detail with ' +
          'the row above it or the row below it.\n\n' +
          'Two things are only checkable with a row open. First, the detail is rendered as a ' +
          'sibling *inside* the same `<li>` as the row, above the `border-b border-card-border` ' +
          'that separates entries - so an expanded row grows its own band rather than pushing text ' +
          'across the divider. Second, the detail takes `pb-4 text-body-4 leading-[150%] ' +
          "text-text-secondary`, a deliberately quieter ink than the row title's " +
          '`text-text-primary`, and it accepts arbitrary `ReactNode`, so a multi-paragraph SOAP body ' +
          'and a one-line string have to read as the same block.\n\n' +
          'The eye button also swaps both its glyph (`IoEyeOutline` to `IoEyeOffOutline`) and its ' +
          'accessible name (`View <title>` to `Hide <title>`), which is the only affordance telling ' +
          'a screen-reader user the row is already open. A row with no `detail` renders no button ' +
          'at all rather than a dead one.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'All SOAP notes',
    items: ITEMS,
  },
} satisfies Meta<typeof PastItemsList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  name: 'All rows collapsed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The detail is genuinely absent, not merely hidden - the resting DOM has none of it.
    await expect(canvas.queryByText(/Suspected partial cranial cruciate/)).not.toBeInTheDocument();
    // The third row carries no `detail`, so it must not offer an eye button.
    await expect(
      canvas.queryByRole('button', { name: 'View By Priya Raman' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting list: title, date and time columns in `--pill-success-text`, and an eye ' +
          'button only on the rows that actually have something to show.',
      },
    },
  },
};

export const Expanded: Story = {
  name: 'Row expanded (detail block)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'View By Dr. Tim Apple' }));
    // Assert the detail block has its real content, not just that the button relabelled -
    // the weaker check passes on an empty panel, which is how a regression stays invisible.
    await expect(
      await canvas.findByText(/Suspected partial cranial cruciate ligament tear/)
    ).toBeInTheDocument();
    await expect(canvas.getByText(/Grade 2\/4 lameness/)).toBeInTheDocument();
    // The glyph and the accessible name both flip; only the name is assertable.
    await expect(canvas.getByRole('button', { name: 'Hide By Dr. Tim Apple' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The surface this file exists for. A four-paragraph SOAP body opens inside the first ' +
          "row's `<li>`, above its bottom hairline, with the collapsed rows beneath it unchanged.",
      },
    },
  },
};

export const TwoExpanded: Story = {
  name: 'Two rows expanded at once',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'View By Dr. Tim Apple' }));
    await userEvent.click(canvas.getByRole('button', { name: 'View By Dr. Ravi Menon' }));
    await expect(
      await canvas.findByText(/Suspected partial cranial cruciate ligament tear/)
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Annual wellness exam. No abnormalities detected. Weight stable at 12.4kg.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`open` is per-row state, so the rows are independent - opening a second does not close ' +
          'the first. This is the composite the accordion-style single-open assumption would break, ' +
          'and the only drawing where a multi-paragraph detail sits directly above a one-line one.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'Empty (no items)',
  args: { items: [], emptyLabel: 'No SOAP notes recorded yet.' },
  parameters: {
    docs: {
      description: {
        story:
          'With no items the bordered `rounded-2xl` list is not rendered at all - the empty line ' +
          'stands alone rather than sitting inside an empty box.',
      },
    },
  },
};
