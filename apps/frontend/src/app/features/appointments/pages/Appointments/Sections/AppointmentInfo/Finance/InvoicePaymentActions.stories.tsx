import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import InvoicePaymentActions from './InvoicePaymentActions';

const ORG_ID = 'org-storybook-finance';

const APPOINTMENT: Appointment = {
  id: 'appt-finance-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '10:30 - 11:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
  paymentStatus: 'UNPAID',
};

/**
 * A vet membership. `usePermissions` recomputes the effective set from `roleCode`
 * against the role table rather than trusting the stored snapshot, so seeding the
 * role is the whole setup - and revoking one permission is how the denied story
 * is built, since every seeded role carries `billing:edit:any` by default.
 */
const membership = (revoked: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
  revokedPermissions: revoked,
});

const seed = (revoked: string[] = []) => {
  return () => {
    const snapshot = useOrgStore.getState();
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    return () => {
      useOrgStore.setState(snapshot);
    };
  };
};

const CASH_HEADLINE = 'Confirm cash payment before marking this invoice as paid.';
const CASH_BODY =
  'Payment collection method has been set to in-person cash. Click Collect cash only after ' +
  'cash has been received from the client.';

const meta = {
  title: 'Appointments/InvoicePaymentActions',
  component: InvoicePaymentActions,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The action row under an invoice in the appointment Finance tab. What it draws is ' +
          'four different things, and only the plain link row had ever been rendered.\n\n' +
          'The one worth a story is the **amber cash-confirmation card**. It is the single ' +
          'guard between a receptionist and an invoice marked PAID with no money in the till, ' +
          'and it is deliberately not a dialog - it replaces the action row in place, on ' +
          '`--warning-100` inside a `--warning-200` hairline, with a dismiss X that puts the ' +
          'row back. It is reachable two ways: an invoice whose collection method already reads ' +
          '`PAYMENT_AT_CLINIC` opens on it, and pressing **Pay in cash** flips into it locally. ' +
          'Both are covered below.\n\n' +
          'The `!canEditBilling` branch is also here. It returns `null` rather than disabling ' +
          'the controls, because the mutations behind them require `billing:edit:any` on the ' +
          'backend and a `billing:edit:limited` user would only ever collect a 403 - so the ' +
          'component with no permission is an empty region, which is exactly the kind of ' +
          '"nothing rendered" that no static snapshot can tell apart from a crash.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    invoiceId: 'inv-2041',
    invoiceStatus: 'ISSUED',
    activeAppointment: APPOINTMENT,
  },
  beforeEach: seed(),
} satisfies Meta<typeof InvoicePaymentActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PaymentLinkRow: Story = {
  name: 'Unpaid invoice - action row',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The exact control set, in render order. Asserting the whole row rather than two
    // named buttons is the point: a third action appearing here (a Refund pill, say)
    // would slip past a pair of getByRole calls without changing either of them.
    await expect(canvas.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(
      ['Pay in cash', 'Generate & Mail link']
    );
    await expect(canvas.getByRole('button', { name: 'Pay in cash' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Generate & Mail link' })).toBeEnabled();
    // Nothing amber yet: the confirmation card and the row are mutually exclusive.
    await expect(canvas.queryByText(CASH_HEADLINE)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state for an unsettled invoice with no Stripe receipt: two secondary ' +
          'pills, wrapped and centre-aligned so they re-flow rather than overflowing the ' +
          'narrow Finance column.',
      },
    },
  },
};

export const CashConfirmationFromInvoice: Story = {
  name: 'Cash confirmation (collection method already cash)',
  args: { paymentCollectionMethod: 'PAYMENT_AT_CLINIC' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Assert the card's actual copy, not merely that something appeared - the whole
    // point of this surface is the sentence it puts in front of the person clicking.
    await expect(canvas.getByText(CASH_HEADLINE)).toBeInTheDocument();
    await expect(canvas.getByText(CASH_BODY)).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Collect cash' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Dismiss cash confirmation' })).toBeVisible();

    // The link actions are gone, not merely hidden behind the card.
    await expect(canvas.queryByRole('button', { name: 'Pay in cash' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Generate & Mail link' })
    ).not.toBeInTheDocument();

    // The amber ground is the warning, so it has to be a real fill rather than the
    // panel showing through. Read it in waitFor: the card's controls carry
    // `transition-colors`, and a single synchronous read can catch an interpolated value.
    const card = canvas.getByText(CASH_HEADLINE).closest('div.rounded-2xl') as HTMLElement;
    await waitFor(() => {
      const background = getComputedStyle(card).backgroundColor;
      expect(background).not.toBe('rgba(0, 0, 0, 0)');
      expect(background).not.toBe('transparent');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'An invoice already flagged for in-person collection opens straight into the ' +
          'confirmation, before anyone has pressed anything. `isInPersonCashSelected` is ' +
          'derived from the invoice, not from local state, so this is what the Finance tab ' +
          'shows on first paint for a cash job.',
      },
    },
  },
};

export const CashConfirmationFromPayInCash: Story = {
  name: 'Cash confirmation (opened from Pay in cash)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Pay in cash' }));

    expect(await canvas.findByText(CASH_HEADLINE)).toBeInTheDocument();
    await expect(canvas.getByText(CASH_BODY)).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Collect cash' })).toBeEnabled();
    await expect(canvas.queryByRole('button', { name: 'Pay in cash' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same card reached from the row. `startCashCollection` sets no server state - it ' +
          'raises two toasts and flips `showCashConfirmation` - so the invoice is untouched ' +
          'until Collect cash is pressed, which is why dismissing costs nothing.',
      },
    },
  },
};

export const DismissRestoresTheRow: Story = {
  name: 'Dismiss returns to the action row',
  args: { paymentCollectionMethod: 'PAYMENT_AT_CLINIC' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss cash confirmation' }));

    // Dismiss clears local state only. The invoice still says PAYMENT_AT_CLINIC, and
    // `isInPersonCashSelected` ORs the two - so the card comes straight back, and the
    // X reads as a no-op on this invoice however many times it is pressed.
    await expect(canvas.getByText(CASH_HEADLINE)).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Pay in cash' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dismiss X on an invoice whose stored collection method is already cash. It ' +
          'clears `showCashConfirmation`, but the derived flag ORs local state with the ' +
          'invoice field, so the card stays. On the Pay-in-cash path the same X does return ' +
          'the row - the control is the same, its effect is not.',
      },
    },
  },
};

export const DismissAfterPayInCash: Story = {
  name: 'Dismiss after Pay in cash restores the row',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Pay in cash' }));
    expect(await canvas.findByText(CASH_HEADLINE)).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss cash confirmation' }));
    await waitFor(() => {
      expect(canvas.queryByText(CASH_HEADLINE)).not.toBeInTheDocument();
    });
    await expect(canvas.getByRole('button', { name: 'Pay in cash' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Generate & Mail link' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The reversible half of the pair. Same X, same card, opposite outcome - which is ' +
          'the argument for having both stories rather than one.',
      },
    },
  },
};

export const NoBillingEditPermission: Story = {
  name: 'Without billing:edit:any (renders nothing)',
  beforeEach: seed(['billing:edit:any']),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvas.queryByText(CASH_HEADLINE)).not.toBeInTheDocument();

    /* Absence alone would be worthless here - a component that crashed on mount and a
       component that returned `null` both leave an empty canvas. So assert the shape of
       the empty region positively: the preview decorator's <main> wraps an sr-only <h1>
       and then the story, so a `null` render leaves the heading as the landmark's ONLY
       child. One child means the component mounted, ran its permission check and
       contributed nothing; zero or a broken tree would mean something else went wrong. */
    const landmark = canvasElement.querySelector('main') as HTMLElement;
    await expect(landmark.children).toHaveLength(1);
    await expect(landmark.firstElementChild?.tagName).toBe('H1');
    await expect(landmark.firstElementChild).toHaveClass('sr-only');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A membership with `billing:edit:any` revoked. The component returns `null`, so the ' +
          'Finance tab shows an invoice with no actions at all rather than disabled ones - ' +
          'deliberate, because every mutation behind those buttons is refused server-side for ' +
          'this role.',
      },
    },
  },
};

export const SettledWithReceipt: Story = {
  name: 'Paid invoice with a Stripe receipt',
  args: { invoiceStatus: 'PAID', stripeReceiptUrl: 'https://example.invalid/receipt/inv-2041' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // One pill and nothing else: the receipt branch short-circuits the whole component,
    // so the assertion is on the complete button set rather than on Download alone.
    await expect(canvas.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(
      ['Download']
    );
    await expect(canvas.getByRole('button', { name: 'Download' })).toBeEnabled();
    // The receipt branch returns before the permission check, so it is the one state
    // a limited-billing user can still see.
    await expect(canvas.queryByRole('button', { name: 'Pay in cash' })).not.toBeInTheDocument();
    await expect(canvas.queryByText(CASH_HEADLINE)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Once Stripe has issued a receipt the component short-circuits to a single Download ' +
          'pill - above the permission gate, so this is the only branch that renders without ' +
          '`billing:edit:any`.',
      },
    },
  },
};
