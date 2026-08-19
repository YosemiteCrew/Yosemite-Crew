import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { removeStorageItem, setJsonStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import SignUp from './SignUp';
/* Not decoration. Every class this page uses - `.yc-field`, `.yc-lbl`,
   `.yc-btn-primary`, `.yc-switch` - and both keyframe sets the shell animates with
   live in marketing.css, which is imported by the (public) ROUTE LAYOUT rather than
   by any component. Storybook never renders that layout, so without this line the
   story draws user-agent inputs and unstyled buttons, and the 940px rule that drops
   the brand panel never applies. Relative, matching the other marketing stories. */
import '../../../marketing/site/marketing.css';

const CLINIC_ROLE = 'A veterinary clinic, practice, or hospital';
const DEVELOPER_ROLE = 'A developer';

/**
 * Seeds the marketing-stats session cache that the auth brand panel reads through
 * `useGithubStats`. The hook returns before fetching while the cache is inside its
 * 5 minute TTL and already holds a `discord` string, so seeding it keeps the mount
 * off `/api/community/*` - which under Storybook is a 404 - and pins the star pill
 * to a fixed number instead of one that differs between two Chromatic runs.
 */
const seedGithubStats = () => {
  setJsonStorageItem('session', 'yc_marketing_stats_v2', {
    stars: '2.4k',
    starsFull: '2,431',
    repositoryClones: '67,134',
    contributors: '38',
    discord: '1,204',
  });
  setStorageItem('session', 'yc_marketing_stats_ts_v2', String(Date.now()));
};

/**
 * `useSignUpDraft` restores first name / last name / email from sessionStorage on
 * mount and rewrites the entry on every keystroke, so the draft survives a trip to
 * the Terms page. Storybook runs every story in ONE tab, which means a story that
 * types a name leaves it behind for whichever story renders next: without this the
 * empty-form story below would submit a half-filled form and draw four errors
 * instead of six, and which four would depend on the order stories were opened in.
 */
const clearSignUpDraft = () => {
  removeStorageItem('session', 'yc_signup_draft');
};

const meta = {
  title: 'Auth/SignUp',
  component: SignUp,
  parameters: {
    layout: 'fullscreen',
    /* Stops the preview decorator stamping a SECOND `data-yc-app` around the
       whole canvas. AuthShell already puts that marker on the form column and
       deliberately leaves the dark brand panel outside it, so the decorator's
       wrapper would widen a scope the page keeps narrow on purpose -
       `body:has([data-yc-app])` still matches, because the shell supplies its
       own. This is what the app actually renders. */
    surface: 'marketing',
    // Every render mounts a closed OtpModal, which holds a router, and the shell's
    // logo, Terms and Privacy links are all next/link - so the App Router mock has
    // to be on even though no story here gets as far as a redirect.
    nextjs: { appDirectory: true, navigation: { pathname: '/signup' } },
    docs: {
      description: {
        component:
          'The clinic and developer sign-up page. Two of its states had never been drawn: the ' +
          'form after a failed submit, and the developer pane.\n\n' +
          '**Validation is submit-time only.** Nothing is checked while typing - `handleSignUp` ' +
          'runs `validateSignUpInputs` on submit and returns before `setIsSubmitting(true)`, so a ' +
          'rejected form never touches SuperTokens. Each field then clears its own error on the ' +
          'next keystroke, which is why the six errors are a single moment rather than a state ' +
          'the page rests in.\n\n' +
          '**The "I am" select rewrites the left-hand panel, not the form.** `effectiveDeveloper` ' +
          'swaps the eyebrow, the headline and all three brand points, and the same flag decides ' +
          'the fifth argument passed to `signUp` (`developer`) and the `devAuth` session flag read ' +
          'later by `DevRouteGuard`. The form fields themselves are identical in both branches.\n\n' +
          'The one thing these stories cannot show is the "Continue with GitHub" button under the ' +
          'form: `GithubSignInButton` returns `null` unless `NEXT_PUBLIC_AUTH_GITHUB_ENABLED` is ' +
          '`true`, and there is no `.env` in this app, so it is absent from Storybook in both ' +
          'branches. That absence is asserted rather than glossed over.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => {
    seedGithubStats();
    clearSignUpDraft();
  },
} satisfies Meta<typeof SignUp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Clinic pane (default)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const role = canvas.getByRole('combobox', { name: 'I am' });
    await expect(role).toHaveValue(CLINIC_ROLE);

    // The brand panel is the only h2 on the page; the two h1s are the page heading
    // and the preview decorator's sr-only landmark title, so read this by level.
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(
      'See the whole animal.'
    );
    await expect(
      canvas.getByText('Open-source operating system for animal health')
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Appointments, records, and billing on one screen.')
    ).toBeInTheDocument();

    // Nothing has been submitted, so no field carries an error yet.
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);

    /* The shell skeleton, measured rather than assumed: two tracks and two
       children at the default laptop width, brand column the wider of the pair
       (`1.06fr 1fr`). Track count alone would not catch a collapse - the 940px
       rule leaves both children mounted and only hides the brand panel, so
       every copy assertion above would still pass on a one-column page. */
    const grid = canvasElement.querySelector('[data-authgrid]') as HTMLElement;
    const tracks = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(2);
    await expect(grid.children).toHaveLength(2);
    await expect(parseFloat(tracks[0])).toBeGreaterThan(parseFloat(tracks[1]));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting page a clinic lands on. Six controls, the Terms checkbox, and the clinic ' +
          'copy on the left. The baseline the two stories below are read against.',
      },
    },
  },
};

export const ValidationErrors: Story = {
  name: 'Empty submit (six errors)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);

    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }));

    /* Order matters as much as the text. The six alerts are read in document order,
       so this pins WHICH field each message landed under - a validator that returned
       the right set of strings against the wrong keys would still put "Last name is
       required" beneath the first-name input, and a set-based assertion would pass. */
    const alerts = await canvas.findAllByRole('alert');
    await expect(alerts.map((alert) => alert.textContent)).toEqual([
      'First name is required',
      'Last name is required',
      'Email is required',
      'Password is required',
      'Confirm Password is required',
      'Please check the Terms and Conditions box',
    ]);

    // The five text controls are wired to their message by id, so a screen reader
    // reads the error with the field rather than only when the alert fires.
    const email = canvas.getByRole('textbox', { name: 'Enter email' });
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAttribute('aria-describedby', 'signup-email-error');
    await expect(canvasElement.querySelector('#signup-email-error')?.textContent).toBe(
      'Email is required'
    );

    /* The submit returned BEFORE `setIsSubmitting(true)`, so no request was made:
       the loader never mounted and the button is still idle. Without these two the
       story would pass just as happily on a page that had called SuperTokens,
       failed, and painted the same six messages. */
    await expect(canvas.queryByTestId('signup-loader')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Create account' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Submitting the empty form. Five of the six messages sit inside their field group and ' +
          'are referenced by `aria-describedby`; the sixth, under the Terms checkbox, is a bare ' +
          '`FieldError` with no `id` - the checkbox has neither `aria-invalid` nor a ' +
          '`aria-describedby` pointing at it, so that one message is announced only by its ' +
          '`role="alert"` and is not attached to the control it is about.\n\n' +
          'Password and confirm-password are also a pair rather than two independent checks: with ' +
          'both empty you get both messages, but a password that fails the strength regex ' +
          'suppresses the confirm message entirely, so this is the widest the error block ever ' +
          'gets.',
      },
    },
  },
};

export const DeveloperPane: Story = {
  name: 'Developer pane',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(
      'See the whole animal.'
    );

    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'I am' }), DEVELOPER_ROLE);

    // Re-queried inside the waitFor rather than held from before the swap: the
    // headline is rebuilt around a different <em>, and the assertion should fail
    // on the text, not on a stale node reference.
    await waitFor(() => {
      expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(
        'Build it in an afternoon.'
      );
    });

    await expect(canvas.getByText('Open-source developer platform')).toBeInTheDocument();
    await expect(
      canvas.queryByText('Open-source operating system for animal health')
    ).not.toBeInTheDocument();

    // All three points are replaced, not just re-ordered - SignUp shares no point
    // copy between the two branches.
    for (const point of [
      'REST and FHIR APIs, typed SDKs, and webhooks.',
      'Open source. Read it, run it locally, send a PR.',
      'Ship plugins to the marketplace. Reach every clinic.',
    ]) {
      await expect(canvas.getByText(point)).toBeInTheDocument();
    }
    await expect(
      canvas.queryByText('Appointments, records, and billing on one screen.')
    ).not.toBeInTheDocument();

    // The form is untouched: same six controls, same labels, same submit.
    await expect(canvas.getByRole('textbox', { name: 'First name' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Create account' })).toBeInTheDocument();

    /* Env-gated, so it is absent here rather than merely unstyled. This is the one
       piece of the developer branch Storybook cannot draw - `isGithubSignInEnabled()`
       reads NEXT_PUBLIC_AUTH_GITHUB_ENABLED, which no .env in this app sets. */
    await expect(
      canvas.queryByRole('button', { name: 'Continue with GitHub' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Changing "I am" to **A developer**. The right-hand form does not move - same six ' +
          'controls, same Terms line - while the entire left panel is rewritten: teal eyebrow, ' +
          'a different headline word, and three developer points in place of the clinic ones.\n\n' +
          'The same flag also changes what is sent: `signUp` gains a fifth `developer` argument ' +
          'and `devAuth` is written to session storage, which is what routes the account to ' +
          '`/developers/home` after verification. None of that is visible here, which is exactly ' +
          'why the pane swap is the only signal the user gets that they picked the other product.',
      },
    },
  },
};
