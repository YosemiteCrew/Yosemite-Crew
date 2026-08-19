import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import HoursEditModal from './HoursEditModal';

const ORG_ID = 'org-storybook-hours';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

/**
 * An org-level membership: `practitionerReference` is empty on purpose.
 *
 * With a practitioner reference the editor fetches that person's saved profile
 * on mount and seeds the grid from the response, which needs a network stub this
 * repo has no wiring for. Empty takes the org-level branch instead - the same
 * one a non-practitioner admin gets - so the grid is seeded from the store and
 * the mount stays offline.
 */
const membership: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: '',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

/**
 * Seeds the real stores.
 *
 * The org's availability list is seeded EMPTY rather than with saved rows, and
 * that is a deliberate choice: `convertFromGetApi` returns the Mon-Fri 09:00-17:00
 * default without running any timezone conversion when no slot is available,
 * while saved rows are stored as UTC clock times and get shifted into the
 * viewer's preferred zone. Seeding rows would make the day and the label depend
 * on the machine running Storybook; the default branch is identical everywhere.
 */
const seed = () => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: membership },
    status: 'loaded',
  });
  useAvailabilityStore.setState({
    availabilitiesById: {},
    availabilityIdsByOrgId: { [ORG_ID]: [] },
  });
  useAuthStore.setState({
    attributes: { sub: 'user-1', given_name: 'Elena', family_name: 'Marsh' },
  });

  return () => {
    useOrgStore.setState({
      orgsById: {},
      orgIds: [],
      primaryOrgId: null,
      membershipsByOrgId: {},
      status: 'idle',
    });
    useAvailabilityStore.setState({ availabilitiesById: {}, availabilityIdsByOrgId: {} });
    useAuthStore.setState({ attributes: null });
  };
};

/** `showModal` is owned by the caller, so the harness holds it for Cancel to act on. */
const HoursEditor = ({ open }: { open: boolean }) => {
  const [showModal, setShowModal] = useState(open);
  return (
    <div className="min-h-[680px] bg-[var(--page)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        Settings page behind the scrim, so the backdrop tint and blur are visible.
      </p>
      <HoursEditModal showModal={showModal} setShowModal={setShowModal} />
    </div>
  );
};

/** `ModalBase` portals to `document.body`, so the panel is never inside `canvasElement`. */
const openPanel = (): Promise<HTMLElement> =>
  waitFor(() => {
    const panel = document.querySelector('dialog[open]');
    expect(panel).not.toBeNull();
    return panel as HTMLElement;
  });

const rowFor = (panel: HTMLElement, day: string): HTMLElement =>
  within(panel).getByText(day).closest('div.grid') as HTMLElement;

const meta = {
  title: 'Settings/HoursEditModal',
  component: HoursEditor,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Availability & consultation hours" editor behind the Settings hours card. It is ' +
          'only reachable through a button on that card, so nothing about it - the seven-day ' +
          'grid, the range editing, the guard on Save - had ever been drawn.\n\n' +
          'Each day is a four-track grid: `40px` toggle, `96px` day name, `1fr` ranges, `auto` ' +
          'actions. Nothing enforces that the four cells and the four tracks agree, and the ' +
          'third cell has three shapes - a "Day off" span, one interval, or a wrapping row of ' +
          'several - while the fourth stays mounted and empty on a disabled day. So the stories ' +
          'assert the track count and the child count in all three, and the phone story asserts ' +
          'what the fixed tracks do to a 375px sheet.\n\n' +
          'Save is guarded, not validated: `hasAtLeastOneAvailability` sees an empty converted ' +
          'payload and returns before any request, and the modal simply stays open with no ' +
          'message. That silent branch is the one worth reviewing, and it has its own story ' +
          'below.',
      },
    },
  },
  tags: ['autodocs'],
  args: { open: true },
  beforeEach: seed,
} satisfies Meta<typeof HoursEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  name: 'Open (default hours)',
  play: async () => {
    const panel = await openPanel();
    const dialog = within(panel);

    await expect(
      dialog.getByRole('heading', { name: 'Availability & consultation hours' })
    ).toBeInTheDocument();
    // Design subtitle: the signed-in practitioner, then the trailing clause.
    await expect(
      dialog.getByText('Elena Marsh · drives booking slots and the team planner')
    ).toBeInTheDocument();

    // Seven rows, Monday to Friday on. The two off days render "Day off" in place
    // of their ranges rather than an empty cell.
    await expect(dialog.getAllByRole('checkbox')).toHaveLength(7);
    await expect(
      dialog.getByRole('checkbox', { name: 'Enable availability for Monday' })
    ).toBeChecked();
    await expect(
      dialog.getByRole('checkbox', { name: 'Enable availability for Sunday' })
    ).not.toBeChecked();
    await expect(dialog.getAllByText('Day off')).toHaveLength(2);

    /* Four tracks and four children. A dropped track collapses the row to one
       column and stacks toggle, name, ranges and actions vertically - which still
       renders, still passes any "the row is there" assertion, and looks nothing
       like the design. */
    const monday = rowFor(panel, 'Monday');
    const tracks = getComputedStyle(monday).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(4);
    await expect(monday.children).toHaveLength(4);
    // The two fixed tracks, as the baseline the phone story below re-reads: they
    // are the same 40px and 96px there, inside a sheet less than half this wide.
    await expect(tracks[0]).toBe('40px');
    await expect(tracks[1]).toBe('96px');

    const mondayCells = within(monday);
    await expect(mondayCells.getByText('9:00 AM')).toBeInTheDocument();
    await expect(mondayCells.getByText('5:00 PM')).toBeInTheDocument();

    // The footer note carries the zone the times are shown in, which is the only
    // thing on screen that says these are not raw stored values.
    const note = dialog.getByText(/booking slots follow each service/);
    await expect(note.textContent).toMatch(/^[\w/+-]+ · booking slots follow each service/);
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: 'Save availability' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The editor as it opens for an organization with no saved hours: the Mon-Fri ' +
          '09:00-17:00 default. Times are chips, not selects - 32px, `--field-bg`, tabular ' +
          'figures - and the day column is fixed at 96px so every chip column starts on the ' +
          'same x.',
      },
    },
  },
};

export const EnableWeekendDay: Story = {
  name: 'Turning a day on',
  play: async () => {
    const panel = await openPanel();
    const dialog = within(panel);

    const saturday = rowFor(panel, 'Saturday');
    await expect(within(saturday).getByText('Day off')).toBeInTheDocument();
    await expect(within(saturday).queryByText('9:00 AM')).toBeNull();

    await userEvent.click(
      dialog.getByRole('checkbox', { name: 'Enable availability for Saturday' })
    );

    // The ranges cell is replaced, not revealed: the "Day off" span is gone and a
    // real interval with both chips took its place.
    await waitFor(() => expect(within(saturday).queryByText('Day off')).toBeNull());
    await expect(within(saturday).getByText('9:00 AM')).toBeInTheDocument();
    await expect(within(saturday).getByText('5:00 PM')).toBeInTheDocument();
    await expect(dialog.getAllByText('Day off')).toHaveLength(1);

    // The two row actions only exist on an enabled day.
    await expect(
      within(saturday).getByRole('button', { name: 'Add range for Saturday' })
    ).toBeInTheDocument();
    /* `dublicate-button` is the shipped aria-label on the copy-to-other-days
       control, spelling included. Asserted as-is rather than quietly matched by
       title, because it is what a screen reader announces today. */
    await expect(
      within(saturday).getByRole('button', { name: 'dublicate-button' })
    ).toBeInTheDocument();

    // Same four tracks, same four cells, after the third cell changed shape.
    await expect(getComputedStyle(saturday).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(
      4
    );
    await expect(saturday.children).toHaveLength(4);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The toggle is a 36x22 pill with the native checkbox behind it at zero opacity, so ' +
          'the visible state is `--blue` track / knob right versus `--band` track / knob left. ' +
          'Enabling a day also grows the row by the two circle actions, which is the moment the ' +
          '`auto` fourth track earns its place.',
      },
    },
  },
};

export const SecondRange: Story = {
  name: 'Adding and removing a second range',
  play: async () => {
    const panel = await openPanel();
    const monday = rowFor(panel, 'Monday');
    const cells = within(monday);

    await expect(cells.getAllByText('9:00 AM')).toHaveLength(1);
    await expect(cells.queryByRole('button', { name: 'Remove range 2 for Monday' })).toBeNull();

    await userEvent.click(cells.getByRole('button', { name: 'Add range for Monday' }));

    // A second interval, seeded from the same 09:00-17:00 default, plus the remove
    // control that only ranges after the first one get.
    await waitFor(() => expect(cells.getAllByText('9:00 AM')).toHaveLength(2));
    await expect(cells.getAllByText('5:00 PM')).toHaveLength(2);
    await expect(
      cells.getByRole('button', { name: 'Remove range 2 for Monday' })
    ).toBeInTheDocument();
    // Both ranges live in the third cell and wrap inside it; the row keeps its
    // four tracks rather than growing one per interval.
    await expect(getComputedStyle(monday).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
    await expect(monday.children).toHaveLength(4);

    await userEvent.click(cells.getByRole('button', { name: 'Remove range 2 for Monday' }));

    await waitFor(() => expect(cells.getAllByText('9:00 AM')).toHaveLength(1));
    await expect(cells.queryByRole('button', { name: 'Remove range 2 for Monday' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Split days (a morning and an afternoon clinic) are the reason ranges are a list. The ' +
          'first range has no remove control on purpose - `deleteInterval` refuses index 0, and ' +
          'emptying the list re-seeds the default rather than leaving an enabled day with no ' +
          'hours.',
      },
    },
  },
};

export const SaveWithNothingEnabled: Story = {
  name: 'Save with every day off',
  play: async () => {
    const panel = await openPanel();
    const dialog = within(panel);

    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      await userEvent.click(
        dialog.getByRole('checkbox', { name: `Enable availability for ${day}` })
      );
    }
    await waitFor(() => expect(dialog.getAllByText('Day off')).toHaveLength(7));

    await userEvent.click(dialog.getByRole('button', { name: 'Save availability' }));

    /* The converted payload is empty, so `persistAvailability` returns false
       before touching the network and the handler bails out of its own success
       path. Waiting for the label to come back out of "Saving..." is what makes
       the assertion below about the settled state rather than the first frame. */
    await waitFor(() =>
      expect(dialog.getByRole('button', { name: 'Save availability' })).toBeEnabled()
    );
    await expect(document.querySelector('dialog[open]')).not.toBeNull();
    await expect(dialog.getAllByText('Day off')).toHaveLength(7);
    // No message of any kind was added - the footer is still exactly the tz note
    // and the two actions, which is what "silent" means concretely here.
    const footer = dialog.getByRole('button', { name: 'Cancel' }).parentElement as HTMLElement;
    await expect(footer.children).toHaveLength(3);
    await expect(dialog.queryByRole('alert')).toBeNull();

    /* The third shape of the ranges cell: no chips, no row actions, a "Day off"
       span on its own. Same four tracks and four children as an enabled row - the
       actions cell stays in the DOM empty rather than being conditionally dropped,
       which is exactly what keeps the day column aligned down the seven rows. */
    const monday = rowFor(panel, 'Monday');
    await expect(getComputedStyle(monday).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
    await expect(monday.children).toHaveLength(4);
    await expect(within(monday).queryByRole('button')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The silent branch. Every day off is a legitimate thing to want to express, and the ' +
          'editor refuses it without saying so: no toast, no inline message, the panel just ' +
          'stays put. Whoever picks this up next should decide whether it wants a message or ' +
          'a disabled Save.',
      },
    },
  },
};

export const ClosesOnCancel: Story = {
  name: 'Cancel closes without saving',
  play: async () => {
    const panel = await openPanel();
    const dialog = within(panel);

    // Edit something first, so "closed" is being asserted against a panel that
    // had real state rather than against one that never finished rendering.
    await userEvent.click(
      dialog.getByRole('checkbox', { name: 'Enable availability for Saturday' })
    );
    await waitFor(() => expect(dialog.getAllByText('Day off')).toHaveLength(1));

    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

    /* Closed is not unmounted: the dialog stays in the DOM without its `open`
       attribute, so absence has to be asserted against `dialog[open]` - a query
       for the heading would still find it and pass with the panel dismissed. */
    await waitFor(() => expect(document.querySelector('dialog[open]')).toBeNull());

    /* And the mounted-but-closed panel still holds its whole tree, edit included.
       Cancel is `setShowModal(false)` and nothing more: there is no reset, so the
       Saturday toggle is still on behind the scrim and reopening the editor shows
       the abandoned edit rather than the saved hours. That is the thing to look
       at here, and it is why the assertion is on `dialog[open]` and not on text. */
    const closed = within(panel);
    await expect(
      closed.getByRole('heading', { name: 'Availability & consultation hours' })
    ).toBeInTheDocument();
    await expect(closed.getAllByRole('checkbox')).toHaveLength(7);
    await expect(
      closed.getByRole('checkbox', { name: 'Enable availability for Saturday' })
    ).toBeChecked();
    await expect(closed.getAllByText('Day off')).toHaveLength(1);
    // Inert while closed, which is what keeps that live tree off the tab order.
    await expect(panel).toHaveAttribute('inert');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Cancel dismisses the panel and discards nothing. `HoursEditModal` holds the editable ' +
          'availability in its own state and never unmounts, so an edit abandoned here is still ' +
          'there the next time the card opens the editor - the seed from the store only runs ' +
          'when the store snapshot itself changes. Worth deciding whether that is the intended ' +
          'behaviour before anyone adds a confirmation step to it.',
      },
    },
  },
};

export const PhoneSheet: Story = {
  name: 'Phone: the editor as a bottom sheet',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert - a story using it renders the desktop panel under
  // a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Under 768px the centered panel re-forms into a bottom sheet with a grabber. The day ' +
          'row does not re-form with it, and nothing in it gives. ' +
          '`grid-cols-[40px_96px_1fr_auto]` carries no breakpoint, so the 40px toggle column and ' +
          'the 96px day column hold their desktop sizes inside a 375px sheet; the time chip ' +
          'holds its full 100px too, because a flex item with a definite width contributes that ' +
          'width as its min-content contribution and the `1fr` track floors on it rather than ' +
          'squeezing it. So the row does not wrap, does not shrink and does not re-form - its ' +
          'tracks add up to 450px before padding and it overflows its own box. Every part of ' +
          'that is measured below rather than left to the eye. The day column and the chip ' +
          'widths are what a phone layout would have to change; this is the only story where ' +
          'any of it is visible.',
      },
    },
  },
  play: async () => {
    // `useIsPhone` is false during the first client render, so the sheet class
    // arrives on a second pass rather than on mount.
    const panel = await waitFor(() => {
      const sheet = document.querySelector('dialog[open].yc-modal-sheet');
      expect(sheet).not.toBeNull();
      return sheet as HTMLElement;
    });

    await expect(
      within(panel).getByRole('heading', { name: 'Availability & consultation hours' })
    ).toBeInTheDocument();
    await expect(within(panel).getAllByRole('checkbox')).toHaveLength(7);

    const monday = rowFor(panel, 'Monday');
    const tracks = getComputedStyle(monday).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(4);
    await expect(monday.children).toHaveLength(4);

    /* The measured version of the claim in the prose, so the story proves it
       rather than asserting it. The two fixed tracks do not respond to width at
       all: they are still the desktop 40px and 96px inside a 375px sheet. */
    await expect(tracks[0]).toBe('40px');
    await expect(tracks[1]).toBe('96px');

    /* And nothing else in the row gives either - which is the finding, and it is
       NOT what this assertion used to claim. The chip carries `w-[100px]` with
       `sm:w-[110px]` as its only step, and that step is at 640px, so 100px is
       the phone width by default rather than by adaptation. Nor is it squeezed
       into fitting: a flex item with a definite width contributes that width as
       its min-content contribution, so the `1fr` track floors at the two chips
       plus their gap instead of shrinking them. Pinned to what the component
       does TODAY - exactly its design width, at a viewport it was never sized
       for - with the class read as well as the box measured, so a changed
       utility and a changed used width each fail on their own rather than one
       silently covering for the other. */
    const chip = within(monday).getByText('9:00 AM').closest('button') as HTMLElement;
    const chipWrapper = chip.parentElement as HTMLElement;
    await expect(chipWrapper.className).toContain('w-[100px]');
    await expect(chipWrapper.className).toContain('sm:w-[110px]');
    await expect(chip.getBoundingClientRect().width).toBeCloseTo(100, 1);

    /* So nothing absorbs the deficit and the row simply overflows its own box.
       The tracks add up on their own: 40 + 96 + (100 + 8 + 100) + (28 + 8 + 28)
       plus three 14px gaps is 450px of track before the row's own 24px side
       padding, inside a sheet that is 375px wide in total. That is the defect -
       the day row has no phone layout at all - and this story is pinned to it
       rather than asserting it away. The assertion fails the day someone gives
       the row a real phone layout, which is the fix; this is the record that it
       has not happened yet. */
    await expect(monday.scrollWidth).toBeGreaterThan(monday.clientWidth);
  },
};
