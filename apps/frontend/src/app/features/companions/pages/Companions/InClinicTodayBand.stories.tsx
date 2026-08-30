import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, within } from 'storybook/test';
import type { Appointment, Organisation } from '@yosemite-crew/types';

import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import InClinicTodayBand from './InClinicTodayBand';

const ORG_ID = 'org-in-clinic-story';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary',
  type: 'BOARDER',
  phoneNo: '+49 30 555 0134',
  taxId: 'TAX-0001',
};

/**
 * A real asset on an allow-listed CDN host, deliberately NOT `avatar/dog.png` -
 * that is the file `getSafeImageUrl(..., 'dog')` degrades an untrusted source to,
 * so a story using it could not tell a passed-through URL from a rejected one.
 */
const CDN_PHOTO = 'https://d2il6osz49gpup.cloudfront.net/avatar/business1.png';
const DOG_FALLBACK = 'avatar/dog.png';

/**
 * Local-time fixtures, never a UTC literal. `getTodaysAppointments` compares
 * local calendar days, so a `...T09:15:00.000Z` fixture slides into yesterday or
 * tomorrow depending on the runner's offset and the band empties itself.
 */
const NOW = new Date();
const at = (dayOffset: number, hour: number, minute: number) =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + dayOffset, hour, minute);

const PARENT: StoredParent = {
  id: 'parent-1',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

const companionRecord = (overrides: Partial<StoredCompanion>): CompanionParent => ({
  companion: {
    id: 'companion-x',
    organisationId: ORG_ID,
    parentId: 'parent-1',
    name: 'Poppy',
    type: 'dog',
    breed: 'Beagle',
    dateOfBirth: new Date(2021, 3, 18),
    gender: 'female',
    isInsured: false,
    status: 'active',
    ...overrides,
  },
  parent: PARENT,
});

type BookingOptions = {
  id?: string;
  companionId: string;
  name: string;
  species?: string;
  breed?: string;
  concern?: string;
  status?: Appointment['status'];
  start: Date;
};

const booking = ({
  id,
  companionId,
  name,
  species = 'dog',
  breed,
  concern,
  status = 'UPCOMING',
  start,
}: BookingOptions): Appointment => ({
  id,
  organisationId: ORG_ID,
  patient: {
    id: companionId,
    name,
    species,
    breed,
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  appointmentDate: start,
  startTime: start,
  endTime: new Date(start.getTime() + 30 * 60_000),
  timeSlot: '30',
  durationMinutes: 30,
  status,
  concern,
});

/**
 * The band reads appointments through `useAppointmentsForPrimaryOrg`, which is
 * two zustand stores and no network. Seeding them directly - rather than letting
 * the loader run - is what keeps these stories offline; both are restored on
 * unmount so neighbouring stories are unaffected.
 *
 * The id map is keyed separately from `appointment.id` on purpose: that is how a
 * booking with no id of its own still reaches the band, which is the case the
 * non-interactive card exists for.
 */
const withClinicDay = (bookings: Appointment[]) => () => {
  const orgSnapshot = useOrgStore.getState();
  const appointmentSnapshot = useAppointmentStore.getState();

  const appointmentsById: Record<string, Appointment> = {};
  const ids: string[] = [];
  bookings.forEach((appointment, index) => {
    const key = appointment.id ?? `unlinked-${index}`;
    appointmentsById[key] = appointment;
    ids.push(key);
  });

  useOrgStore.setState({ primaryOrgId: ORG_ID, orgIds: [ORG_ID], orgsById: { [ORG_ID]: ORG } });
  useAppointmentStore.setState({
    appointmentsById,
    appointmentIdsByOrgId: { [ORG_ID]: ids },
    status: 'loaded',
  });

  return () => {
    useOrgStore.setState(orgSnapshot);
    useAppointmentStore.setState(appointmentSnapshot);
  };
};

const cardsIn = (canvasElement: HTMLElement): HTMLElement[] =>
  [...canvasElement.querySelectorAll('article')] as HTMLElement[];

/**
 * The name line in the card footer. Qualified with `.truncate` because the
 * monogram disc is Newsreader too and comes first in the DOM - a bare
 * `.font-newsreader` query returns the single initial and every name assertion
 * quietly becomes an assertion about one letter.
 */
const nameOf = (card: HTMLElement): string =>
  (card.querySelector('span.truncate.font-newsreader') as HTMLElement | null)?.textContent ?? '';

const backgroundOf = (card: HTMLElement): string => {
  const disc = card.querySelector('span[style*="background"]') as HTMLElement | null;
  if (!disc) throw new Error(`card "${nameOf(card)}" rendered no monogram disc`);
  return globalThis.getComputedStyle(disc).backgroundColor;
};

/* Four bookings that survive the band's filters, plus four that must not: one
   yesterday, one tomorrow, one cancelled and one no-show. Six of these fall on
   today, so if the status filter ever ran AFTER the four-card cap the band would
   still show four cards - just the wrong four. */
const CLINIC_DAY: Appointment[] = [
  booking({
    id: 'appt-yesterday',
    companionId: 'companion-1',
    name: 'Poppy',
    start: at(-1, 8, 0),
  }),
  booking({
    id: 'appt-1',
    companionId: 'companion-1',
    name: 'Poppy',
    breed: 'Beagle',
    concern: 'Vaccination booster',
    status: 'IN_PROGRESS',
    start: at(0, 9, 15),
  }),
  booking({
    id: 'appt-2',
    companionId: 'companion-2',
    name: 'Mango',
    species: 'cat',
    breed: 'Ragdoll',
    concern: 'Dental check',
    status: 'CHECKED_IN',
    start: at(0, 10, 40),
  }),
  booking({
    id: 'appt-cancelled',
    companionId: 'companion-9',
    name: 'Biscuit',
    concern: 'Cancelled by the parent',
    status: 'CANCELLED',
    start: at(0, 11, 0),
  }),
  booking({
    id: 'appt-no-show',
    companionId: 'companion-8',
    name: 'Widget',
    concern: 'Did not arrive',
    status: 'NO_SHOW',
    start: at(0, 12, 0),
  }),
  booking({
    id: 'appt-3',
    companionId: 'companion-3',
    name: 'Rufus',
    breed: 'Labrador',
    concern: 'Limping on the left fore',
    status: 'UPCOMING',
    start: at(0, 13, 5),
  }),
  booking({
    id: 'appt-4',
    companionId: 'companion-4',
    name: 'Juno',
    species: 'horse',
    status: 'REQUESTED',
    start: at(0, 16, 30),
  }),
  booking({
    id: 'appt-tomorrow',
    companionId: 'companion-1',
    name: 'Poppy',
    start: at(1, 9, 0),
  }),
];

const CLINIC_COMPANIONS: CompanionParent[] = [
  companionRecord({ id: 'companion-1', name: 'Poppy', breed: 'Beagle', photoUrl: CDN_PHOTO }),
  companionRecord({ id: 'companion-2', name: 'Mango', type: 'cat', breed: 'Ragdoll' }),
  companionRecord({ id: 'companion-3', name: 'Rufus', breed: 'Labrador' }),
  companionRecord({ id: 'companion-4', name: 'Juno', type: 'horse', breed: '' }),
];

const meta = {
  title: 'Companions/InClinicTodayBand',
  component: InClinicTodayBand,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/companions' } },
    docs: {
      description: {
        component:
          "The strip above the companions directory: up to four of today's appointments, soonest " +
          'first, each as a photo-or-monogram card with the booked time over the image and the ' +
          'status in the footer.\n\n' +
          'It is built from real data only and **renders nothing at all** when no appointment ' +
          'falls on today - no header, no empty state, no reserved height. That is the branch most ' +
          'likely to be broken without anyone noticing, because on a quiet day the correct ' +
          'behaviour and a crashed component look the same.\n\n' +
          'Three filters run before the four-card cap: cancelled and no-show bookings are dropped, ' +
          'anything not on the local calendar day is dropped, and what is left is sorted by start ' +
          'time. Order matters at this size - the four cards are the next four patients, so a ' +
          'sort that ran after the cap would show four real appointments in the wrong half of the ' +
          'day.\n\n' +
          'A card is only interactive when its appointment has an id. Without one it keeps its ' +
          '`article` role, loses `role="button"`, `tabIndex` and its `aria-label`, and goes ' +
          'nowhere when clicked - which is the honest outcome for a booking the workspace cannot ' +
          'be opened for.\n\n' +
          'The media has two branches and they are not symmetrical. No `photoUrl` gives a ' +
          'Newsreader monogram on one of three tinted discs, cycled from the card key. A ' +
          '`photoUrl` gives a `next/image` - but it goes through `getSafeImageUrl`, so a companion ' +
          'whose photo is a relative upload path renders a **stock photo of a different animal** ' +
          'rather than degrading to the monogram.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companions: CLINIC_COMPANIONS,
  },
  beforeEach: withClinicDay(CLINIC_DAY),
} satisfies Meta<typeof InClinicTodayBand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Four of today's patients",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'In the clinic today' })).toBeInTheDocument();

    const cards = cardsIn(canvasElement);
    await expect(cards).toHaveLength(4);
    /* Exact names, in start-time order. This one assertion covers all three
       filters at once: yesterday's and tomorrow's Poppy are gone, the cancelled
       and no-show bookings are gone even though they fall between these times,
       and the survivors are sorted rather than left in store order. */
    await expect(cards.map(nameOf)).toEqual(['Poppy', 'Mango', 'Rufus', 'Juno']);
    await expect(canvasElement.textContent).not.toContain('Biscuit');
    await expect(canvasElement.textContent).not.toContain('Widget');

    /* The accessible name repeats what is drawn - name, the time on the badge and
       the status in the footer. Parsed rather than compared to a literal: the
       badge is formatted in the org's preferred time zone while the fixture is
       built in local time, so a hard-coded "09:15 AM" would pass or fail by
       runner. */
    const label = cards[0].getAttribute('aria-label') ?? '';
    const parts = /^Open appointment for (.+), (.+), (.+)$/.exec(label);
    await expect(parts).not.toBeNull();
    const [, name, time, status] = parts as RegExpExecArray;
    await expect(name).toBe('Poppy');
    await expect(status).toBe('In progress');
    await expect(time).toMatch(/^\d{2}:\d{2}\s(AM|PM)$/);
    await expect(cards[0].textContent).toContain(time);

    // Breed and reason are joined with a middot, and only when both exist.
    await expect(cards[0].textContent).toContain('Beagle · Vaccination booster');
    /* Juno has neither a breed nor a concern, so the subtitle element is absent
       rather than an empty line - the card keeps its height and does not sit a
       few pixels taller than its neighbours. */
    await expect(cards[3].querySelectorAll('span.truncate')).toHaveLength(1);

    // Four equal columns at desktop, which is what makes the row read as a set
    // rather than as a queue.
    const row = cards[0].parentElement as HTMLElement;
    const tracks = globalThis.getComputedStyle(row).gridTemplateColumns.split(' ');
    await expect(tracks).toHaveLength(4);
    await expect(new Set(tracks).size).toBe(1);
  },
};

export const OpensTheAppointment: Story = {
  name: 'Opening a card, by mouse and by keyboard',
  play: async ({ canvasElement }) => {
    const router = getRouter();
    const cards = cardsIn(canvasElement);

    const before = router.push.mock.calls.length;
    await userEvent.click(cards[0]);
    await expect(router.push.mock.calls.length).toBe(before + 1);
    /* The id is encoded into the query and the panel is asked for by name, so the
       workspace opens straight onto this booking's details rather than on the
       day. */
    await expect(router.push).toHaveBeenLastCalledWith(
      '/appointments?appointmentId=appt-1&open=details'
    );

    /* The card is an `article` wearing `role="button"`, so nothing gives it
       keyboard activation for free - the Enter and Space handlers are hand-rolled
       and are exactly what a refactor to a real `<button>` (or away from one)
       would drop. */
    cards[1].focus();
    await expect(cards[1]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(router.push).toHaveBeenLastCalledWith(
      '/appointments?appointmentId=appt-2&open=details'
    );
    await userEvent.keyboard(' ');
    await expect(router.push.mock.calls.length).toBe(before + 3);

    // The header link is a separate destination: the whole day, not one booking.
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: "Open today's schedule" })
    );
    await expect(router.push).toHaveBeenLastCalledWith('/appointments');
  },
};

export const PhotoAndFallbackPhoto: Story = {
  name: 'A real photo, and a photo path that is not one',
  args: {
    companions: [
      companionRecord({ id: 'companion-1', name: 'Poppy', photoUrl: CDN_PHOTO }),
      companionRecord({ id: 'companion-2', name: 'Mango', photoUrl: '/uploads/pets/mango.png' }),
    ],
  },
  play: async ({ canvasElement }) => {
    const cards = cardsIn(canvasElement);
    const [poppy, mango] = cards;

    const poppyImage = poppy.querySelector('img') as HTMLImageElement;
    const poppySrc = decodeURIComponent(poppyImage.getAttribute('src') ?? '');
    await expect(poppySrc).toContain('avatar/business1.png');
    await expect(poppySrc).not.toContain(DOG_FALLBACK);
    /* Intrinsic dimensions come from the component, not from the file. Without
       them `next/image` reserves the wrong box and the whole row reflows the
       moment the first photo lands. */
    await expect(poppyImage).toHaveAttribute('width', '220');
    await expect(poppyImage).toHaveAttribute('height', '138');
    // The photo is decorative here - the name is written directly beneath it, so
    // an alt repeating it would be read twice.
    await expect(poppyImage).toHaveAttribute('alt', '');

    const mangoSrc = decodeURIComponent(
      (mango.querySelector('img') as HTMLImageElement).getAttribute('src') ?? ''
    );
    /* Mango's photo is an upload path, not an https URL, so `getSafeImageUrl`
       swaps in the stock species avatar. Two things are worth seeing: the
       rejected path never reaches the DOM, and the card ends up showing a
       photograph of an animal that is not Mango rather than the monogram the
       companion avatar would have used. */
    await expect(mangoSrc).not.toContain('/uploads/');
    await expect(mangoSrc).toContain(DOG_FALLBACK);
    await expect(mango.querySelector('span[style*="background"]')).toBeNull();
  },
};

export const MonogramFallback: Story = {
  name: 'No photo: monogram discs, cycled',
  args: {
    companions: [
      companionRecord({ id: 'companion-1', name: 'poppy' }),
      companionRecord({ id: 'companion-2', name: 'Mango', type: 'cat' }),
      companionRecord({ id: 'companion-3', name: 'Rufus' }),
      companionRecord({ id: 'companion-4', name: '', type: 'horse' }),
    ],
  },
  play: async ({ canvasElement }) => {
    const cards = cardsIn(canvasElement);
    await expect(cards).toHaveLength(4);
    // No photo means no image element at all - the fallback is drawn, not fetched.
    await expect(canvasElement.querySelectorAll('img')).toHaveLength(0);

    /* The initial is upper-cased from the name however it was typed - the footer
       still shows "poppy" - and a record with no name at all gets `?` rather than
       an empty disc, which would read as a tile still loading. */
    await expect(cards.map(nameOf)).toEqual(['poppy', 'Mango', 'Rufus', '']);
    const discs = cards.map(
      (card) => card.querySelector('span[style*="background"]') as HTMLElement
    );
    await expect(discs.map((disc) => disc.textContent)).toEqual(['P', 'M', 'R', '?']);

    /* Three tints, cycled by the card key, so two cards side by side are never
       the same colour - and the fourth wraps back to the first rather than
       running out. Asserted as relations, not hex values, because the tokens
       have different values in dark. */
    const tints = cards.map(backgroundOf);
    await expect(new Set(tints.slice(0, 3)).size).toBe(3);
    await expect(tints[3]).toBe(tints[0]);
    for (const tint of tints) {
      await expect(tint).not.toBe('rgba(0, 0, 0, 0)');
    }

    // The watermark paw is decoration and must not be announced next to the
    // initial, which would read as "P paw" on every card.
    for (const card of cards) {
      await expect(card.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
  },
};

export const StatusColours: Story = {
  name: 'Every status ink',
  play: async ({ canvasElement }) => {
    const cards = cardsIn(canvasElement);
    const pills = cards.map((card) => card.querySelector('span.uppercase') as HTMLElement);

    /* The four branches of `getInClinicStatusMeta`, including the default: a
       REQUESTED booking is not "Requested" here, it is "Booked". */
    await expect(pills.map((pill) => pill.textContent?.trim())).toEqual([
      'In progress',
      'Checked in',
      'Arriving',
      'Booked',
    ]);

    /* Four distinct inks. The pill carries its colour inline from a CSS variable,
       so a token that failed to resolve would leave every status inheriting the
       same body ink - four differently worded pills that all look identical. */
    const inks = pills.map((pill) => globalThis.getComputedStyle(pill).color);
    await expect(new Set(inks).size).toBe(4);

    /* The leading dot is `bg-current`, so it tracks the status ink instead of
       carrying its own copy of the palette. If it ever stopped, three of the four
       statuses would get a dot in the wrong colour and only the fourth would
       still look right. */
    for (const [index, pill] of pills.entries()) {
      const dot = pill.querySelector('span') as HTMLElement;
      await expect(globalThis.getComputedStyle(dot).backgroundColor).toBe(inks[index]);
    }
  },
};

export const UnlinkedBooking: Story = {
  name: 'A booking with no id is not a button',
  beforeEach: withClinicDay([
    booking({
      id: 'appt-1',
      companionId: 'companion-1',
      name: 'Poppy',
      concern: 'Vaccination booster',
      status: 'CHECKED_IN',
      start: at(0, 9, 15),
    }),
    booking({
      companionId: 'companion-2',
      name: 'Mango',
      species: 'cat',
      concern: 'Dental check',
      start: at(0, 10, 40),
    }),
  ]),
  play: async ({ canvasElement }) => {
    const router = getRouter();
    const cards = cardsIn(canvasElement);
    await expect(cards).toHaveLength(2);

    // Both are drawn identically. Only one of them can be operated.
    const [linked, unlinked] = cards;
    await expect(linked).toHaveAttribute('role', 'button');
    await expect(unlinked.getAttribute('role')).toBeNull();
    await expect(unlinked.getAttribute('tabindex')).toBeNull();
    /* And it carries no `aria-label` either. A card that kept the label while
       losing the handler is the worse failure: it announces itself as an
       operable control and then does nothing. */
    await expect(unlinked.getAttribute('aria-label')).toBeNull();

    const before = router.push.mock.calls.length;
    await userEvent.click(unlinked);
    await expect(router.push.mock.calls.length).toBe(before);
  },
};

export const LongContent: Story = {
  name: 'Long name and subtitle clamp to one line',
  args: {
    companions: [
      companionRecord({
        id: 'companion-1',
        name: 'Bartholomew Cornelius Wigglesworth III',
        breed: 'Long-haired Miniature Dachshund',
      }),
      companionRecord({ id: 'companion-2', name: 'Mango', type: 'cat', breed: 'Ragdoll' }),
    ],
  },
  beforeEach: withClinicDay([
    booking({
      id: 'appt-1',
      companionId: 'companion-1',
      name: 'Bartholomew Cornelius Wigglesworth III',
      concern: 'Post-operative wound check and suture removal',
      status: 'IN_PROGRESS',
      start: at(0, 9, 15),
    }),
    booking({
      id: 'appt-2',
      companionId: 'companion-2',
      name: 'Mango',
      species: 'cat',
      concern: 'Dental check',
      status: 'CHECKED_IN',
      start: at(0, 10, 40),
    }),
  ]),
  play: async ({ canvasElement }) => {
    const [long, short] = cardsIn(canvasElement);
    const [name, subtitle] = [...long.querySelectorAll('span.truncate')] as HTMLElement[];

    for (const line of [name, subtitle]) {
      const style = globalThis.getComputedStyle(line);
      await expect(style.textOverflow).toBe('ellipsis');
      await expect(style.whiteSpace).toBe('nowrap');
      await expect(style.overflow).toBe('hidden');
      // Actually overflowing, so the clamp is doing work rather than being
      // asserted on content that happens to fit.
      await expect(line.scrollWidth).toBeGreaterThan(line.clientWidth);
    }

    /* The long card does not push the row: the grid track, not the content,
       decides the width. Without `min-w-0` on the text column a flex child
       refuses to shrink below its content and one long name widens the card it
       is in, so the four columns stop matching. */
    await expect(Math.round(long.getBoundingClientRect().width)).toBe(
      Math.round(short.getBoundingClientRect().width)
    );
    // The status pill keeps its full width beside the clamped text.
    const pill = long.querySelector('span.uppercase') as HTMLElement;
    await expect(pill.scrollWidth).toBeLessThanOrEqual(pill.clientWidth);
  },
};

export const EmptyClinic: Story = {
  name: 'Nothing booked today: the band disappears',
  beforeEach: withClinicDay([
    booking({
      id: 'appt-yesterday',
      companionId: 'companion-1',
      name: 'Poppy',
      start: at(-1, 9, 0),
    }),
    booking({ id: 'appt-tomorrow', companionId: 'companion-1', name: 'Poppy', start: at(1, 9, 0) }),
  ]),
  play: async ({ canvasElement }) => {
    /* `if (cards.length === 0) return null` - not a hidden section, not a zero
       height one. The header, the "Open today's schedule" link and the whole row
       are absent, so the directory below moves up rather than sitting under a
       band of nothing. */
    await expect(canvasElement.querySelector('section')).toBeNull();
    await expect(cardsIn(canvasElement)).toHaveLength(0);
    await expect(canvasElement.textContent).not.toContain('In the clinic today');
    await expect(canvasElement.textContent).not.toContain("Open today's schedule");
  },
};

export const Phone: Story = {
  name: 'Phone: a snap-scrolling rail',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const cards = cardsIn(canvasElement);
    const row = cards[0].parentElement as HTMLElement;

    /* Below 768px the row is a horizontal flex rail instead of the four-column
       grid, and the snap contract is what makes it usable with a thumb: the rail
       snaps on the x axis and every card is a snap point. Neither is behind the
       breakpoint, so both are assertable at any width - which matters, because
       the flex/grid swap itself is not. */
    await expect(globalThis.getComputedStyle(row).scrollSnapType).toContain('x');
    for (const card of cards) {
      await expect(globalThis.getComputedStyle(card).scrollSnapAlign).toBe('start');
    }

    // The rail absorbs its own overflow; the page never scrolls sideways.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
