import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import AttestationConfirmPanel, { type SignatoryDetails } from './AttestationConfirmPanel';

const EMPTY_SIGNATORY: SignatoryDetails = { signatoryName: '', signatoryLicence: '' };

const SIGNED_BY: SignatoryDetails = {
  signatoryName: 'Dr Amara Osei',
  signatoryLicence: 'RCVS 704118',
};

const meta = {
  title: 'Pet Passport/Attestation/AttestationConfirmPanel',
  component: AttestationConfirmPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The legal half of the review panel. Attesting is a veterinary act a border officer relies ' +
          'on - EU 576/2013, a UK animal health certificate, a USDA APHIS endorsement - so the ' +
          'declaration is spelled out in full and every action stays inert until the vet ticks it. The ' +
          'two signatory fields are the app’s standard `FormInput`, so they read exactly like the ' +
          'capture forms in the passport step; both are optional, and the service accepts an empty body.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    confirmed: false,
    signatory: EMPTY_SIGNATORY,
    disabled: false,
    onConfirmedChange: fn(),
    onSignatoryChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[560px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AttestationConfirmPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * How the panel opens: nothing filled in, nothing ticked, so the attestation
 * actions in the footer are still inert.
 */
export const Empty: Story = {
  name: 'Empty',
};

export const WithSignatory: Story = {
  name: 'Signatory filled in',
  args: { signatory: SIGNED_BY },
  parameters: {
    docs: {
      description: {
        story:
          'Only non-empty values travel to the service, so a vet who leaves both blank still attests - ' +
          'the fields name the signature, they do not gate it.',
      },
    },
  },
};

export const Confirmed: Story = {
  name: 'Declaration ticked',
  args: { confirmed: true, signatory: SIGNED_BY },
};

/**
 * A request is in flight. The fields go read-only and the checkbox is disabled,
 * so the declaration cannot be unticked out from under a signature that is
 * already on its way.
 */
export const Busy: Story = {
  name: 'Busy - request in flight',
  args: { confirmed: true, signatory: SIGNED_BY, disabled: true },
};

/**
 * The interactive version, for checking focus rings, the checkbox hit area and
 * how the two fields stack below the `sm` breakpoint.
 */
export const Interactive: Story = {
  name: 'Interactive',
  render: function InteractiveConfirmPanel(args) {
    const [confirmed, setConfirmed] = useState(false);
    const [signatory, setSignatory] = useState<SignatoryDetails>(EMPTY_SIGNATORY);

    return (
      <AttestationConfirmPanel
        {...args}
        confirmed={confirmed}
        onConfirmedChange={setConfirmed}
        signatory={signatory}
        onSignatoryChange={setSignatory}
      />
    );
  },
};
