import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import OrgInvites from './OrgInvites';
import type { Invite } from '@/app/features/organization/types/team';

const invite = (index: number, organisationName: string, overrides: Partial<Invite> = {}): Invite =>
  ({
    _id: `invite-${index}`,
    organisationId: `org-${index}`,
    organisationName,
    organisationType: 'VET_CLINIC',
    invitedByUserId: 'user-owner',
    departmentId: `dept-${index}`,
    inviteeEmail: 'ravi.patel@example.com',
    role: 'VETERINARIAN',
    employmentType: 'FULL_TIME',
    token: `token-${index}`,
    status: 'PENDING',
    expiresAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z',
    ...overrides,
  }) as Invite;

const INVITES: Invite[] = [
  invite(1, 'Riverside Veterinary Clinic'),
  invite(2, 'Northgate Animal Hospital', { role: 'TECHNICIAN', employmentType: 'PART_TIME' }),
];

/**
 * Accepting or rejecting calls the team service and then navigates, so the play
 * functions here stop at what renders. The states below are the ones a user
 * actually meets on the organisation picker; the accept path is covered by the
 * service tests rather than by firing a real request from a story.
 */
const meta = {
  title: 'Tables/OrgInvites',
  component: OrgInvites,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Pending organisation invitations, shown above the org picker. It renders NOTHING when ' +
          'there are none - not an empty state - because the picker below it is already the ' +
          'answer to "you have no invitations", and a second empty panel would just push the ' +
          'real content down. While one invite is being accepted every card is disabled, so a ' +
          'double-tap cannot accept two organisations at once.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    invites: INVITES,
    setInvites: fn(),
    onAccepting: fn(),
    onNavigate: fn(),
  },
} satisfies Meta<typeof OrgInvites>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Two pending invitations',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Riverside Veterinary Clinic')).toBeInTheDocument();
    await expect(canvas.getByText('Northgate Animal Hospital')).toBeInTheDocument();
  },
};

export const Single: Story = {
  name: 'One invitation',
  args: { invites: [INVITES[0]] },
};

export const None: Story = {
  name: 'No invitations: nothing renders',
  args: { invites: [] },
  play: async ({ canvasElement }) => {
    /* Returns null rather than an empty state. The org picker underneath already
       says there is nothing waiting, so a second panel saying the same thing
       would only push the real content further down the page. */
    const root = canvasElement.querySelector('main');
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
    await expect(root?.textContent).not.toContain('Riverside');
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    // Invitation cards carry an organisation name the practice chose, so this is
    // where an unbounded string would push the picker sideways.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};

export const LongOrganisationName: Story = {
  name: 'A long organisation name',
  args: {
    invites: [
      invite(3, 'Northgate Veterinary Referrals and Emergency Critical Care Centre (Central)'),
    ],
  },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
