import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import AttestationRevokePanel from './AttestationRevokePanel';

const meta = {
  title: 'Pet Passport/Attestation/AttestationRevokePanel',
  component: AttestationRevokePanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The second step of a revocation. Revoking pulls a record a border officer may already have ' +
          'relied on back out of the passport, so it gets its own screen and its own confirm rather ' +
          'than sitting one click away in the review footer. The panel is tinted with the danger ' +
          'surface tokens so the step cannot be mistaken for the review it replaced; the reason is ' +
          'optional and is stored with the record.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    reason: '',
    disabled: false,
    onReasonChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[560px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AttestationRevokePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** How the step opens - the placeholder carries the two common reasons. */
export const Empty: Story = {
  name: 'Empty',
};

export const WithReason: Story = {
  name: 'Reason given',
  args: {
    reason: 'Certificate superseded: the titration result arrived after the passport was issued.',
  },
};

/**
 * The revoke request is in flight. The field is disabled along with both footer
 * actions, so the stored reason cannot change after it has been sent.
 */
export const Busy: Story = {
  name: 'Busy - revoking',
  args: {
    reason: 'Issued in error.',
    disabled: true,
  },
};

export const Interactive: Story = {
  name: 'Interactive',
  render: function InteractiveRevokePanel(args) {
    const [reason, setReason] = useState('');
    return <AttestationRevokePanel {...args} reason={reason} onReasonChange={setReason} />;
  },
};
