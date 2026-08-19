import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { StripeSetupStatus } from './index';

const ACCOUNT_ERROR = 'We could not prepare Stripe onboarding. Please try again.';
const CONNECT_ERROR =
  'We could not load the secure Stripe onboarding form. Please refresh the page and try again.';

const meta = {
  title: 'Onboarding/StripeSetupStatus',
  component: StripeSetupStatus,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The two async-result blocks that sit between the "Stripe onboarding" heading and the ' +
          'Connect embed. Neither had ever been drawn: reaching them in a real page means a ' +
          'Stripe account, a publishable key and a round trip that either fails or has not ' +
          'answered yet, and the page redirects to the dashboard before rendering if the ' +
          'subscription is missing or already charging.\n\n' +
          'They were inline JSX in the page body until now. Splitting them into this component ' +
          'is the only source change made for these stories - same markup, same conditions, same ' +
          'position in the page - and it is what lets both states be reviewed without Stripe.\n\n' +
          'The retry is conditional on `canRetrySetup`, which is false once a connected account ' +
          'exists: that failure came from `loadConnectAndInitialize` rather than from account ' +
          'creation, so re-running account creation would not fix it. The result is that the ' +
          'same alert box appears with and without a way forward, which is the pair worth ' +
          'looking at side by side.\n\n' +
          'The waiting block is an `<output>` with `aria-live="polite"` and `aria-busy`, so the ' +
          'wait is announced rather than only spun at - there is no spinner here at all.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    setupError: null,
    isPreparing: true,
    isEmbedReady: false,
    canRetrySetup: false,
    onRetry: fn(),
  },
} satisfies Meta<typeof StripeSetupStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Preparing: Story = {
  name: 'Preparing (aria-live)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByText('Preparing your secure Stripe onboarding experience…');

    // `<output>` maps to role status, so this is announced without a live-region
    // attribute of its own - the explicit aria-live only sets the politeness.
    await expect(status.tagName).toBe('OUTPUT');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a practitioner looks at for the whole account/secret round trip. It is a single ' +
          'centred line in a bordered card - no spinner, no progress, and no timeout, so a ' +
          'request that never resolves leaves this on screen indefinitely.',
      },
    },
  },
};

export const PreparingSettled: Story = {
  name: 'Preparing, no longer busy',
  args: { isPreparing: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Same copy, `aria-busy` off: reached when the account is ready but the
    // Connect instance has not been created yet (no publishable key, say).
    const status = canvas.getByText('Preparing your secure Stripe onboarding experience…');
    await expect(status).toHaveAttribute('aria-busy', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Visually identical to the story above, which is the point: `aria-busy` is the only ' +
          'thing that changes when the wait stops being a wait, so a sighted user cannot tell ' +
          'that the page has quietly stopped making progress.',
      },
    },
  },
};

export const SetupErrorWithRetry: Story = {
  name: 'Setup failed, retry offered',
  args: { setupError: ACCOUNT_ERROR, isPreparing: false, canRetrySetup: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent(ACCOUNT_ERROR);
    // Two children - the message and the action - against one in the story
    // below. That count is the whole visual difference between the two states.
    await expect(alert.children).toHaveLength(2);

    // The waiting line is gone rather than stacked under the failure.
    await expect(
      canvas.queryByText('Preparing your secure Stripe onboarding experience…')
    ).not.toBeInTheDocument();

    const retry = canvas.getByRole('button', { name: 'Try again' });
    await userEvent.click(retry);
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Account creation failed, so retrying it is worth offering. Retry re-runs ' +
          '`createConnectedAccount` only - it does not reload the page or reset the reducer, so ' +
          'the alert stays until the next result arrives.',
      },
    },
  },
};

export const SetupErrorWithoutRetry: Story = {
  name: 'Setup failed, no way forward',
  args: { setupError: CONNECT_ERROR, isPreparing: false, canRetrySetup: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent(CONNECT_ERROR);
    // Same box, one child instead of two: no button, and the copy is the only
    // thing telling the user to refresh.
    await expect(alert.children).toHaveLength(1);
    await expect(canvas.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The Connect-initialisation failure. `canRetrySetup` is false because the org already ' +
          'has a connected account, so the alert carries no action and the instruction to refresh ' +
          'lives inside the sentence. This is the state a returning owner hits when the embed ' +
          'cannot load, and the one most likely to need a real recovery path.',
      },
    },
  },
};

export const EmbedReady: Story = {
  name: 'Embed ready (renders nothing)',
  args: { isEmbedReady: true, isPreparing: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The component returns `null` here, so the assertion has to be that it
       contributed NOTHING - not just that one block is missing. `<output>` and
       `[role="alert"]` are its only two roots, and the sole button it can
       render is the retry, so zero of all three is the whole render. */
    await expect(canvasElement.querySelectorAll('output, [role="alert"]')).toHaveLength(0);
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(
      canvas.queryByText('Preparing your secure Stripe onboarding experience…')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Once `loadConnectAndInitialize` returns an instance the component renders nothing at ' +
          'all, which is what lets the embed sit directly under the page heading with no leftover ' +
          'status card pushing it down. The canvas here is empty on purpose.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  args: { setupError: ACCOUNT_ERROR, isPreparing: false, canRetrySetup: true },
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and renders at full panel width while still passing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent(ACCOUNT_ERROR);
    // Full-bleed card at 375: `w-full` with no max width of its own, so it is
    // the page container that constrains it. Bounding rect, not computed width -
    // the card is bordered, so the content box reads 2px narrower than drawn.
    await expect(alert.getBoundingClientRect().width).toBeGreaterThan(300);

    // The retry sits below the sentence rather than beside it at every width:
    // it is in its own `mt-3` block, so the card is two stacked rows here too.
    const retry = canvas.getByRole('button', { name: 'Try again' });
    await expect(retry.getBoundingClientRect().top).toBeGreaterThan(
      alert.getBoundingClientRect().top
    );
    await expect(alert.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The failure card at 375px. It has no width of its own, so it fills whatever the page ' +
          'gives it, and the message wraps to three or four lines at this width with the retry ' +
          'below - the same stacked shape as on desktop, just taller.',
      },
    },
  },
};
