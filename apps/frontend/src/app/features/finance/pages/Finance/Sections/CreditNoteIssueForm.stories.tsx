import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import CreditNoteIssueForm from './CreditNoteIssueForm';

/**
 * The parent clears the draft by bumping `issuedToken` once the server accepts
 * the note. This harness plays that parent: every accepted issue bumps the
 * token, so the reset edge is reachable from a click.
 */
const IssueHarness = (args: ComponentProps<typeof CreditNoteIssueForm>) => {
  const [issuedToken, setIssuedToken] = useState(args.issuedToken);
  return (
    <CreditNoteIssueForm
      {...args}
      issuedToken={issuedToken}
      onIssue={(draft) => {
        args.onIssue(draft);
        setIssuedToken((token) => token + 1);
      }}
    />
  );
};

const meta = {
  title: 'Finance/CreditNoteIssueForm',
  component: CreditNoteIssueForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The amount-and-reason form that raises a credit note against an invoice.\n\n' +
          'It validates against the same cap the service enforces - the invoice total less ' +
          'every ISSUED note - so the common mistake produces a message here rather than a ' +
          '409, and the cap is printed to the penny with `formatCap` because the shared ' +
          '`formatMoney` rounds to whole units and would advertise a figure the server then ' +
          'refuses. The server check remains the authority; this only saves a round trip.\n\n' +
          'The draft is cleared on the SUCCESS edge, not on submit: `issuedToken` increments ' +
          'when the server accepts, and the form resets during render on that change. Clearing ' +
          'in the submit handler would throw away the amount and the reason on every rejection ' +
          'or dropped connection.\n\n' +
          'The copy under the fields is deliberately blunt about the payment-link gap: a link ' +
          'already sent to the client keeps working and would charge the pre-credit amount.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    remaining: 159.97,
    currency: 'GBP',
    busy: false,
    issuedToken: 0,
    onIssue: fn(),
    onInvalid: fn(),
    onValid: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[460px] rounded-2xl border border-card-border bg-neutral-0 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreditNoteIssueForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Ready to issue',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Amount')).toHaveValue(null);
    await expect(canvas.getByLabelText('Reason (optional)')).toHaveValue('');
    // The cap, to the penny - not "£160".
    await expect(canvas.getByText(/Up to £159\.97 can still be credited\./)).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Issue a credit note against this invoice' })
    ).toBeEnabled();
    // The input carries the cap as its max as well.
    await expect(canvas.getByLabelText('Amount')).toHaveAttribute('max', '159.97');
  },
};

export const RejectsEmpty: Story = {
  name: 'Refuses an empty amount',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Issue a credit note against this invoice' })
    );
    await expect(args.onInvalid).toHaveBeenCalledWith('Enter a credit amount above zero.');
    await expect(args.onIssue).not.toHaveBeenCalled();
    await expect(args.onValid).not.toHaveBeenCalled();
  },
};

export const RejectsOverCap: Story = {
  name: 'Refuses more than the cap',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Amount'), '500');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Issue a credit note against this invoice' })
    );
    await expect(args.onInvalid).toHaveBeenCalledWith(
      'The most that can still be credited on this invoice is £159.97.'
    );
    await expect(args.onIssue).not.toHaveBeenCalled();
    // The draft survives the refusal, so the user can correct rather than retype.
    await expect(canvas.getByLabelText('Amount')).toHaveValue(500);
  },
};

export const Accepts: Story = {
  name: 'Accepts a valid draft',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Amount'), '40');
    await userEvent.type(
      canvas.getByLabelText('Reason (optional)'),
      'Goodwill on the delayed dental'
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Issue a credit note against this invoice' })
    );
    await expect(args.onValid).toHaveBeenCalledTimes(1);
    await expect(args.onIssue).toHaveBeenCalledWith({
      amount: 40,
      reason: 'Goodwill on the delayed dental',
    });
    await expect(args.onInvalid).not.toHaveBeenCalled();
  },
};

export const ClearsAfterAccept: Story = {
  name: 'Draft clears once the server accepts',
  render: (args) => <IssueHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Amount'), '25');
    await userEvent.type(canvas.getByLabelText('Reason (optional)'), 'Overcharged consult');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Issue a credit note against this invoice' })
    );
    /* The harness bumps `issuedToken` on issue, which is the edge the form resets
       on. Both fields empty; nothing else about the form changes. */
    await expect(canvas.getByLabelText('Amount')).toHaveValue(null);
    await expect(canvas.getByLabelText('Reason (optional)')).toHaveValue('');
  },
};

export const Busy: Story = {
  name: 'Working',
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Issue a credit note against this invoice',
    });
    await expect(button).toBeDisabled();
    await expect(button).toHaveTextContent('Working...');
  },
};

export const SmallRemainder: Story = {
  name: 'Only pennies left to credit',
  args: { remaining: 0.05 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Up to £0\.05 can still be credited\./)
    ).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: fields wrap',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const amount = canvas.getByLabelText('Amount');
    const button = canvas.getByRole('button', {
      name: 'Issue a credit note against this invoice',
    });
    // The row is `flex-wrap`, so the action drops under the fields rather than squeezing them.
    await expect(button.getBoundingClientRect().top).toBeGreaterThan(
      amount.getBoundingClientRect().bottom - 1
    );
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
