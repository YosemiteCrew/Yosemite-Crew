import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { Invite } from '@/app/features/organization/types/team';
import InviteCard from './InviteCard';

const baseInvite: Invite = {
  _id: 'invite-1',
  organisationId: 'org-1',
  organisationName: 'Half Dome Veterinary Hospital',
  organisationType: 'HOSPITAL',
  invitedByUserId: 'user-1',
  departmentId: 'dept-1',
  inviteeEmail: 'amelia.hart@example.com',
  role: 'VETERINARIAN',
  employmentType: 'FULL_TIME',
  token: 'invite-token-1',
  status: 'PENDING',
  expiresAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const meta = {
  title: 'Cards/InviteCard',
  component: InviteCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One pending organisation invite in the org picker. The initial-letter avatar stands in ' +
          'for the org, the `INVITED` Badge marks the row as not-yet-joined, and the subline joins ' +
          'role, employment type and the "accept to join" hint with middots. Accept and Decline are ' +
          'the two `.invite-picker-action` buttons — accept is the filled one.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
  args: {
    invite: baseInvite,
    handleAccept: fn(async () => {}),
    handleReject: fn(),
    disabled: false,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 460 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InviteCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  name: 'Accept in flight',
  args: { disabled: true },
  parameters: {
    docs: {
      description: {
        story:
          'Both actions are disabled while an accept or decline request is on the wire, so a ' +
          'double click cannot fire the mutation twice.',
      },
    },
  },
};

export const LongOrganisationName: Story = {
  name: 'Long name and role',
  args: {
    invite: {
      ...baseInvite,
      _id: 'invite-2',
      organisationName: 'Tuolumne Meadows Emergency & Critical Care Referral Centre',
      organisationType: 'BOARDER',
      role: 'RECEPTIONIST',
      employmentType: 'PART_TIME',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The overflow case. The name and the subline both truncate inside `min-w-0 flex-1`, so a ' +
          'long org name never pushes the badge or the two actions out of the card.',
      },
    },
  },
};
