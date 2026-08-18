import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import AttestationActions from './AttestationActions';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';

/**
 * The three attestation calls always sit in the panel's action bar, so every
 * story renders them inside the real `ModalFooter` - a bare pair of buttons on
 * a page would not show the rule, the gap or the right alignment they inherit.
 */
const meta = {
  title: 'Pet Passport/Attestation/AttestationActions',
  component: AttestationActions,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The action set for the review panel, driven entirely by `status`, `documensoUnavailable`, ' +
          '`confirmed` and `busy`. E-signature is the preferred route, so "Send for signature" is the ' +
          'primary and manual attestation is the alternative - until the service reports the practice ' +
          'has no Documenso configured, at which point manual attestation takes the primary slot rather ' +
          'than leaving a button that can only ever fail. A `SIGNED` record offers revocation instead, ' +
          'and a `VOID` record offers nothing at all.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    status: 'DRAFT',
    documensoUnavailable: false,
    confirmed: false,
    busy: null,
    onSign: fn(),
    onAttest: fn(),
    onRevoke: fn(),
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['DRAFT', 'IN_PROGRESS', 'SIGNED', 'VOID'],
    },
    busy: {
      control: 'select',
      options: [null, 'SIGN', 'ATTEST', 'REVOKE'],
    },
  },
  render: (args) => (
    <div className="w-full max-w-[560px]">
      <ModalFooter>
        <AttestationActions {...args} />
      </ModalFooter>
    </div>
  ),
} satisfies Meta<typeof AttestationActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * How the bar opens on an unattested record: both routes are visible but inert,
 * because the vet has not ticked the declaration yet.
 */
export const NotConfirmed: Story = {
  name: 'Draft - declaration not ticked',
};

export const Ready: Story = {
  name: 'Draft - ready to attest',
  args: { confirmed: true },
  parameters: {
    docs: {
      description: {
        story: 'The declaration is ticked, so both routes are live and e-signature leads.',
      },
    },
  },
};

export const ManualOnly: Story = {
  name: 'No Documenso configured',
  args: { confirmed: true, documensoUnavailable: true },
  parameters: {
    docs: {
      description: {
        story:
          'The practice has no Documenso key, so the signature route is dropped entirely and manual ' +
          'attestation is promoted to the primary - the label loses its "instead" because there is no ' +
          'longer anything for it to be an alternative to.',
      },
    },
  },
};

export const SendingSignature: Story = {
  name: 'Busy - sending for signature',
  args: { confirmed: true, busy: 'SIGN' },
  parameters: {
    docs: {
      description: {
        story:
          'A request is in flight: the primary reads "Sending..." and every control in the bar is ' +
          'disabled, so a second click cannot raise a second Documenso envelope.',
      },
    },
  },
};

export const Attesting: Story = {
  name: 'Busy - attesting manually',
  args: { confirmed: true, busy: 'ATTEST' },
};

export const SignaturePending: Story = {
  name: 'Signature pending',
  args: { status: 'IN_PROGRESS', confirmed: true },
  parameters: {
    docs: {
      description: {
        story:
          'A record waiting on Documenso can still be attested by hand - the webhook may never arrive, ' +
          'and the vet is not blocked on it - so the same two routes stay available.',
      },
    },
  },
};

export const Attested: Story = {
  name: 'Attested - revocation offered',
  args: { status: 'SIGNED' },
  parameters: {
    docs: {
      description: {
        story:
          'Once the record is in the passport the only remaining action is to pull it back out, which ' +
          'is the danger secondary rather than a primary: revoking is never the expected next step.',
      },
    },
  },
};

export const Revoking: Story = {
  name: 'Busy - revoking',
  args: { status: 'SIGNED', busy: 'REVOKE' },
};

/**
 * A revoked record is terminal: the routes are gone and the footer keeps only
 * the Close control the panel itself supplies. The story renders the empty bar
 * so a regression that resurrects an action here is visible.
 */
export const Revoked: Story = {
  name: 'Revoked - no actions',
  args: { status: 'VOID' },
};

export const EveryState: Story = {
  name: 'Every state',
  render: (args) => (
    <div className="flex w-full max-w-[560px] flex-col gap-4">
      {(
        [
          ['Draft, not ticked', { status: 'DRAFT', confirmed: false }],
          ['Draft, ready', { status: 'DRAFT', confirmed: true }],
          ['Draft, no Documenso', { status: 'DRAFT', confirmed: true, documensoUnavailable: true }],
          ['Draft, sending', { status: 'DRAFT', confirmed: true, busy: 'SIGN' as const }],
          ['Signature pending', { status: 'IN_PROGRESS', confirmed: true }],
          ['Attested', { status: 'SIGNED' }],
          ['Revoked', { status: 'VOID' }],
        ] as const
      ).map(([label, overrides]) => (
        <div key={label} className="flex flex-col gap-1">
          <span className="text-[11.5px] text-[var(--ink-faint)]">{label}</span>
          <ModalFooter>
            <AttestationActions {...args} {...overrides} />
          </ModalFooter>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Every arm of the bar in one frame - the view that makes an accidental change to which route ' +
          'leads, or to what a terminal record still offers, obvious in a diff.',
      },
    },
  },
};
