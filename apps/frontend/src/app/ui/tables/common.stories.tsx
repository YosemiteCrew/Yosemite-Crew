import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { IoPawOutline } from 'react-icons/io5';

import {
  NoDataMessage,
  ProfileSubtitle,
  ProfileTitle,
  RescheduleButton,
  ViewButton,
} from './common';
/* ProfileTitle and ProfileSubtitle carry no styles of their own - both class
   names live in DataTable.css, which every table imports for itself. common.tsx
   does not, so without this import the identity-cell story would measure two
   unstyled divs and still "pass". */
import './DataTable.css';

const onAddRoom = fn();
const onView = fn();
const onReschedule = fn();

/** The 64px decoration chip. Thrown rather than asserted so a missing chip reads
 *  as a failure at the point it went missing, not as a null-deref three lines on. */
const iconChip = (root: HTMLElement): HTMLElement => {
  const chip = root.querySelector<HTMLElement>('div[aria-hidden="true"]');
  if (!chip) throw new Error('the empty state rendered without its icon chip');
  return chip;
};

const requireEl = (root: HTMLElement, selector: string): HTMLElement => {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`expected ${selector} in the rendered cell`);
  return el;
};

/* One string for both lines of the identity cell, so the wrap-vs-clip comparison
   is controlled: same characters, same 220px cell, different behaviour. */
const IDENTITY = 'Bella Montgomery-Whitfield, Golden Retriever';

const meta = {
  title: 'Tables/Common',
  component: NoDataMessage,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The shared table primitives every list page pulls from `common.tsx`: the `NoDataMessage` ' +
          'empty-state recipe (64px `--blue-soft` icon chip, Newsreader headline, muted sub, optional ' +
          'CTA), the two 40px round row actions, and the two-line identity cell. The props table below ' +
          'is `NoDataMessage`; the other four are rendered by the stories that name them. ' +
          'These states are already unit-tested for their markup - what the stories add is the part ' +
          'jsdom cannot see: the chip and the buttons measured in real pixels, and whether the ' +
          'identity cell actually wraps or actually clips once DataTable.css and the Tailwind ' +
          'utilities layer are both in play.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof NoDataMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Empty state with nothing passed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A table with a string and no copy of its own still lands in the recipe.
    await expect(canvas.getByText('No data available')).toBeVisible();

    const chip = iconChip(canvasElement);
    /* The chip is decoration. Without aria-hidden a screen reader announces the
       tray glyph ahead of the headline, so the first thing a blind user hears
       about an empty table is an icon name. */
    await expect(chip).toHaveAttribute('aria-hidden', 'true');
    const box = chip.getBoundingClientRect();
    // 64px is the DS recipe (`size-16`). A unit test can only read the class
    // string, so a Tailwind rename would shrink the chip everywhere in silence.
    await expect(box.width).toBe(64);
    await expect(box.height).toBe(64);

    // Nothing to press until a caller passes a cta.
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
  },
};

export const WithSubtitleAndIcon: Story = {
  name: 'Subtitle and a caller-supplied icon',
  args: {
    title: 'No specialities yet',
    subtitle: 'Add one to route appointments to the right team.',
    icon: (
      <span data-testid="story-icon" className="flex">
        <IoPawOutline size={26} color="var(--color-primary-600)" />
      </span>
    ),
  },
  play: async ({ canvasElement }) => {
    const chip = iconChip(canvasElement);
    await expect(within(chip).getByTestId('story-icon')).toBeInTheDocument();
    /* Replaced, not joined. Two glyphs side by side would break the 64px chip
       out of its square, and the fallback is easy to leave in by accident when
       the prop is spelled `icon ?? default`. */
    await expect(chip.querySelectorAll('svg')).toHaveLength(1);
    await expect(chip.getBoundingClientRect().width).toBe(64);

    await expect(
      within(canvasElement).getByText('Add one to route appointments to the right team.')
    ).toBeVisible();
  },
};

export const WithButtonCta: Story = {
  name: 'CTA that calls back',
  args: {
    title: 'No rooms configured',
    subtitle: 'Rooms decide where an appointment can be booked.',
    cta: { label: 'Add a room', onClick: onAddRoom },
  },
  play: async ({ canvasElement }) => {
    onAddRoom.mockClear();
    const cta = within(canvasElement).getByRole('button', { name: 'Add a room' });
    /* type="button" matters: these empty states sit inside filter forms, and a
       button that defaults to submit reloads the page instead of opening the
       drawer - which looks like the drawer being broken. */
    await expect(cta).toHaveAttribute('type', 'button');
    // h-10 pill, same height as the row actions next to it in the same shell.
    await expect(cta.getBoundingClientRect().height).toBe(40);

    await userEvent.click(cta);
    await expect(onAddRoom).toHaveBeenCalledTimes(1);
  },
};

export const WithLinkCta: Story = {
  name: 'CTA that navigates',
  args: {
    title: 'No invoices yet',
    subtitle: 'Invoices appear here once an appointment is billed.',
    cta: { label: 'Go to appointments', href: '/appointments' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'Go to appointments' });
    await expect(link).toHaveAttribute('href', '/appointments');
    /* An href swaps the element rather than decorating the button: a
       `<button href>` renders identically, is announced as a button and goes
       nowhere. Asserting the button is absent is the only way to catch that. */
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    // Both branches share CTA_CLASS, so the anchor keeps the 40px pill height.
    await expect(link.getBoundingClientRect().height).toBe(40);
    /* Deliberately not clicked - this is a real navigation and would take the
       preview iframe with it. */
  },
};

export const RowActions: Story = {
  name: 'Row actions: view and reschedule',
  render: () => (
    <div className="flex items-center gap-2">
      <ViewButton onClick={onView} />
      <RescheduleButton onClick={onReschedule} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    onView.mockClear();
    onReschedule.mockClear();
    const canvas = within(canvasElement);
    const view = canvas.getByRole('button', { name: 'View details' });
    const reschedule = canvas.getByRole('button', { name: 'Reschedule' });

    /* Two identical 40px circles differing only by glyph. The aria-label is the
       whole of the difference for a screen reader, and it is the only thing
       stopping this test from clicking the wrong one. */
    for (const button of [view, reschedule]) {
      const box = button.getBoundingClientRect();
      await expect(box.width).toBe(40);
      await expect(box.height).toBe(40);
    }

    // Wiring, checked one at a time: a copy-paste of the row would hand both
    // circles the same handler and nothing on screen would look wrong.
    await userEvent.click(view);
    await expect(onView).toHaveBeenCalledTimes(1);
    await expect(onReschedule).not.toHaveBeenCalled();

    await userEvent.click(reschedule);
    await expect(onReschedule).toHaveBeenCalledTimes(1);
    await expect(onView).toHaveBeenCalledTimes(1);
  },
};

export const IdentityCell: Story = {
  name: 'Identity cell: the title wraps, the sub clips',
  render: () => (
    <div className="appointment-profile-two" style={{ width: 220 }}>
      <ProfileTitle>{IDENTITY}</ProfileTitle>
      <ProfileSubtitle>{IDENTITY}</ProfileSubtitle>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const title = requireEl(canvasElement, '.appointment-profile-title');
    const sub = requireEl(canvasElement, '.appointment-profile-sub');

    /* The title sets `white-space: normal` + `overflow-wrap: anywhere` in
       DataTable.css, so a long companion name grows the row rather than
       spilling out of the cell. */
    await expect(globalThis.getComputedStyle(title).whiteSpace).toBe('normal');
    await expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);

    /* The sub adds Tailwind's `truncate`. That utility is layered and
       DataTable.css is not, so the moment anyone gives `.appointment-profile-sub`
       a `white-space` of its own the ellipsis dies silently and the sub starts
       wrapping - exactly the bug the comment above `.cell-truncate` records for
       the title. Assert the clip is real, not just declared. */
    const subStyle = globalThis.getComputedStyle(sub);
    await expect(subStyle.whiteSpace).toBe('nowrap');
    await expect(subStyle.textOverflow).toBe('ellipsis');
    await expect(sub.scrollWidth).toBeGreaterThan(sub.clientWidth);

    // Same string, same cell width: the wrapping line is the taller of the two.
    await expect(title.getBoundingClientRect().height).toBeGreaterThan(
      sub.getBoundingClientRect().height
    );
  },
};

export const Phone: Story = {
  name: 'Phone: a long headline in a 375px column',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    title: 'No appointments scheduled for this companion',
    subtitle: 'Book one from the companion record and it will show up here.',
    cta: { label: 'Book an appointment', href: '/appointments' },
  },
  play: async ({ canvasElement }) => {
    /* The recipe is the same at every width - it centres, pads with px-4 and
       lets the headline wrap. Nothing in it may push the phone canvas sideways. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
    // The chip is a flex child; without a shrink-0 equivalent it would squash
    // into an oval on the narrow column.
    const box = iconChip(canvasElement).getBoundingClientRect();
    await expect(box.width).toBe(64);
    await expect(box.height).toBe(64);
  },
};
