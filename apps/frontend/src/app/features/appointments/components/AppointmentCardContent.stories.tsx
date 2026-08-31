import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';

import AppointmentCardContent, {
  AppointmentCompanionHeader,
  AppointmentModePill,
  AppointmentStatusBadge,
  EncounterModePill,
} from './AppointmentCardContent';

const ORG_ID = 'org-appointment-card';
const TIMEZONE_KEY = 'yc_preferred_timezone';

/**
 * A fully populated booking. The instants are UTC literals on purpose: unlike a
 * calendar rail, nothing here reads LOCAL hours off the Date - both labels go
 * through `Intl` with an explicit `timeZone`, so a fixed instant produces a
 * fixed label on every runner. What the labels are pinned against is the
 * PREFERRED zone, which is why `beforeEach` clears the stored one below.
 */
const FULL: Appointment = {
  id: 'appt-card-1',
  patient: {
    id: 'companion-1',
    name: 'Bruno',
    species: 'dog',
    breed: 'Rhodesian Ridgeback',
    parent: { id: 'parent-1', name: 'Sarah Whitfield' },
  },
  lead: { id: 'pract-1', name: 'Dr. Amara Okafor' },
  supportStaff: [
    { id: 'staff-1', name: 'Nina Roth' },
    { id: 'staff-2', name: 'Tomas Berg' },
  ],
  room: { id: 'room-3', name: 'Consult 3' },
  appointmentType: {
    id: 'type-1',
    name: 'Annual check-up',
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  appointmentKind: 'OUTPATIENT',
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
  concern: 'Limping on the left hind leg since Sunday',
};

/** Everything optional stripped, plus a one-word owner name. */
const SPARSE: Appointment = {
  ...FULL,
  id: 'appt-card-2',
  patient: {
    id: 'companion-2',
    name: 'Mochi',
    species: 'cat',
    parent: { id: 'parent-2', name: 'Ines' },
  },
  lead: undefined,
  supportStaff: [],
  room: undefined,
  appointmentType: undefined,
  appointmentKind: undefined,
  concern: '',
  status: 'REQUESTED',
};

const buildTeam = (practionerId: string, name: string): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

/**
 * `AppointmentDetails` resolves a missing lead NAME by looking the lead id up in
 * the team roster, which means it reads two stores. Seeding both keeps the story
 * offline in a way a `fetch` stub could not: `useLoadTeam` only skips its request
 * when `teamIdsByOrgId` already OWNS a key for the primary org, so the index
 * entry has to be present even when the roster it points at is empty.
 *
 * Both stores are snapshotted and restored, so neighbouring stories are
 * unaffected.
 */
const withTeamRoster = (teams: Team[]) => () => {
  const orgSnapshot = useOrgStore.getState();
  const teamSnapshot = useTeamStore.getState();
  useOrgStore.setState({ primaryOrgId: ORG_ID });
  useTeamStore.setState({
    teamsById: Object.fromEntries(teams.map((team) => [team._id, team])),
    teamIdsByOrgId: { [ORG_ID]: teams.map((team) => team._id) },
    status: 'loaded',
  });
  return () => {
    useOrgStore.setState(orgSnapshot);
    useTeamStore.setState(teamSnapshot);
  };
};

/**
 * No primary org at all: `useLoadTeam` returns before it can call the team
 * service, so the everyday stories never touch the network. Clearing the stored
 * timezone token at the same time drops `getPreferredTimeZone()` back to its
 * Europe/Berlin default - without it a story run after someone had opened the
 * timezone settings story would format the same instant into a different hour
 * and fail for a reason that has nothing to do with this card.
 */
const withCleanEnvironment = () => {
  const orgSnapshot = useOrgStore.getState();
  const storedZone = globalThis.localStorage.getItem(TIMEZONE_KEY);
  useOrgStore.setState({ primaryOrgId: null });
  globalThis.localStorage.removeItem(TIMEZONE_KEY);
  return () => {
    useOrgStore.setState(orgSnapshot);
    if (storedZone === null) globalThis.localStorage.removeItem(TIMEZONE_KEY);
    else globalThis.localStorage.setItem(TIMEZONE_KEY, storedZone);
  };
};

/**
 * The value div beside a label, located from the label's own text. The field
 * renders `{label}:`, so the colon is part of the string to match - querying
 * `'Room'` finds nothing and the story would fail for the wrong reason.
 */
const valueFor = (canvasElement: HTMLElement, label: string): HTMLElement => {
  const labelEl = within(canvasElement).getByText(`${label}:`);
  return labelEl.nextElementSibling as HTMLElement;
};

/** The card these fragments are always rendered into, so the flex column is real. */
const Card = (Story: React.ComponentType) => (
  <div className="flex justify-center p-6">
    <div className="flex w-[320px] flex-col gap-2 rounded-2xl border border-card-border bg-neutral-0 p-3">
      <Story />
    </div>
  </div>
);

const meta = {
  title: 'Appointments/AppointmentCardContent',
  component: AppointmentCardContent,
  decorators: [Card],
  beforeEach: withCleanEnvironment,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The body of an appointment card - companion header, eight detail lines, the encounter ' +
          'mode pill and the status pill - plus the four pieces it exports for the board card, ' +
          'the appointments table, the calendar popover and the workspace context card. Those ' +
          'four surfaces import the PARTS, so a change here lands in all of them at once and ' +
          'this file is where that blast radius is visible.\n\n' +
          'Almost nothing on the card is stored the way it is shown. The header composes ' +
          '`{companion} · {owner last name}` and drops the suffix entirely for a one-word owner ' +
          'name. Every detail line falls back to a dash on an EMPTY string as well as on a ' +
          'missing value, which is what a joined-but-empty support-staff list produces. The date ' +
          'and time are formatted in the preferred timezone, not the stored UTC instant. The ' +
          'status pill title-cases a SCREAMING_CASE enum. And the mode pill is derived: an ' +
          'explicit `appointmentKind` wins, then an inpatient-sounding service name, then - only ' +
          'if both are silent - the presence of a room.\n\n' +
          'The one lookup that leaves the appointment is the lead. When the booking carries a ' +
          'lead id but no name, the name is resolved out of the team roster for the primary org, ' +
          'so this component reads the org and team stores as well as its prop.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: FULL,
  },
} satisfies Meta<typeof AppointmentCardContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Every field populated',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The header is composed, not stored: companion name, a middle dot, and the
    // owner's LAST name - with the owner's FIRST name on the line below.
    await expect(canvas.getByText('Bruno · Whitfield')).toBeInTheDocument();
    await expect(canvas.getByText('Sarah')).toBeInTheDocument();

    await expect(valueFor(canvasElement, 'Breed / Species')).toHaveTextContent(
      'Rhodesian Ridgeback / dog'
    );
    /* Berlin, not UTC: the stored instant is 09:30Z and March 12th is still CET,
       so the card must read 10:30 AM. A card that printed the raw instant would
       be an hour early all winter and two hours early all summer, and would look
       entirely plausible either way. */
    await expect(valueFor(canvasElement, 'Date / Time')).toHaveTextContent(
      'Mar 12, 2026 / 10:30 AM'
    );
    await expect(valueFor(canvasElement, 'Reason')).toHaveTextContent(
      'Limping on the left hind leg since Sunday'
    );
    await expect(valueFor(canvasElement, 'Speciality')).toHaveTextContent('General practice');
    await expect(valueFor(canvasElement, 'Service')).toHaveTextContent('Annual check-up');
    await expect(valueFor(canvasElement, 'Room')).toHaveTextContent('Consult 3');
    await expect(valueFor(canvasElement, 'Lead')).toHaveTextContent('Dr. Amara Okafor');
    // Support staff is a joined list, not one line each.
    await expect(valueFor(canvasElement, 'Staff')).toHaveTextContent('Nina Roth, Tomas Berg');

    /* This booking has a room AND an explicit OUTPATIENT kind. The kind wins:
       the room fallback only speaks when the backend said nothing. Flip the
       order of those checks in `resolveEncounterMode` and every outpatient
       appointment with a consult room assigned silently becomes an admission. */
    await expect(canvas.getByTitle('Outpatient')).toBeInTheDocument();
    await expect(canvas.getByTitle('Upcoming')).toBeInTheDocument();
  },
};

export const Sparse: Story = {
  name: 'Missing optional fields fall back to a dash',
  args: { appointment: SPARSE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* A one-word owner name yields no last name, so the header drops the
       separator entirely rather than rendering "Mochi · " with nothing after
       it. */
    await expect(canvas.getByText('Mochi')).toBeInTheDocument();
    await expect(canvas.getByText('Ines')).toBeInTheDocument();
    await expect(canvas.queryByText(/Mochi ·/)).toBeNull();

    // Breed alone is missing, so only the left half of the pair falls back.
    await expect(valueFor(canvasElement, 'Breed / Species')).toHaveTextContent('- / cat');

    for (const label of ['Reason', 'Speciality', 'Service', 'Room', 'Lead', 'Staff']) {
      await expect(valueFor(canvasElement, label)).toHaveTextContent('-');
    }

    /* `Staff` is the interesting one: `[].map(...).join(', ')` is an EMPTY
       STRING, not undefined. A field that only guarded null would render
       "Staff:" followed by nothing and read as a broken row. */
    await expect(valueFor(canvasElement, 'Staff').textContent).toBe('-');

    // Nothing to derive a mode from: no kind, no service name, no room.
    await expect(canvas.getByTitle('Outpatient')).toBeInTheDocument();
    await expect(canvas.getByTitle('Requested')).toBeInTheDocument();
  },
};

export const CompanionHeader: Story = {
  name: 'Companion header alone',
  render: ({ appointment }) => <AppointmentCompanionHeader appointment={appointment} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The avatar is `alt=""`, which makes it presentational - so it must NOT
       appear as an image to assistive tech. Give it the companion's name
       instead, as looks helpful, and every card in a list announces the pet
       twice: once for the picture, once for the heading beside it. */
    await expect(canvas.queryAllByRole('img')).toHaveLength(0);

    const avatar = canvasElement.querySelector('img') as HTMLImageElement;
    await expect(avatar).not.toBeNull();
    await expect(avatar.getAttribute('alt')).toBe('');

    /* Measured, not asserted from the class list: `size-10` plus
       `object-cover` is what keeps a portrait photo and the square species
       fallback the same 40px circle. A photo that arrived at its natural
       aspect would push the header taller than every other card in the row. */
    const box = avatar.getBoundingClientRect();
    await expect(Math.round(box.width)).toBe(40);
    await expect(Math.round(box.height)).toBe(40);
  },
};

export const ModeIsDerived: Story = {
  name: 'Encounter mode is derived, in order',
  render: ({ appointment }) => (
    <div className="flex flex-col gap-2">
      <AppointmentModePill appointment={appointment} className="w-fit" />
      <AppointmentModePill
        appointment={{ ...appointment, appointmentKind: undefined }}
        className="w-fit"
      />
      <AppointmentModePill
        appointment={{ ...appointment, appointmentKind: undefined, room: undefined }}
        className="w-fit"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The same booking three times, losing one signal each row. Top: an explicit ' +
          '`appointmentKind` of OUTPATIENT, which wins outright even though a room is assigned. ' +
          'Middle: the kind removed, so the assigned room is the only evidence left and the ' +
          'encounter reads as inpatient. Bottom: no kind and no room, back to outpatient. ' +
          'The middle row is the one that surprises people, and it is the reason the top row ' +
          'exists beside it.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const labels = [...canvasElement.querySelectorAll('.yc-status-pill')].map((pill) =>
      pill.textContent?.trim()
    );
    await expect(labels).toEqual(['Outpatient', 'Inpatient', 'Outpatient']);
  },
};

export const EncounterModes: Story = {
  name: 'Both encounter modes',
  render: () => (
    <div className="flex gap-2">
      <EncounterModePill mode="INPATIENT" />
      <EncounterModePill mode="OUTPATIENT" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inpatient = canvas.getByTitle('Inpatient');
    const outpatient = canvas.getByTitle('Outpatient');

    /* The pill's label is an icon plus a span, so `StatusPill`'s "use the label
       when it is a string" shortcut cannot apply and the title has to be passed
       explicitly. Without it a clamped pill - which is exactly the case the
       title exists for - would have no hover text at all. */
    await expect(inpatient).toHaveTextContent('Inpatient');
    await expect(outpatient).toHaveTextContent('Outpatient');

    /* And the glyph is hidden from the accessibility tree, so the pill announces
       its one word once. An icon that lost `aria-hidden` reads as an unlabelled
       graphic ahead of the word it duplicates. */
    for (const pill of [inpatient, outpatient]) {
      await expect(pill.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }

    // The two modes are distinguishable by more than the icon.
    await expect(globalThis.getComputedStyle(inpatient).backgroundColor).not.toBe(
      globalThis.getComputedStyle(outpatient).backgroundColor
    );
  },
};

const STATUSES: Appointment['status'][] = [
  'REQUESTED',
  'UPCOMING',
  'CHECKED_IN',
  'COMPLETED',
  'CANCELLED',
];

export const StatusMatrix: Story = {
  name: 'Status pill across the lifecycle',
  render: ({ appointment }) => (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((status) => (
        <AppointmentStatusBadge key={status} appointment={{ ...appointment, status }} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The pill is uppercased by CSS, so what is IN the DOM is the title-cased
       label - which is what a screen reader and a copy-paste both get. */
    for (const label of ['Requested', 'Upcoming', 'Checked in', 'Completed', 'Cancelled']) {
      await expect(canvas.getByText(label)).toBeInTheDocument();
    }

    /* The underscore is the tell. `toTitle` is what turns CHECKED_IN into
       "Checked in"; drop it anywhere on this path and the raw enum ships to the
       card looking like a shouty label rather than a bug. */
    await expect(canvasElement.textContent).not.toContain('CHECKED_IN');

    // Five statuses, five distinct tones - the pill is the only thing carrying
    // state on a card with no other colour.
    const tones = [...canvasElement.querySelectorAll('.yc-status-pill')].map(
      (pill) => globalThis.getComputedStyle(pill).backgroundColor
    );
    await expect(new Set(tones).size).toBe(STATUSES.length);
  },
};

export const LeadFromTeamStore: Story = {
  name: 'Lead name resolved from the roster',
  args: {
    appointment: { ...FULL, lead: { id: 'pract-77', name: '' } },
  },
  beforeEach: withTeamRoster([buildTeam('pract-77', 'Dr. Amara Okafor')]),
  parameters: {
    docs: {
      description: {
        story:
          'A booking that carries a lead ID but no lead NAME - which is what the appointment list ' +
          'endpoint returns when it has not joined the practitioner. The card looks the name up ' +
          'in the team roster for the primary org rather than rendering a dash, so a card and ' +
          'the calendar popover beside it cannot disagree about who is running the appointment.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(valueFor(canvasElement, 'Lead')).toHaveTextContent('Dr. Amara Okafor');
  },
};

export const LeadIdIsTheStringUndefined: Story = {
  name: 'A stringified undefined never matches',
  args: {
    appointment: { ...FULL, lead: { id: 'undefined', name: '' } },
  },
  beforeEach: withTeamRoster([buildTeam('undefined', 'Dr. Nobody')]),
  parameters: {
    docs: {
      description: {
        story:
          'Both sides of the lookup have been through `String(value)` on their way out of a ' +
          'backend, so a missing id can arrive as the literal text "undefined" or "null" - and ' +
          'two of those match each other perfectly. The roster here contains exactly that ' +
          'poisoned row. The card must report a dash rather than confidently name a practitioner ' +
          'nobody assigned.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(valueFor(canvasElement, 'Lead').textContent).toBe('-');
    await expect(within(canvasElement).queryByText('Dr. Nobody')).toBeNull();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    // The Reason line is free text with no truncation, so it is the line that
    // would push the card - and the page - sideways on a phone.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
    const card = canvasElement.querySelector('.rounded-2xl') as HTMLElement;
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
  },
};
