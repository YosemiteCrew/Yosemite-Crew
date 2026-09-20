import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { setJsonStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import SignIn from './SignIn';
/* Not decoration. Every class this page uses - `.yc-field`, `.yc-lbl`,
   `.yc-btn-primary`, `.yc-switch` - and the 940px rule that drops the brand panel
   live in marketing.css, which is imported by the (public) ROUTE LAYOUT rather than
   by any component. Storybook never renders that layout, so without this line the
   story draws user-agent inputs and the phone story below would still show two
   columns. Relative, matching the other marketing stories. */
import '../../../marketing/site/marketing.css';
import { STATS_CACHE_KEY, STATS_TS_KEY } from '@/app/features/marketing/site/useGithubStats';

/**
 * Seeds the marketing-stats session cache that the auth brand panel reads through
 * `useGithubStats`. The hook returns before fetching while the cache is inside its
 * 5 minute TTL and already holds a `discord` string, so seeding it keeps the mount
 * off `/api/community/*` - which under Storybook is a 404 - and pins the star pill
 * to a fixed number instead of one that differs between two Chromatic runs.
 */
const seedGithubStats = () => {
  setJsonStorageItem('session', STATS_CACHE_KEY, {
    stars: '2.4k',
    starsFull: '2,431',
    repositoryClones: '67,134',
    contributors: '38',
    discord: '1,204',
  });
  setStorageItem('session', STATS_TS_KEY, String(Date.now()));
};

/**
 * The AuthShell skeleton, read off the DOM rather than assumed from the markup.
 *
 * The form column is queried as a DIRECT CHILD of the grid on purpose. The
 * preview decorator stamps `data-yc-app` on its own wrapper `<main>` for every
 * story that does not opt out, so a bare `querySelector('[data-yc-app]')`
 * returns the DECORATOR, not the column - and the decorator wraps the grid, so
 * comparing its width to the grid's passes at every breakpoint and proves
 * nothing. `surface: 'marketing'` below turns that stamp off as well; the scoped
 * selector is the belt to its braces.
 */
const readShell = (canvasElement: HTMLElement) => {
  const grid = canvasElement.querySelector('[data-authgrid]') as HTMLElement;
  return {
    grid,
    formColumn: grid.querySelector(':scope > [data-yc-app]') as HTMLElement,
    brandPanel: grid.querySelector(':scope > [data-brandpanel]') as HTMLElement,
    tracks: getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/),
  };
};

/**
 * What `--screen` actually paints, resolved through a throwaway element instead
 * of being compared against a hex literal - the token flips with the toolbar
 * theme, so a hard-coded `rgb(247, 243, 236)` would pin the story to light mode.
 *
 * It mutates the DOM, so it is called BEFORE the waitFor that uses its result
 * and never from inside one: testing-library retries a waitFor callback through
 * a MutationObserver, and a callback that appends a node then throws re-queues
 * itself forever and wedges the tab instead of failing.
 */
const readScreenToken = (canvasElement: HTMLElement) => {
  const probe = document.createElement('span');
  probe.style.background = 'var(--screen)';
  canvasElement.appendChild(probe);
  const painted = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return painted;
};

const meta = {
  title: 'Auth/SignIn',
  component: SignIn,
  parameters: {
    layout: 'fullscreen',
    /* Stops the preview decorator stamping a SECOND `data-yc-app` around the
       whole canvas. AuthShell already puts that marker on the form column and
       deliberately leaves the dark brand panel outside it, so the decorator's
       wrapper would widen a scope the page is careful to keep narrow - and
       `body:has([data-yc-app])` still matches, because the shell supplies its
       own. This is what the app actually renders. */
    surface: 'marketing',
    /* Not optional here. `SignInForm` reads `email` and `next` from
       `useSearchParams` during its first render and pushes through `useRouter`
       after a successful sign in, so without the App Router mock the component
       throws before it paints. `query` is what the searchParams mock is built
       from - an empty one is the plain /signin entry. */
    nextjs: { appDirectory: true, navigation: { pathname: '/signin', query: {} } },
    docs: {
      description: {
        component:
          'The sign-in page for both products. The segmented **Account type** control at the top ' +
          'is the whole story: it is local state, not a route, so `/signin` renders either of two ' +
          'quite different pages and only one of them had ever been drawn.\n\n' +
          'Picking **Developer** rewrites four things at once - the page heading loses its ' +
          'italic-word treatment and becomes the plain sentence "Sign in to your developer ' +
          'account", the brand eyebrow turns teal, the headline changes possessive ("where your ' +
          'clinic" to "where you"), and the three brand points are re-ordered with the offline ' +
          'point demoted. It also decides the `devAuth` session flag and therefore where ' +
          '`resolvePostAuthRedirect` lands after the password is accepted.\n\n' +
          'What it cannot show is the fifth change: `GithubSignInButton` mounts under the form in ' +
          'the developer branch, but it returns `null` unless `NEXT_PUBLIC_AUTH_GITHUB_ENABLED` ' +
          'is `true` and this app ships no `.env`, so it is absent from Storybook. The developer ' +
          'story asserts that absence rather than implying the button was reviewed.\n\n' +
          'Sign-in validation is submit-time and covers exactly two fields, so the error state is ' +
          'two messages wide - a much smaller surface than sign-up, and the reason a wrong ' +
          'password produces a toast rather than an inline error.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => {
    seedGithubStats();
  },
} satisfies Meta<typeof SignIn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Pet business (default)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('radio', { name: 'Pet business' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(canvas.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(
      'Pick up where your clinic left off.'
    );
    await expect(
      canvas.getByText('Works on the worst afternoon. Even offline.')
    ).toBeInTheDocument();

    /* The desktop skeleton, measured rather than assumed: two tracks, two
       children, brand column the wider of the pair (1.06fr against 1fr). Track
       count alone is not enough - a rule that collapsed the grid would leave
       both children mounted and every copy assertion above would still pass -
       and child count alone is not enough either, since the 940px rule keeps
       the brand panel mounted and only hides it. This is the reading the phone
       story below is meant to be compared against. */
    const { grid, tracks } = readShell(canvasElement);
    await expect(tracks).toHaveLength(2);
    await expect(grid.children).toHaveLength(2);
    await expect(parseFloat(tracks[0])).toBeGreaterThan(parseFloat(tracks[1]));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default branch, the one every clinic sees. `isDeveloper` is a prop as well as a ' +
          'toggle, so `/developers/signin` renders the other branch from the first paint - but ' +
          'plain `/signin` always opens here.',
      },
    },
  },
};

export const DeveloperBranch: Story = {
  name: 'Developer branch',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const business = canvas.getByRole('radio', { name: 'Pet business' });
    const developer = canvas.getByRole('radio', { name: 'Developer' });
    // Read before the click and before the waitFor: it appends a probe node.
    const screenToken = readScreenToken(canvasElement);

    await userEvent.click(developer);

    await expect(developer).toHaveAttribute('aria-checked', 'true');
    await expect(business).toHaveAttribute('aria-checked', 'false');

    /* The selected pill is drawn ONLY by its background - `--screen` against the
       `--inset` trough - and that background is transitioned over 150ms
       (`transition: background 150ms ease` on the option style), so both reads
       go inside one waitFor. A single synchronous read catches the half-faded
       value on whichever pill is moving and fails on a page that is rendering
       perfectly. The assertion is the exact token, not "something other than
       transparent": a pill that landed on the wrong surface colour would still
       pass that weaker check while being invisible against the trough. */
    await waitFor(() => {
      expect(getComputedStyle(developer).backgroundColor).toBe(screenToken);
      expect(getComputedStyle(business).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    });

    // The heading loses the italic-word construction entirely in this branch.
    await expect(
      canvas.getByRole('heading', { name: 'Sign in to your developer account' })
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(
        'Pick up where you left off.'
      );
    });
    await expect(canvas.getByText('Open-source developer platform')).toBeInTheDocument();
    await expect(
      canvas.queryByText('Open-source operating system for animal health')
    ).not.toBeInTheDocument();

    /* Only ONE of the three points is genuinely new. "A FHIR-native API..." and
       "Free to self-host..." appear in both lists and are re-ordered rather than
       replaced, so asserting the arrival of the developer point AND the departure
       of the offline one is what actually proves the list swapped. */
    await expect(
      canvas.getByText('Open source. Read it, run it locally, send a PR.')
    ).toBeInTheDocument();
    await expect(
      canvas.queryByText('Works on the worst afternoon. Even offline.')
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByText('A FHIR-native API and a codebase you can actually read.')
    ).toBeInTheDocument();

    // The form itself never changes - same two fields, same submit, same subtitle.
    await expect(canvas.getByRole('textbox', { name: 'Work email' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Password')).toBeInTheDocument();
    await expect(
      canvas.getByText('Sign in to your clinic or developer workspace.')
    ).toBeInTheDocument();

    /* Env-gated: `isGithubSignInEnabled()` reads NEXT_PUBLIC_AUTH_GITHUB_ENABLED
       and no .env in this app sets it, so the "or / Continue with GitHub" block
       below the submit button renders nothing here. Asserted so the story does not
       quietly claim to have drawn it. */
    await expect(
      canvas.queryByRole('button', { name: 'Continue with GitHub' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText('GitHub is available for developer accounts.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'After clicking **Developer**. Everything that moves is on the left, plus the page ' +
          'heading; the form is byte-identical between the two branches, which is why the ' +
          'segmented control has to carry the whole signal.',
      },
    },
  },
};

export const ValidationErrors: Story = {
  name: 'Empty submit (two errors)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);

    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));

    const alerts = await canvas.findAllByRole('alert');
    await expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Email is required',
      'Password is required',
    ]);

    const email = canvas.getByRole('textbox', { name: 'Work email' });
    const password = canvas.getByLabelText('Password');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAttribute('aria-describedby', 'signin-email-error');
    await expect(password).toHaveAttribute('aria-describedby', 'signin-password-error');

    /* Proof that the guard ran before the request rather than after a rejection:
       `handleSignIn` returns ahead of `setIsSubmitting(true)`, so the fullscreen
       loader never mounts and the button never reads "Signing in...". */
    await expect(canvas.queryByTestId('signin-loader')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Submitting with both fields empty. Only presence and email shape are checked here - ' +
          'a wrong password is a server answer, and it arrives as a toast over the top of the ' +
          'page rather than as an inline message, so this two-line block is the most inline ' +
          'error this page can ever show.\n\n' +
          'The "Forgot password?" link sits in the label row of the password field, so it stays ' +
          'put when the error appears underneath rather than being pushed around by it.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10: it still type-checks and still renders, at the full panel width,
  // under a name that promises a phone. `mobile` is the 375px preset in preview.ts.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The shell is a two-column grid on desktop; the point of this story is
       which column survives at 375px. Read the geometry rather than trusting the
       class - and read all three facts, because each one alone is satisfiable by
       a broken page: ONE track (the 940px rule rewrites `1.06fr 1fr` to `1fr`),
       still TWO children (the brand panel is `display: none`, not unmounted, so
       nothing about its content is proven by its absence from a query), and the
       form column filling the grid, which is only true once the panel is out of
       the flow. */
    const { grid, formColumn, brandPanel, tracks } = readShell(canvasElement);
    await expect(tracks).toHaveLength(1);
    await expect(grid.children).toHaveLength(2);
    await expect(brandPanel).not.toBeVisible();
    // getBoundingClientRect, not getComputedStyle().width: the latter is the
    // content box and would read short of the grid's own width on any padded or
    // bordered ancestor.
    await expect(formColumn.getBoundingClientRect().width).toBe(grid.getBoundingClientRect().width);

    await expect(canvas.getByRole('radio', { name: 'Developer' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    // The header prompt is dropped by `[data-hide-s]` at 620px while the link it
    // introduces stays, so the row reads as a bare "Sign up" rather than wrapping.
    await expect(canvas.getByText('New to Yosemite Crew?')).not.toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Sign up' })).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'At phone width the brand panel is out of the flow and the form column owns the whole ' +
          'screen, so the segmented control and the two fields are all that is left. Worth ' +
          'keeping a story on: every piece of copy that sells the product lives in the column ' +
          'that disappears here.',
      },
    },
  },
};
