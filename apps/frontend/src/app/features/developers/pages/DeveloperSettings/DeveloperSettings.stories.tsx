import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { useAuthStore } from '@/app/stores/authStore';
import DeveloperSettings from './DeveloperSettings';

/**
 * Seeds the auth store as a signed-in developer and restores it on unmount.
 *
 * The page reads its whole profile column off `attributes`, which SuperTokens
 * fills from the user profile rather than from a decoded JWT - so the fixture is
 * a flat claims record, and `email_verified` is the STRING 'true' because
 * `attributes` is typed `Record<string, string>`. The component accepts either
 * form, which is worth knowing before anyone "tidies" that comparison.
 *
 * `DevRouteGuard` renders nothing while status is `idle`/`checking`, so the
 * status matters as much as the claims.
 */
const seedDeveloper = (attributes: Record<string, string>) => () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({
    status: 'authenticated',
    role: 'developer',
    user: {
      userId: 'dev-storybook',
      email: 'ravi@example.test',
      authProfile: null,
      loginMethod: 'emailpassword',
      emailVerified: true,
      getUsername: () => 'dev-storybook',
    },
    attributes,
  });
  return () => {
    useAuthStore.setState(snapshot);
  };
};

const VERIFIED = {
  sub: 'dev-storybook',
  given_name: 'Ravi',
  family_name: 'Patel',
  email: 'ravi@example.test',
  email_verified: 'true',
  'custom:company': 'Timm Devices GmbH',
};

const meta = {
  title: 'Developers/DeveloperSettings',
  component: DeveloperSettings,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/settings' } },
    docs: {
      description: {
        component:
          'The developer account page. Both of its destructive actions are **inline confirm ' +
          'swaps** rather than modals, and neither armed state had ever been drawn.\n\n' +
          'Pressing "Revoke all" does not open a dialog: the danger button is replaced in ' +
          'place by a "Confirm revoke" / "Cancel" pair inside the same `dev-danger-actions` ' +
          'span, so the row silently changes width and the original button is gone from the ' +
          'DOM. "Rotate now" does the same thing inside a sentence - it is an inline link in ' +
          '"Signing secret rotated 14 days ago. Rotate now", and arming it swaps that one word ' +
          'for two words, reflowing the sentence.\n\n' +
          'The two flags are independent `useState` booleans with no coordination, so both can ' +
          'be armed at once - and then the page carries two buttons labelled exactly "Cancel", ' +
          'one in each column, with nothing in either accessible name to say which is which. ' +
          'That combination has a story below because it is one click away, not because it is ' +
          'exotic.\n\n' +
          'Neither confirm actually does anything yet. `handleRevoke` and `handleRotate` ' +
          'disarm the swap and raise a "coming soon" warning toast, which is the honest state ' +
          'of the key-management API and is why the page carries its own "Preview" disclaimer.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: seedDeveloper(VERIFIED),
} satisfies Meta<typeof DeveloperSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Resting (nothing armed)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The profile column, derived from the claims rather than typed in.
    await expect(canvas.getAllByText('Ravi Patel')).toHaveLength(2);
    await expect(canvas.getByText('RP')).toBeInTheDocument();
    await expect(canvas.getByText('Timm Devices GmbH')).toBeInTheDocument();
    await expect(canvas.getByText('Verified')).toBeInTheDocument();

    // Both actions in their resting form, and neither confirm present.
    await expect(canvas.getByRole('button', { name: 'Revoke all' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Rotate now' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    // Three switches, two on by default. They are `role="switch"` buttons, so the
    // state is in `aria-checked` rather than in a checkbox.
    await expect(
      canvas.getByRole('switch', { name: 'Email me on failed deliveries' })
    ).toBeChecked();
    await expect(canvas.getByRole('switch', { name: 'Weekly usage digest' })).toBeChecked();
    await expect(
      canvas.getByRole('switch', { name: 'Platform changelog emails' })
    ).not.toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two columns: profile and danger zone on the left, webhooks and notifications on the ' +
          'right. The name renders twice - once in the header chip beside the initials, once as ' +
          'the "Developer name" field - which is why the assertion counts two nodes rather than ' +
          'finding one.',
      },
    },
  },
};

export const ConfirmRevokeArmed: Story = {
  name: 'Revoke all (armed)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Revoke all' }));

    const confirmRevoke = await canvas.findByRole('button', { name: 'Confirm revoke' });
    await expect(confirmRevoke).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    /* A swap, not an addition. The original trigger is removed from the DOM, so a
       reader who armed this by accident has no "Revoke all" to click again - only
       Cancel gets them back. */
    await expect(canvas.queryByRole('button', { name: 'Revoke all' })).not.toBeInTheDocument();

    // The explanatory copy stays put, so the row keeps its two-line description
    // beside a control that is now twice as wide.
    await expect(canvas.getByText('Revoke all API keys')).toBeInTheDocument();
    await expect(
      canvas.getByText('Every integration stops immediately. Cannot be undone.')
    ).toBeInTheDocument();

    /* Confirm is the destructive one and is the only control tinted with the
       danger token. Polled rather than read once, because these buttons carry a
       colour transition and a single synchronous read catches an interpolated
       value partway through it. */
    const confirm = canvas.getByRole('button', { name: 'Confirm revoke' });
    const cancel = canvas.getByRole('button', { name: 'Cancel' });
    await waitFor(() => {
      expect(getComputedStyle(confirm).color).not.toBe(getComputedStyle(cancel).color);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The armed danger row. Confirming raises a "Key management API coming soon" warning ' +
          'toast and disarms - no keys exist to revoke yet, which the page says out loud in its ' +
          'Preview line.',
      },
    },
  },
};

export const ConfirmRevokeCancelled: Story = {
  name: 'Revoke all (cancelled)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Revoke all' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Revoke all' })).toBeInTheDocument();
    });
    await expect(canvas.queryByRole('button', { name: 'Confirm revoke' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    /* One control in the actions span, not two - cancelling has to remove BOTH
       swapped buttons, and a leftover Cancel beside a restored "Revoke all" would
       still satisfy the two absence checks above if only one of them regressed. */
    const actions = canvasElement.querySelector('.dev-danger-actions');
    if (!actions) throw new Error('The danger-zone actions span did not render.');
    await expect(actions.querySelectorAll('button')).toHaveLength(1);
    await expect(actions.textContent).toBe('Revoke all');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Back to the resting row. Nothing else on the page changed, so this is the only ' +
          'evidence that the swap is reversible.',
      },
    },
  },
};

export const ConfirmRotateArmed: Story = {
  name: 'Rotate signing secret (armed)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Rotate now' }));

    const confirmRotate = await canvas.findByRole('button', { name: 'Confirm rotate' });
    await expect(confirmRotate).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Rotate now' })).not.toBeInTheDocument();

    /* The swap happens INSIDE a sentence, so the surrounding copy has to still
       read correctly around two buttons instead of one. Reading the whole card's
       text is the only way to see that; querying the buttons alone would not
       catch a sentence that now says "rotated 14 days ago. Confirm rotate Cancel"
       with no separator. */
    const card = canvasElement.querySelector('.dev-secret-card');
    if (!card) throw new Error('The signing-secret card did not render.');
    await expect(card.textContent).toContain('Signing secret rotated 14 days ago.');
    await expect(card.textContent).toContain('Confirm rotate');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The inline variant. Because the controls are inside running text, arming it reflows ' +
          'the sentence and can push it onto a second line inside the card - the only place on ' +
          'the page where a confirm changes the height of its container.',
      },
    },
  },
};

export const BothArmed: Story = {
  name: 'Both confirms armed (two Cancels)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Revoke all' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Rotate now' }));

    /* `confirmRevoke` and `confirmRotate` are independent booleans, so arming one
       does not disarm the other. The result is two buttons whose accessible name
       is exactly "Cancel", in two different columns, cancelling two different
       things - indistinguishable to anyone navigating by name. */
    const cancels = canvas.getAllByRole('button', { name: 'Cancel' });
    await expect(cancels).toHaveLength(2);
    await expect(canvas.getByRole('button', { name: 'Confirm revoke' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Confirm rotate' })).toBeInTheDocument();

    /* And they are in two different cards, which is what makes the duplicate name
       a problem rather than a rendering artefact: one lives in the danger zone on
       the left, the other inside the signing-secret sentence on the right. */
    await expect(cancels[0].closest('.dev-danger-actions')).not.toBeNull();
    await expect(cancels[0].closest('.dev-secret-card')).toBeNull();
    await expect(cancels[1].closest('.dev-secret-card')).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'One click apart from either single-armed story, and the state a reader lands in by ' +
          'exploring the page. Naming the two buttons "Cancel revoke" and "Cancel rotation" ' +
          'would cost nothing and is what the rest of PIMS does.',
      },
    },
  },
};

export const UnverifiedEmail: Story = {
  name: 'Unverified contact email',
  beforeEach: seedDeveloper({
    sub: 'dev-storybook',
    given_name: 'Ravi',
    family_name: 'Patel',
    email: 'ravi@example.test',
    email_verified: 'false',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badge = canvas.getByText('Unverified');
    await expect(canvas.queryByText('Verified')).not.toBeInTheDocument();

    /* The two badges are different elements, not one element with different copy:
       the verified branch renders `.dev-settings-verified` WITH a checkmark glyph,
       this one renders `.dev-settings-unverified` with no glyph at all. Asserting
       the class and the missing icon is what pins that difference. */
    await expect(badge).toHaveClass('dev-settings-unverified');
    await expect(badge.querySelector('svg')).toBeNull();
    await expect(canvasElement.querySelector('.dev-settings-verified')).toBeNull();

    /* No `custom:company` claim at all, which is the state every developer who
       signed up without one is in: the field reads the literal string "Not set"
       rather than being hidden. */
    await expect(canvas.getByText('Not set')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The unverified badge is plain text with no icon, where the verified one carries a ' +
          'filled checkmark - so the two differ by more than a word, and the weaker state is ' +
          'the quieter of the two.',
      },
    },
  },
};
