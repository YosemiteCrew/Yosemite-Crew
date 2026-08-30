import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import axios, { type AxiosResponse } from 'axios';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import type { AuditTrail } from '@/app/features/audit/types/audit';
import { clearInFlightAuditRequests } from '@/app/features/audit/services/auditService';
import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';

import Audit from './Audit';

const ORG_ID = 'org-storybook';

const membership = (roleCode: string, roleDisplay: string): UserOrganization => ({
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode,
  roleDisplay,
  active: true,
});

const appointment = (id: string): Appointment => ({
  id,
  patient: {
    id: 'companion-1',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
});

/**
 * Entries are built with local-time constructors rather than UTC literals: the
 * card runs them through `formatDateTimeLocal`, so a `Z` literal would render a
 * different hour depending on the runner's offset.
 */
const entry = (
  overrides: Partial<AuditTrail> & Pick<AuditTrail, 'id' | 'eventType'>
): AuditTrail => ({
  organisationId: ORG_ID,
  companionId: 'companion-1',
  occurredAt: new Date(2026, 2, 12, 9, 41),
  ...overrides,
});

const TRAIL: AuditTrail[] = [
  entry({
    id: 'audit-1',
    eventType: 'APPOINTMENT_CREATED',
    entityType: 'APPOINTMENT',
    actorType: 'PMS_USER',
    actorName: 'Dr. Weber',
  }),
  entry({
    id: 'audit-2',
    eventType: 'INVOICE_PAID',
    entityType: 'INVOICE',
    actorType: 'PARENT',
    actorName: 'Lena Hartmann',
    occurredAt: new Date(2026, 2, 12, 10, 5),
  }),
  entry({
    id: 'audit-3',
    eventType: 'DOCUMENT_ADDED',
    entityType: 'DOCUMENT',
    actorType: 'PMS_USER',
    actorName: null,
    occurredAt: new Date(2026, 2, 12, 10, 12),
  }),
  entry({
    id: 'audit-4',
    eventType: 'FORM_SUBMITTED',
    entityType: 'FORM',
    actorType: 'SYSTEM',
    occurredAt: new Date(2026, 2, 12, 10, 20),
  }),
  entry({
    id: 'audit-5',
    eventType: 'COMPANION_ORG_LINK_APPROVED',
    entityType: 'COMPANION_ORGANISATION',
    actorType: 'PMS_USER',
    actorName: 'Priya Raman',
    occurredAt: new Date(2026, 2, 12, 10, 31),
  }),
  entry({
    id: 'audit-6',
    eventType: 'APPOINTMENT_RESCHEDULED',
    actorType: 'PMS_USER',
    actorName: 'Marta Silva',
    occurredAt: new Date(2026, 2, 12, 10, 44),
  }),
];

/**
 * `useAppointmentAuditTrail` POSTs to `/v1/audit-trail/appointment` on mount
 * with no store or cache in front of it, so the only place to answer it is the
 * transport. Swapping the axios instance's adapter keeps the hook, the service,
 * its in-flight dedupe and the interceptors all real - the request is built and
 * routed exactly as it is in the product, it just never leaves the iframe.
 *
 * Anything that is not the audit endpoint falls through to the browser adapter,
 * so this cannot silently swallow a request some other part of the tree makes.
 */
const REAL_ADAPTER = axios.getAdapter(api.defaults.adapter);

const seed = (options: { role?: UserOrganization | null; entries?: AuditTrail[] | 'stalled' }) => {
  const { role = membership('OWNER', 'Owner'), entries = [] } = options;
  const orgSnapshot = useOrgStore.getState();
  const originalAdapter = api.defaults.adapter;

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: role ? { [ORG_ID]: role } : {},
    status: 'loaded',
  });

  api.defaults.adapter = (async (config) => {
    if (String(config.url ?? '').includes('/v1/audit-trail/appointment')) {
      // A promise that never settles is the honest shape of "still loading":
      // a timer would race the play function.
      if (entries === 'stalled') return new Promise<AxiosResponse>(() => {});
      return {
        data: { entries },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    }
    return REAL_ADAPTER(config);
  }) as typeof api.defaults.adapter;

  return () => {
    api.defaults.adapter = originalAdapter;
    /* The service shares one promise per (org, appointment) while a read is in
       flight. The stalled story never settles, so without this the NEXT story
       to ask for the same appointment would be handed that dead promise and sit
       on an empty list forever. */
    clearInFlightAuditRequests();
    useOrgStore.setState(orgSnapshot);
  };
};

/** Every badge on the canvas as `label -> the token its background resolves to`. */
const badgeTones = (canvasElement: HTMLElement): Record<string, string> =>
  Object.fromEntries(
    [...canvasElement.querySelectorAll<HTMLElement>('span.yc-status-pill')].map((pill) => [
      pill.textContent ?? '',
      pill.style.backgroundColor,
    ])
  );

const meta = {
  title: 'Appointments/Audit',
  component: Audit,
  parameters: {
    layout: 'padded',
    // The denied branch renders PermissionDeniedState, which calls useRouter.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "The Audit tab of the appointment record: the appointment's trail as a flat list of " +
          'cards, one per event, each carrying a title-cased event name, an entity badge, the ' +
          'actor and a local timestamp.\n\n' +
          'Two mappings do all the work and both fail silently. `getAuditEntityLabel` renames ' +
          'the stored entity - `INVOICE` reads **Finance**, `FORM` reads **Template**, ' +
          '`COMPANION_ORGANISATION` reads **Companion profile** - and `getAuditEntityTone` ' +
          'colours it, with everything outside APPOINTMENT/INVOICE/DOCUMENT falling to neutral. ' +
          'A wrong tone is a slightly different shade of pill, so the stories below read the ' +
          'resolved colour token rather than looking at it.\n\n' +
          'The whole panel sits behind `audit:view:any`, which only OWNER, ADMIN and SUPERVISOR ' +
          'carry, so for the clinical roles this tab is a permission notice.\n\n' +
          '**There is no loading state.** `useAppointmentAuditTrail` starts at `[]` and exposes ' +
          'no pending flag, so an appointment whose trail has not arrived yet is drawn exactly ' +
          'like an appointment with no history - see the "Still loading" story, which is ' +
          'pixel-identical to "Nothing recorded". On a slow read that reads as a false ' +
          'statement about a clinical record.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeAppointment: appointment('appt-audit-populated'),
  },
  decorators: [
    (Story) => (
      <div className="w-[560px] max-w-full">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => seed({ entries: TRAIL }),
} satisfies Meta<typeof Audit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: 'A mixed trail',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // One card per entry, counted by the line every card carries.
    const actors = await canvas.findAllByText(/^Updated by: /);
    await expect(actors).toHaveLength(TRAIL.length);

    /* The renaming is the whole point of `getAuditEntityLabel`, and none of
       these three labels is guessable from the stored value. */
    const tones = badgeTones(canvasElement);
    await expect(Object.keys(tones).sort()).toEqual([
      'Appointment',
      'Companion profile',
      'Document',
      'Finance',
      'Template',
    ]);

    /* Five badges for six cards: the rescheduled entry carries no entityType,
       and the card omits the badge rather than drawing an empty pill. */
    await expect(Object.keys(tones)).toHaveLength(TRAIL.length - 1);

    /* Tone per entity, read from the resolved token. Two neutrals here for two
       different reasons: FORM and COMPANION_ORGANISATION both fall off the end
       of the tone map, so a new tone for either would land silently. */
    await expect(tones.Appointment).toBe('var(--color-pill-accent-bg)');
    await expect(tones.Finance).toBe('var(--color-pill-success-bg)');
    await expect(tones.Document).toBe('var(--color-pill-warning-bg)');
    await expect(tones.Template).toBe('var(--color-pill-neutral-bg)');
    await expect(tones['Companion profile']).toBe('var(--color-pill-neutral-bg)');

    /* Actor line: name and role type, or the role type alone when the record
       has no name. `DOCUMENT_ADDED` was written by a team member the audit row
       could not name, and it must not render a dangling separator. */
    await expect(canvas.getByText('Updated by: Dr. Weber • Team member')).toBeInTheDocument();
    await expect(canvas.getByText('Updated by: Lena Hartmann • Pet parent')).toBeInTheDocument();
    await expect(canvas.getByText('Updated by: Team member')).toBeInTheDocument();
    await expect(canvas.getByText('Updated by: System')).toBeInTheDocument();

    /* Enum leakage: every event name is title-cased before it is drawn, so the
       stored SCREAMING_CASE must not survive anywhere on the canvas. */
    await expect(canvas.getByText('Appointment created')).toBeInTheDocument();
    await expect(canvas.getByText('Companion org link approved')).toBeInTheDocument();
    await expect(canvasElement.textContent).not.toMatch(/[A-Z]{3,}_[A-Z]/);

    // Timestamps are rendered, not left on the '-' fallback the card falls back to.
    const stamps = canvasElement.querySelectorAll('div.shrink-0.text-caption-1');
    await expect(stamps).toHaveLength(TRAIL.length);
    for (const stamp of stamps) {
      await expect(stamp.textContent?.trim()).not.toBe('');
      await expect(stamp.textContent).not.toBe('—');
    }
  },
};

export const Empty: Story = {
  name: 'Nothing recorded',
  args: { activeAppointment: appointment('appt-audit-empty') },
  beforeEach: () => seed({ entries: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nothing to show')).toBeInTheDocument();
    // The empty copy replaces the list outright - no empty card frame is left.
    await expect(canvasElement.querySelectorAll('span.yc-status-pill')).toHaveLength(0);
    await expect(canvas.queryByText(/^Updated by: /)).not.toBeInTheDocument();
    // And it is the permitted branch, not the denial one.
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
};

export const StillLoading: Story = {
  name: 'Still loading',
  args: { activeAppointment: appointment('appt-audit-stalled') },
  beforeEach: () => seed({ entries: 'stalled' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The read is held open, and the card claims the record is empty anyway.
       This is the assertion to change if a pending flag is ever added: today
       "we have not asked yet" and "there is nothing" are the same screen. */
    await expect(canvas.getByText('Nothing to show')).toBeInTheDocument();
    await expect(
      canvasElement.querySelectorAll('[role="progressbar"], .animate-pulse')
    ).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The audit read is stalled for the life of the story. Compare it side by side with ' +
          '"Nothing recorded" - they are the same picture, and nothing on the surface tells a ' +
          'vet which one they are looking at.',
      },
    },
  },
};

export const PermissionDenied: Story = {
  name: 'Role without audit:view:any',
  beforeEach: () => seed({ role: membership('VETERINARIAN', 'Veterinarian'), entries: TRAIL }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Fallback renders PermissionDeniedState's inline variant inside an
       <output>, whose implicit role is `status`, so the refusal is announced
       rather than just drawn. */
    const notice = canvas.getByRole('status');
    await expect(
      within(notice).getByText(/^Your role \(Veterinarian\) can.t view this section\.$/)
    ).toBeInTheDocument();

    /* The trail is seeded and would have rendered six cards for an owner. None
       of it reaches the DOM: the gate withholds the content, it does not blur
       or truncate it. */
    await expect(canvas.queryByText(/^Updated by: /)).not.toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('span.yc-status-pill')).toHaveLength(0);
    await expect(canvas.queryByText('Nothing to show')).not.toBeInTheDocument();
  },
};

export const NoMembership: Story = {
  name: 'No membership on the org',
  beforeEach: () => seed({ role: null, entries: TRAIL }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* No role at all resolves to a denial rather than a wait: the gate is given
       no `skeleton`, and `usePermissions` on a loaded store with no membership
       simply says no. Worth knowing that the first frame after a slow
       membership fetch is a permission refusal, not a spinner. */
    await expect(canvas.getByRole('status')).toBeInTheDocument();
    await expect(canvas.queryByText('Nothing to show')).not.toBeInTheDocument();
  },
};
