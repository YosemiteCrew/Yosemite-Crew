import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import PopoverHeader from './PopoverHeader';
import { getCompanionAge } from './appointmentPopoverHelpers';

const ORG_ID = 'org-storybook';
const APPOINTMENT_ID = 'appt-header-1';
const COMPANION_ID = 'companion-poppy';

/**
 * The popover generates this with `useId` and hands the same value to the
 * dialog's `aria-labelledby`. Pinned to a literal here so a story can assert the
 * header actually stamps it on the name button - that link is the dialog's whole
 * accessible name, and it fails silently.
 */
const TITLE_ID = 'popover-header-title';

const COMPANION: Appointment['patient'] = {
  id: COMPANION_ID,
  name: 'Poppy',
  species: 'dog',
  breed: 'Beagle',
  parent: { id: 'parent-maya', name: 'Maya Whitfield' },
};

/**
 * Local construction, not a UTC literal: `getCompanionAge` reads `getFullYear`,
 * `getMonth` and `getDate` off the date in LOCAL time, so `2021-06-04T00:00:00Z`
 * is the 3rd of June west of Greenwich and the day-of-month comparison flips the
 * month count. The expected subline is composed with the same helper below, but
 * the fixture should not be the thing that moves either.
 */
const DATE_OF_BIRTH = new Date(2021, 5, 4);

type HeaderProps = ComponentProps<typeof PopoverHeader>;

/**
 * Everything the subline reads that the booking payload does not carry. The
 * component re-casts `companionDetails` inside the render to reach `gender`,
 * `dateOfBirth` and `isneutered`, so these are real inputs even though the
 * declared prop type has no room for them.
 */
type CompanionDetailOverrides = Partial<
  Appointment['patient'] & {
    dateOfBirth: Date;
    gender: string;
    isneutered: boolean;
    currentWeight: number | string;
    physicalAttribute: { weight?: string };
  }
>;

const details = (overrides: CompanionDetailOverrides = {}): HeaderProps['companionDetails'] =>
  ({
    ...COMPANION,
    dateOfBirth: DATE_OF_BIRTH,
    gender: 'male',
    isneutered: true,
    currentWeight: 12,
    ...overrides,
  }) as HeaderProps['companionDetails'];

/** Nothing in this header renders a date or a time, so UTC instants are safe. */
const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: COMPANION,
  companion: COMPANION,
  organisationId: ORG_ID,
  room: { id: 'room-consult-2', name: 'Consult 2' },
  appointmentType: {
    id: 'svc-dental-consult',
    name: 'Dental consultation',
    speciality: { id: 'spec-dentistry', name: 'Dentistry' },
  },
  // Stated outright. `resolveEncounterMode` falls back to "a room is assigned,
  // therefore inpatient", so leaving this off flips the mode pill on its own.
  appointmentKind: 'OUTPATIENT',
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
};

const withAppointment = (patch: Partial<Appointment>): Appointment => ({
  ...APPOINTMENT,
  ...patch,
});

/** Composed rather than written down: the age moves every month. */
const FULL_SUBLINE = `Beagle · Canine · ${getCompanionAge(DATE_OF_BIRTH)} · MN · 12 kg`;

/** The header's own root, reached without a class chain. */
const headerRow = (canvasElement: HTMLElement): HTMLElement =>
  (canvasElement.querySelector('[data-story-panel]') as HTMLElement)
    .firstElementChild as HTMLElement;

/**
 * next/image rewrites the src into `/_next/image?url=<encoded>&w=…`, so the CDN
 * path is only readable after decoding. Decoding a plain URL is a no-op, so this
 * reads the same either way.
 */
const avatarSrc = (canvasElement: HTMLElement): string =>
  decodeURIComponent(canvasElement.querySelector('img')?.getAttribute('src') ?? '');

const meta = {
  title: 'Appointments/Calendar/PopoverHeader',
  component: PopoverHeader,
  parameters: {
    layout: 'padded',
    /* The companion name calls `router.push`, so the App Router mock has to be
       mounted or the header throws "invariant expected app router to be mounted"
       before it paints. */
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The top strip of the appointment popover: avatar, companion name, a derived subline, ' +
          'and a right-hand column of status / mode / emergency chrome.\n\n' +
          'The subline is the part worth drawing. It is built inside the render from five ' +
          'sources, joined with a middle dot, and every one of them can be missing: breed and ' +
          'species come off the booking, age is computed from a date of birth, sex and neuter ' +
          'status collapse into a two-letter code (MN / FS), and weight is a number or a free-text ' +
          'physical attribute. Only the sex code is unconditional - `getCompanionGenderLabel` ' +
          'returns "Unknown" rather than an empty string - so a companion the clinic has recorded ' +
          'nothing about still reads "Feline · Unknown" rather than collapsing to a blank line.\n\n' +
          'The right-hand column is three separate components stacked in one flex column, and ' +
          'its shape changes with permission: `AppointmentStatusPill` renders a dropdown trigger ' +
          'when the status has an allowed transition AND the viewer can edit, and a static badge ' +
          'otherwise. The dropdown menu is portalled to `document.body`, so it escapes the ' +
          "popover's own stacking context rather than being clipped by it.\n\n" +
          'None of these stories select a status. Choosing one calls ' +
          '`changeAppointmentStatus` in `appointmentService`, which is a real network write with ' +
          'no seam to stub from a story file - so the menu is opened and read, and closed again.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: APPOINTMENT,
    companion: COMPANION,
    companionDetails: details(),
    companionDisplayName: 'Poppy · Whitfield',
    canEditAppointments: true,
    titleId: TITLE_ID,
    // The calendar uses this to keep an open menu anchored to a scrolling
    // container. Inert here, but it MUST return a cleanup function - the pill
    // returns the result straight out of an effect.
    registerAnchorEl: fn(() => () => {}),
    onClose: fn(),
  },
  decorators: [
    // 440px is the popover's own width and `p-5` its padding, so the header gets
    // the 400px it really has. Fixed rather than fluid: the truncation story
    // measures against it.
    (Story) => (
      <div data-story-panel className="yc-glass-overlay rounded-3xl p-5" style={{ width: 440 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PopoverHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Confirmed booking, full subline',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const name = canvas.getByRole('button', { name: 'Poppy · Whitfield' });
    /* The dialog names itself through this id and nothing else. Drop it and the
       popover keeps rendering, keeps reading correctly to the eye, and announces
       as an unlabelled dialog. */
    await expect(name).toHaveAttribute('id', TITLE_ID);
    // It is a routing control, not a heading - so it carries hover text saying
    // where it goes.
    await expect(name).toHaveAttribute('title', 'Open appointment overview');

    // All five parts, in order, in one assertion: a per-part check passes on a
    // subline that lost the separator or reordered breed and species.
    await expect(canvas.getByText(FULL_SUBLINE)).toBeVisible();

    /* With an allowed transition and edit rights the pill is a menu trigger, not
       a badge. `aria-haspopup` is the only thing that says so - the pill looks
       identical to the read-only one apart from an 8px caret. */
    const status = canvas.getByRole('button', { name: 'Upcoming' });
    await expect(status).toHaveAttribute('aria-haspopup', 'menu');
    await expect(status).toHaveAttribute('aria-expanded', 'false');

    await expect(canvas.getByText('Outpatient')).toBeVisible();
    await expect(canvas.queryByText('Emergency')).toBeNull();

    /* No photoUrl on the booking, so `getSafeImageUrl` substitutes the species
       avatar rather than rendering a broken image. The species drives WHICH
       fallback, which is why it is lower-cased into an `ImageType` first. */
    await expect(avatarSrc(canvasElement)).toContain('avatar/dog.png');
  },
};

export const SparseCompanion: Story = {
  name: 'Nothing recorded but a species',
  args: {
    companion: {
      ...COMPANION,
      id: 'companion-stray',
      name: 'Nimbus',
      species: 'cat',
      breed: undefined,
      parent: { id: 'parent-none', name: 'Ruth Alderman' },
    },
    companionDetails: details({
      id: 'companion-stray',
      name: 'Nimbus',
      species: 'cat',
      breed: undefined,
      dateOfBirth: undefined,
      gender: undefined,
      isneutered: undefined,
      currentWeight: undefined,
    }),
    companionDisplayName: 'Nimbus · Alderman',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Two parts, not five, and one of them is a placeholder. Breed, age and
       weight each drop out of the join when absent, but the sex code never does -
       so the thinnest possible subline is a species and the word "Unknown", and
       there is no state where the line is empty. */
    await expect(canvas.getByText('Feline · Unknown')).toBeVisible();
    // The fallback tracks the species, so a cat gets the cat avatar.
    await expect(avatarSrc(canvasElement)).toContain('avatar/cat.png');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A stray brought in with no history: no breed, no date of birth, no sex, no weight. ' +
          'Four of the five subline parts drop out and the line still reads as a sentence rather ' +
          'than as a row of orphaned separators, because each part is pushed only when it exists ' +
          'and the join happens afterwards.',
      },
    },
  },
};

export const EmergencyAdmission: Story = {
  name: 'Emergency admission (photo, three pills)',
  args: {
    appointment: withAppointment({
      status: 'CHECKED_IN',
      appointmentKind: 'INPATIENT',
      isEmergency: true,
    }),
    companion: {
      ...COMPANION,
      photoUrl: 'https://d2il6osz49gpup.cloudfront.net/avatar/parent1.png',
    } as Appointment['patient'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Order matters and is invisible to a per-item query: status, then mode, then
       the emergency badge, stacked right-aligned in one column. The badge is last
       on purpose - it is the only one of the three that is sometimes absent, so
       anything above it would jump when it appears. */
    const column = canvas.getByText('Emergency').parentElement as HTMLElement;
    await expect([...column.children].map((child) => (child.textContent ?? '').trim())).toEqual([
      'Checked in',
      'Inpatient',
      'Emergency',
    ]);

    // A real photo is used verbatim; only a missing or non-https one falls back.
    await expect(avatarSrc(canvasElement)).toContain('avatar/parent1.png');

    // CHECKED_IN still has one allowed transition (IN_PROGRESS), so the pill is
    // a trigger here too - the chrome around it changed, the control did not.
    await expect(canvas.getByRole('button', { name: 'Checked in' })).toHaveAttribute(
      'aria-haspopup',
      'menu'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The fullest the right-hand column ever gets: an admitted emergency patient carrying ' +
          'all three pills at once. Worth a look for the stack rather than the individual badges - ' +
          'the column is right-aligned and gap-1.5, so a fourth pill or a wider status label ' +
          'pushes into the name beside it rather than wrapping.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'No edit permission: the status stops being a control',
  args: { canEditAppointments: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* One button in the whole header - the name. The status is still on screen
       and still readable, it just is not operable, which is the distinction a
       "the pill renders" assertion cannot make. */
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(canvas.queryByRole('button', { name: 'Upcoming' })).toBeNull();
    await expect(canvas.getByText('Upcoming')).toBeVisible();

    // Everything else is untouched by the permission.
    await expect(canvas.getByText(FULL_SUBLINE)).toBeVisible();
    await expect(canvas.getByText('Outpatient')).toBeVisible();
  },
};

export const StatusMenu: Story = {
  name: 'Status menu (opened, not chosen)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Upcoming' });

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    /* The menu is portalled to document.body, so it is NOT inside the canvas and
       a `within(canvasElement)` query finds nothing. That is the point: the
       popover is a z-1000 dialog with `overflow-hidden` ancestors, and a menu
       rendered in place would be clipped by them. */
    await expect(canvas.queryByRole('menu')).toBeNull();
    const menu = within(globalThis.document.body).getByRole('menu');
    await expect(canvasElement.contains(menu)).toBe(false);
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);

    /* The three transitions UPCOMING allows, in the order the config lists them.
       A menu that offered "In progress" would be offering a jump past check-in
       that the service rejects, and nothing in the pill would say so. */
    await expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => (item.textContent ?? '').trim())
    ).toEqual(['Checked in', 'Cancelled', 'No show']);

    // The open menu registers itself as the anchor so the calendar can keep it
    // pinned while the grid scrolls underneath. Only called while open.
    await expect(args.registerAnchorEl).toHaveBeenCalled();

    /* Closed again explicitly. The menu lives on document.body, so leaving it
       open outlives this story and lands in the next one's queries. */
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(within(globalThis.document.body).queryByRole('menu')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dropdown open. Deliberately stops short of choosing: `handleStatusChange` awaits ' +
          '`changeAppointmentStatus`, a real write against the appointments API, so a story that ' +
          'clicked a menu item would either 404 into the error tooltip or, pointed at a live ' +
          "backend, move somebody's appointment.",
      },
    },
  },
};

export const RoutesToHistory: Story = {
  name: 'The name routes and reports a close',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const router = getRouter();

    await userEvent.click(canvas.getByRole('button', { name: 'Poppy · Whitfield' }));

    /* Both the appointment and the companion go into the query, plus the return
       path - the history page needs all three to draw its back link and scope the
       timeline to this visit. Asserted as the whole URL because a missing param
       degrades into a working page with the wrong scope. */
    await expect(router.push).toHaveBeenCalledWith(
      '/companions/history?companionId=companion-poppy&source=appointments&appointmentId=appt-header-1&backTo=%2Fappointments'
    );
    // The header never closes itself; it reports, and the calendar drops the
    // active popover key. Order matters only in that both must happen - a push
    // without the close leaves the panel floating over the new route.
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

export const LongName: Story = {
  name: 'A long name truncates instead of shoving the pills',
  args: {
    companionDisplayName: 'Bartholomew Fitzwilliam Pemberton III · Vandersteen-Achterberg',
    companionDetails: details({
      breed: 'Bernese Mountain Dog crossed with a Newfoundland',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByRole('button', {
      name: 'Bartholomew Fitzwilliam Pemberton III · Vandersteen-Achterberg',
    });

    // Truncation, not wrapping: the name is one line with an ellipsis, so the
    // header keeps its height whatever the clinic typed in.
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    await expect(globalThis.getComputedStyle(name).textOverflow).toBe('ellipsis');

    /* The real risk is the flex row, not the text: the name column is `min-w-0`
       and the pill column is `shrink-0`, so a long name has to give way. Without
       the min-w-0 the row grows and the pills leave the panel - measured here
       against the 440px panel rather than against a class name. */
    const row = headerRow(canvasElement);
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    const pillRight = canvas.getByText('Outpatient').getBoundingClientRect().right;
    await expect(pillRight).toBeLessThanOrEqual(row.getBoundingClientRect().right);

    /* The subline clamps at two lines rather than truncating at one, which is why
       a long breed is set here as well - it is the only part of the header
       allowed to take a second row. */
    const subline = canvas.getByText(/Bernese Mountain Dog/);
    await expect(globalThis.getComputedStyle(subline).webkitLineClamp).toBe('2');
  },
};
