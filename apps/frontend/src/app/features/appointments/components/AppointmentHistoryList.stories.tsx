import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, within } from 'storybook/test';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';

import AppointmentHistoryList from './AppointmentHistoryList';

const ORG_ID = 'org-history-list';
const COMPANION_ID = 'companion-bruno';
const OTHER_COMPANION_ID = 'companion-mochi';
const TIMEZONE_KEY = 'yc_preferred_timezone';

const buildMembership = (overrides: Partial<UserOrganization> = {}): UserOrganization => ({
  practitionerReference: 'Practitioner/user-history-list',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
  ...overrides,
});

/**
 * A past visit. Note it carries `patient` and NOT `companion`: that is what the
 * appointments endpoint actually returns, and the hook backfills `companion`
 * from it. A fixture that set `companion` directly would render identically
 * while quietly skipping the fallback every row here depends on.
 *
 * `concern` is the per-visit marker the ordering assertions read, so the sort
 * check does not depend on the runner's timezone the way a date label would.
 */
const visit = (
  id: string,
  companionId: string,
  companionName: string,
  startTime: Date,
  concern: string
): Appointment => ({
  id,
  patient: {
    id: companionId,
    name: companionName,
    species: 'dog',
    breed: 'Rhodesian Ridgeback',
    parent: { id: 'parent-1', name: 'Sarah Whitfield' },
  },
  lead: { id: 'pract-1', name: 'Dr. Amara Okafor' },
  room: { id: 'room-3', name: 'Consult 3' },
  appointmentType: {
    id: 'type-1',
    name: 'Annual check-up',
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  appointmentKind: 'OUTPATIENT',
  organisationId: ORG_ID,
  appointmentDate: startTime,
  startTime,
  endTime: new Date(startTime.getTime() + 30 * 60_000),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'COMPLETED',
  concern,
});

const OLDEST = visit(
  'appt-2025-11-03',
  COMPANION_ID,
  'Bruno',
  new Date('2025-11-03T08:15:00.000Z'),
  'Kennel cough follow-up'
);
const MIDDLE = visit(
  'appt-2026-01-08',
  COMPANION_ID,
  'Bruno',
  new Date('2026-01-08T09:00:00.000Z'),
  'Limping on the left hind leg'
);
const NEWEST = visit(
  'appt-2026-01-22',
  COMPANION_ID,
  'Bruno',
  new Date('2026-01-22T14:30:00.000Z'),
  'Post-op wound check'
);
/**
 * Another companion in the SAME organisation, and deliberately the most recent
 * booking in the store. If the companion filter ever stopped applying, this row
 * would take the top of the list rather than merely appearing at the bottom -
 * which is the difference between an obvious bug and one nobody notices until a
 * clinician reads another animal's history.
 */
const OTHER_COMPANION = visit(
  'appt-2026-02-01',
  OTHER_COMPANION_ID,
  'Mochi',
  new Date('2026-02-01T09:00:00.000Z'),
  'Dental scale and polish'
);

/** Store order, NOT date order - the component is what has to sort. */
const BRUNO_HISTORY = [MIDDLE, OLDEST, NEWEST, OTHER_COMPANION];

/**
 * The list reads three stores and no props beyond the companion id, so the
 * fixture is the state rather than the args.
 *
 * - org: `primaryOrgId` scopes the appointment lookup, the membership is what
 *   PermissionGate resolves COMPANIONS_VIEW_ANY from, and `status` has to be
 *   'loaded' or `usePermissions` reports isLoading and the gate renders its
 *   (null) skeleton forever.
 * - appointments: the rows themselves.
 * - team: `AppointmentCardContent` calls `useLoadTeam`, which only skips its
 *   request when `teamIdsByOrgId` already OWNS a key for the primary org. The
 *   empty array is therefore load-bearing - drop it and every story here fires
 *   a real team request.
 *
 * All three are snapshotted and restored on unmount, along with the stored
 * timezone token, which is cleared so the date labels are formatted against the
 * Europe/Berlin default rather than whatever the timezone settings story left
 * behind.
 */
const withHistory =
  (appointments: Appointment[], membershipOverrides: Partial<UserOrganization> = {}) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const appointmentSnapshot = useAppointmentStore.getState();
    const teamSnapshot = useTeamStore.getState();
    const storedZone = globalThis.localStorage.getItem(TIMEZONE_KEY);

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: buildMembership(membershipOverrides) },
      status: 'loaded',
    });
    useAppointmentStore.setState({
      appointmentsById: Object.fromEntries(appointments.map((a) => [a.id as string, a])),
      appointmentIdsByOrgId: { [ORG_ID]: appointments.map((a) => a.id as string) },
      status: 'loaded',
    });
    useTeamStore.setState({ teamsById: {}, teamIdsByOrgId: { [ORG_ID]: [] }, status: 'loaded' });
    globalThis.localStorage.removeItem(TIMEZONE_KEY);

    return () => {
      useOrgStore.setState(orgSnapshot);
      useAppointmentStore.setState(appointmentSnapshot);
      useTeamStore.setState(teamSnapshot);
      if (storedZone === null) globalThis.localStorage.removeItem(TIMEZONE_KEY);
      else globalThis.localStorage.setItem(TIMEZONE_KEY, storedZone);
    };
  };

/** The cards the list renders, in DOM order. */
const cardsIn = (canvasElement: HTMLElement) => [
  ...canvasElement.querySelectorAll<HTMLElement>('.border-card-border'),
];

/**
 * The reasons down the list, read from each card's own "Reason:" row rather
 * than from a text query, so the result is in DOM order.
 */
const reasonsIn = (canvasElement: HTMLElement) =>
  cardsIn(canvasElement).map((card) =>
    [...card.querySelectorAll('div')]
      .find((row) => row.textContent === 'Reason:')
      ?.nextElementSibling?.textContent?.trim()
  );

/**
 * The narrow column this list is designed to sit in beside a companion record.
 * `max-w` rather than a fixed width: a hard 360px would itself overflow the
 * 375px phone viewport and make the Phone story fail on the wrapper instead of
 * on the component under test.
 */
const Panel = (Story: React.ComponentType) => (
  <div className="flex justify-center p-4">
    <div className="w-full max-w-[360px]">
      <Story />
    </div>
  </div>
);

const meta = {
  title: 'Appointments/AppointmentHistoryList',
  component: AppointmentHistoryList,
  decorators: [Panel],
  parameters: {
    layout: 'fullscreen',
    // A denied check renders Fallback -> PermissionDeniedState, which calls
    // next/navigation's useRouter during render.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "One companion's visit history: every appointment the primary organisation holds for " +
          'that companion, newest first, each in its own card. The only prop is the companion id ' +
          '- the rows, the permission check and the practitioner names all come out of stores, ' +
          'which is why these stories seed state rather than pass args.\n\n' +
          'Three things here fail quietly rather than loudly. The list is sorted on `startTime` ' +
          'in the component, not by the store, so a dropped sort still renders every visit, just ' +
          'in arrival order. The rows are filtered to ONE companion out of the whole org, so a ' +
          "dropped filter renders another animal's history under this animal's name. And the " +
          'whole thing sits behind a COMPANIONS_VIEW_ANY gate whose denial is a compact notice, ' +
          'not a blank panel.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companionId: COMPANION_ID,
  },
} satisfies Meta<typeof AppointmentHistoryList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three visits, newest first',
  beforeEach: withHistory(BRUNO_HISTORY),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Seeded as middle, oldest, newest - so store order, reverse-chronological
       order and chronological order are all different. Only the sorted order
       can produce this sequence, which is the point: a `sort` that was removed
       or flipped still renders three plausible-looking cards. */
    await expect(reasonsIn(canvasElement)).toEqual([
      'Post-op wound check',
      'Limping on the left hind leg',
      'Kennel cough follow-up',
    ]);

    /* Mochi's visit is the newest booking in the org and belongs to a different
       companion, so it must be absent entirely - not just further down. */
    await expect(cardsIn(canvasElement)).toHaveLength(3);
    await expect(canvas.queryByText('Dental scale and polish')).toBeNull();

    /* The fixtures set `patient` and never `companion`. The header naming the
       animal only appears because the hook backfills one from the other; lose
       that and the list filters to nothing and renders the empty state. */
    await expect(canvas.getAllByText('Bruno · Whitfield')).toHaveLength(3);

    /* Measured, not read off the class list: `gap-3` is the only thing keeping
       the cards apart, since each card's border is its own edge. Cards that
       touch read as one long card with internal rules. */
    const [first, second] = cardsIn(canvasElement);
    const gap = second.getBoundingClientRect().top - first.getBoundingClientRect().bottom;
    await expect(Math.round(gap)).toBe(12);
  },
};

export const Empty: Story = {
  name: 'A companion with no visits',
  beforeEach: withHistory([OTHER_COMPANION]),
  parameters: {
    docs: {
      description: {
        story:
          'The organisation has an appointment on file, it just is not this companion’s. The ' +
          'empty state is about the companion, not about the org, so seeding an entirely empty ' +
          'store would pass this story without ever proving the filter runs.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No appointments found')).toBeInTheDocument();
    // No card at all, rather than an empty card frame with a message inside it.
    await expect(cardsIn(canvasElement)).toHaveLength(0);
  },
};

export const PermissionDenied: Story = {
  name: 'Companion access revoked',
  beforeEach: withHistory(BRUNO_HISTORY, { revokedPermissions: ['companions:view:any'] }),
  parameters: {
    docs: {
      description: {
        story:
          'Every role baseline carries `companions:view:any`, so the only way a real membership ' +
          'loses it is an explicit revocation - which is exactly what this story seeds. The gate ' +
          'renders the inline denial notice, which names the caller’s actual role and offers a ' +
          'route to ask for access, instead of the bare panel a `fallback` of `null` would leave.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The notice is an <output>, whose implicit role is `status`. That is what
       makes a denial that appears after the permissions resolve get announced
       at all - a plain <div> would swap the panel silently. */
    const notice = canvas.getByRole('status');
    await expect(notice).toHaveTextContent("Your role (Veterinarian) can't view this section.");
    await expect(canvas.getByRole('button', { name: 'Request access' })).toBeInTheDocument();

    /* Denied means not rendered, not hidden. The appointment data must be off
       the page entirely - a visually hidden card is still in the DOM, still in
       the accessibility tree and still copy-pasteable. */
    await expect(cardsIn(canvasElement)).toHaveLength(0);
    await expect(canvasElement.textContent).not.toContain('Post-op wound check');
  },
};

export const Phone: Story = {
  name: 'Phone',
  beforeEach: withHistory(BRUNO_HISTORY),
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    // The Reason line is untruncated free text, so it is what would push a card
    // - and the page behind it - sideways on a 375px screen.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
    for (const card of cardsIn(canvasElement)) {
      await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
    }
  },
};
