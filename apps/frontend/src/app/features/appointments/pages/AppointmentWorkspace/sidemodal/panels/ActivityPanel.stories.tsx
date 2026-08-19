import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import ActivityPanel from './ActivityPanel';

const ORG_ID = 'org-storybook';

/**
 * The appointment deliberately carries no `id`.
 *
 * `useAppointmentAuditTrail` short-circuits to an empty list when there is no
 * appointment id and never touches the network; with an id it POSTs to
 * `/v1/audit-trail/appointment`, and offline that request fails into the same
 * empty list a beat later. So this fixture reaches exactly the state a real
 * appointment reaches in Storybook, just deterministically and without a
 * request. It is not a shortcut around a state the panel could otherwise show.
 */
const APPOINTMENT: Appointment = {
  patient: {
    id: 'companion-1',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

const membership = (roleCode: string, roleDisplay: string): UserOrganization => ({
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode,
  roleDisplay,
  active: true,
});

type OrgStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Seeds the org store the way bootstrap does and restores it on unmount.
 *
 * `usePermissions` derives the effective set from `roleCode` against the role
 * table rather than from the stored `effectivePermissions` snapshot, so seeding
 * the role is the whole fixture - `audit:view:any` belongs to OWNER, ADMIN and
 * SUPERVISOR only, which is why VETERINARIAN is the denial case here.
 */
const withMembership = (member: UserOrganization | null, status: OrgStatus = 'loaded') => {
  return () => {
    const snapshot = useOrgStore.getState();
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: member ? { [ORG_ID]: member } : {},
      status,
    });
    return () => {
      useOrgStore.setState(snapshot);
    };
  };
};

const meta = {
  title: 'Workspace/ActivityPanel',
  component: ActivityPanel,
  parameters: {
    layout: 'padded',
    // The denial path renders PermissionDeniedState, which calls next/navigation's
    // useRouter during render.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "The Activity tab of the quick-actions drawer: the appointment's audit trail as a " +
          'vertical timeline. It had no story, and the states below are the ones reachable ' +
          'without a backend.\n\n' +
          'The panel is wrapped in a `PermissionGate` on `audit:view:any`, which only OWNER, ' +
          'ADMIN and SUPERVISOR carry - so for a veterinarian, a technician or a receptionist ' +
          'this tab is a permission notice, not a timeline. That is a third of the roles in the ' +
          'product seeing a different panel from the one the design shows, and it had never been ' +
          'drawn. The gate is also passed no `skeleton`, so while memberships are still ' +
          'resolving it renders **nothing at all** - a blank panel that reads as "no activity" ' +
          'rather than "still loading".\n\n' +
          '**Not covered here: the populated timeline.** The entries come from ' +
          '`useAppointmentAuditTrail`, which POSTs to the audit endpoint on mount with no store ' +
          'or cache in front of it, and this Storybook has no request-mocking layer. So the ' +
          'four `ActorChip` variants (team-member initials on a rotating warm palette, the pink ' +
          'parent glyph, the blue system flask, the neutral bordered fallback), the 1.5px ' +
          'connector rail that stops on the last row, and the `Entity · timestamp` detail line ' +
          'are all still undrawn. Reaching them needs a service stub, which is a separate piece ' +
          'of Storybook wiring rather than something a story file can do.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: APPOINTMENT,
  },
  decorators: [
    (Story) => (
      <div className="w-[498px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: withMembership(membership('OWNER', 'Owner')),
} satisfies Meta<typeof ActivityPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Permitted, nothing recorded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nothing to show')).toBeInTheDocument();
    // The empty copy replaces the timeline outright - there is no empty <ol>.
    await expect(canvasElement.querySelectorAll('ol')).toHaveLength(0);
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(0);
    // And it is the permitted branch, not the denial one.
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An owner opening Activity on an appointment with no recorded events. The copy is a ' +
          'single centred `text-body-4` line with no icon and no explanation of what would ' +
          'appear here - worth comparing against the richer empty states elsewhere in the ' +
          'workspace before this ships as the real "no history yet" screen.',
      },
    },
  },
};

export const PermissionDenied: Story = {
  name: 'Role without audit:view:any',
  beforeEach: withMembership(membership('VETERINARIAN', 'Veterinarian')),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `Fallback` renders PermissionDeniedState's inline variant inside an
       <output>, whose implicit role is `status` - so the notice is announced
       when it replaces the panel. */
    const notice = canvas.getByRole('status');
    await expect(notice).toBeInTheDocument();

    // The role is quoted from the seeded membership, not hardcoded in the copy.
    await expect(
      within(notice).getByText(/^Your role \(Veterinarian\) can.t view this section\.$/)
    ).toBeInTheDocument();
    await expect(
      within(notice).getByRole('button', { name: 'Request access' })
    ).toBeInTheDocument();

    // The timeline and its empty copy are both absent - this is a third branch.
    await expect(canvas.queryByText('Nothing to show')).not.toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('ol')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a veterinarian, technician, assistant or receptionist actually sees on this tab. ' +
          '`audit:view:any` sits with OWNER, ADMIN and SUPERVISOR, so the clinical roles get the ' +
          'compact lock notice with their own role name and a route to request access. Changing ' +
          'the seeded `roleCode` in this story is enough to check any other role - the ' +
          'permission set is derived from the role table, never from a stored snapshot.',
      },
    },
  },
};

export const PermissionsResolving: Story = {
  name: 'Blank while memberships resolve',
  beforeEach: withMembership(null, 'loading'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* "Renders nothing" has to be measured, not inferred from a handful of
       missing strings - a story that failed to mount looks identical to one that
       rendered null. So the story's own wrapper is read directly: the decorator
       div is the panel's only parent, and the gate's null leaves it with zero
       element children and no text at all. If ActivityPanel ever gained a
       skeleton, a border or even a spacer, this is the assertion that fails. */
    const wrapper = canvasElement.querySelector('div.max-w-full') as HTMLElement;
    await expect(wrapper).not.toBeNull();
    await expect(wrapper.children).toHaveLength(0);
    await expect(wrapper.textContent).toBe('');

    /* And it is genuinely the loading branch, not the permitted-but-empty one or
       the denial: both of those render inside that wrapper. */
    await expect(canvas.queryByText('Nothing to show')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('ol, li')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gap between the drawer opening and the org memberships landing. Every other panel ' +
          'in this drawer shows the pulsing `PanelSkeleton` while its chunk loads, then its own ' +
          'loading copy; Activity shows an empty box instead, because the gate falls back to ' +
          '`null`. Passing a `skeleton` to the gate would be a one-line fix, and this story is ' +
          'where the difference is visible.',
      },
    },
  },
};
