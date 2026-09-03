import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  IoCalendarOutline,
  IoCloudOfflineOutline,
  IoCodeSlashOutline,
  IoExtensionPuzzleOutline,
  IoGitBranchOutline,
} from 'react-icons/io5';
import Link from 'next/link';
import { expect, fn, within } from 'storybook/test';

import { AuthBrandContent, AuthShell, type AuthBrandPoint } from './AuthShell';
// `.yc-field`, `.yc-btn-primary` and `.yc-switch` are all in this sheet, along with
// the `data-authgrid` / `data-brandpanel` rules that collapse the split screen below
// 940px. Only `(routes)/(public)/layout.tsx` loads it in the app, so without the
// import the form column renders as unstyled browser inputs.
import './marketing.css';
import {
  AuthAltNote,
  AuthForm,
  AuthHeading,
  AuthPasswordField,
  AuthSubmitButton,
  AuthSubtitle,
  AuthTextField,
} from '@/app/features/auth/pages/authForm';
import { STATS_CACHE_KEY, STATS_TS_KEY } from '@/app/features/marketing/site/useGithubStats';

/**
 * Session-cache keys owned by `useGithubStats` (module-private there). The star pill
 * in the brand panel renders from this cache, and the hook refreshes over the network
 * unless BOTH the timestamp is inside the TTL and `discord` is already a string - a
 * missing discord value forces a refresh on its own. Seeding both keeps the two
 * `/api/community/*` requests off the Storybook dev server and makes the count stable.
 */

const CACHED_STATS = {
  stars: '2.4k',
  starsFull: '2,431',
  repositoryClones: '67,134',
  contributors: '128',
  discord: '3,182',
};

const seedStats = (cached: boolean) => () => {
  if (cached) {
    globalThis.sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(CACHED_STATS));
    globalThis.sessionStorage.setItem(STATS_TS_KEY, String(Date.now()));
  } else {
    globalThis.sessionStorage.removeItem(STATS_CACHE_KEY);
    globalThis.sessionStorage.removeItem(STATS_TS_KEY);
  }
  return () => {
    globalThis.sessionStorage.removeItem(STATS_CACHE_KEY);
    globalThis.sessionStorage.removeItem(STATS_TS_KEY);
  };
};

/* Copy lifted from the pages that mount this shell, so the stories exercise the
   real line lengths: SignIn for the clinic panel, SignUp for the developer one. */
const CLINIC_POINTS: readonly AuthBrandPoint[] = [
  {
    icon: <IoCalendarOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Appointments, records, and billing on one screen.',
  },
  {
    icon: <IoGitBranchOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'A FHIR-native API and a codebase you can actually read.',
  },
  {
    icon: <IoCloudOfflineOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Works on the worst afternoon. Even offline.',
  },
];

const DEV_POINTS: readonly AuthBrandPoint[] = [
  {
    icon: <IoCodeSlashOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'REST and FHIR APIs, typed SDKs, and webhooks.',
  },
  {
    icon: <IoGitBranchOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Open source. Read it, run it locally, send a PR.',
  },
  {
    icon: <IoExtensionPuzzleOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Ship plugins to the marketplace. Reach every clinic.',
  },
];

const ClinicBrand = () => (
  <AuthBrandContent
    eyebrow="Open-source operating system for animal health"
    title={
      <>
        See the <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#8fb6f5' }}>whole</em>{' '}
        animal.
      </>
    }
    subtitle="The operating system veterinary clinics run on, and the platform developers build on. Free to self-host, and yours to own."
    points={CLINIC_POINTS}
  />
);

const DeveloperBrand = () => (
  <AuthBrandContent
    eyebrow="Open-source developer platform"
    title={
      <>
        Build it in{' '}
        <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#5ce1e6' }}>an afternoon.</em>
      </>
    }
    subtitle="A FHIR-native API, a plugin system, and a codebase you can actually read. Publish once and reach every clinic running Yosemite Crew."
    points={DEV_POINTS}
  />
);

const SwitchPrompt = ({
  prompt,
  action,
  href,
}: Readonly<{ prompt: string; action: string; href: string }>) => (
  <>
    {/* data-hide-s drops the question below 620px so the link keeps its room next
        to the theme toggle on a phone. */}
    <span data-hide-s="true">{prompt}</span>
    <Link href={href} className="yc-switch">
      {action}
    </Link>
  </>
);

/**
 * A representative form column. The fields are controlled, so the state has to live
 * in a real component - a `useState` inside a story `render` breaks
 * `react-hooks/rules-of-hooks`. The submit is a no-op: nothing here should reach
 * SuperTokens.
 */
const SignInFormColumn = () => {
  const [email, setEmail] = useState('elena@harboursidevet.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <AuthHeading>
        Welcome{' '}
        <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--nav-active)' }}>back</em>
      </AuthHeading>
      <AuthSubtitle>Sign in to your clinic or developer workspace.</AuthSubtitle>
      <AuthForm onSubmit={fn()}>
        <AuthTextField
          id="story-signin-email"
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          ariaLabel="Work email"
          placeholder="you@practice.com"
          value={email}
          onChange={setEmail}
        />
        <AuthPasswordField
          id="story-signin-password"
          label="Password"
          name="password"
          ariaLabel="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={setPassword}
          showPassword={showPassword}
          onToggleShowPassword={() => setShowPassword((shown) => !shown)}
        />
        <AuthSubmitButton idle="Sign in" busy="Signing in..." isSubmitting={false} />
      </AuthForm>
      <AuthAltNote>Pet parents sign in from the mobile app.</AuthAltNote>
    </>
  );
};

const shellOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-authgrid="true"]') as HTMLElement;

const brandPanelOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-brandpanel="true"]') as HTMLElement;

const starPillOf = (canvasElement: HTMLElement) =>
  within(brandPanelOf(canvasElement)).getByRole('link', { name: /Star on GitHub/ });

const meta = {
  title: 'Marketing/AuthShell',
  component: AuthShell,
  parameters: {
    layout: 'fullscreen',
    // Marketing surface. The shell puts `data-yc-app` on its own form column and
    // deliberately leaves the dark brand panel without it, so the preview decorator
    // must not stamp the marker on the wrapper around both.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The split-screen chrome behind sign in, sign up, forgot password and reset password: a ' +
          'dark brand panel with drifting glows on the left, and the warm-bone form column on the ' +
          'right.\n\n' +
          '`AuthBrandContent` is the swappable middle block of that panel and is exercised through ' +
          'the shell here, which is the only way it is ever used. It carries a live star count off ' +
          'the community-stats session cache, seeded per story.\n\n' +
          'The detail that is easiest to break and impossible to see: `data-yc-app` sits on the ' +
          'FORM column, not on the shell root. That marker is what switches the faint inks to their ' +
          'readable PIMS values, and the brand panel needs the lighter marketing ones - the same ' +
          'reason the marketing `--spot` sections opt out.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    brand: <ClinicBrand />,
    topRight: <SwitchPrompt prompt="New to Yosemite Crew?" action="Sign up" href="/signup" />,
    children: <SignInFormColumn />,
  },
  beforeEach: seedStats(true),
} satisfies Meta<typeof AuthShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Clinic sign in',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const shell = shellOf(canvasElement);
    const brand = brandPanelOf(canvasElement);
    const form = shell.children[1] as HTMLElement;

    /* The 1.06:1 split, measured. The ratio is an inline
       `gridTemplateColumns: '1.06fr 1fr'` with no fallback anywhere, so a
       stylesheet that started fighting it would show up as two equal halves and
       nothing else would complain. */
    const brandWidth = brand.getBoundingClientRect().width;
    const formWidth = form.getBoundingClientRect().width;
    await expect(brandWidth / formWidth).toBeCloseTo(1.06, 2);

    /* The marker is on the form column ONLY. On the root it would drag the dark
       brand panel onto the PIMS inks; absent altogether it would leave the form
       column with the lighter marketing values on a bone background. Both
       failures are a contrast regression that no snapshot catches. */
    await expect(shell.hasAttribute('data-yc-app')).toBe(false);
    await expect(form.hasAttribute('data-yc-app')).toBe(true);
    await expect(brand.querySelector('[data-yc-app]')).toBeNull();

    // Brand copy. The title is the panel's h2 - the form column owns the h1, and
    // the preview decorator adds an sr-only h1 of its own, so level matters here.
    await expect(
      within(brand).getByRole('heading', { level: 2, name: 'See the whole animal.' })
    ).toBeInTheDocument();
    await expect(
      within(brand).getByText('Open-source operating system for animal health')
    ).toBeInTheDocument();
    await expect(
      within(brand).getByText('Works on the worst afternoon. Even offline.')
    ).toBeInTheDocument();

    // Seeded count, rendered as one string beside the "building in the open" tag.
    await expect(starPillOf(canvasElement)).toHaveTextContent('Star on GitHub · 2.4k');
    await expect(starPillOf(canvasElement)).toHaveTextContent('building in the open');

    // The prompt above the form, and the escape hatch back to the marketing site.
    await expect(canvas.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
    await expect(canvas.getByRole('link', { name: /Back to home/ })).toHaveAttribute('href', '/');
    await expect(
      canvas.getByRole('button', { name: /Switch to (light|dark) theme/ })
    ).toBeInTheDocument();

    /* The skip-link target. It is only useful if it can take focus, and
       `tabIndex={-1}` is the whole mechanism - drop it and the skip link moves the
       viewport without moving focus, which is the failure mode a keyboard user
       hits and nobody else ever sees. */
    const main = canvasElement.querySelector('#main-content') as HTMLElement;
    await expect(main.tabIndex).toBe(-1);
    main.focus();
    await expect(main).toHaveFocus();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The shell as the clinic sign-in page mounts it. The brand panel is a fixed dark ' +
          'gradient with three drifting glows behind it, so it stays legible regardless of the ' +
          "site theme; the form column follows the reader's.",
      },
    },
  },
};

export const DeveloperSignUp: Story = {
  name: 'Developer sign up',
  args: {
    brand: <DeveloperBrand />,
    topRight: (
      <SwitchPrompt prompt="Already have an account?" action="Sign in" href="/developers/signin" />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const brand = brandPanelOf(canvasElement);

    /* Same chrome, different middle block. Everything outside `brand` and
       `topRight` is fixed by the shell, which is what makes this worth a second
       story: the two audiences must not diverge anywhere else. */
    await expect(
      within(brand).getByRole('heading', { level: 2, name: 'Build it in an afternoon.' })
    ).toBeInTheDocument();
    await expect(within(brand).getByText('Open-source developer platform')).toBeInTheDocument();
    await expect(
      within(brand).getByText('REST and FHIR APIs, typed SDKs, and webhooks.')
    ).toBeInTheDocument();

    // The prompt is the mirror of the sign-in one and points at the developer
    // route, not the clinic one - the two pairs are easy to cross over.
    await expect(canvas.getByText('Already have an account?')).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/developers/signin'
    );

    // Four compliance badges, all with real alt text: they are images of claims,
    // so an empty alt would leave the panel's trust row silent.
    for (const alt of ['GDPR', 'SOC 2', 'ISO 27001', 'FHIR']) {
      await expect(within(brand).getByAltText(alt)).toBeInTheDocument();
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The developer half of the same shell: cyan eyebrow and accent word instead of blue, ' +
          'API and plugin points, and a prompt pointing back at the developer sign-in route.',
      },
    },
  },
};

export const StarCountUnresolved: Story = {
  name: 'Star count unresolved',
  beforeEach: seedStats(false),
  play: async ({ canvasElement }) => {
    /* Cold session cache, which is also every first visit: the pill drops the
       count rather than showing a zero, an empty separator or a skeleton. The
       middle dot is part of the count string, so its absence is the assertion. */
    const pill = starPillOf(canvasElement);
    await expect(pill).toHaveTextContent('Star on GitHub');
    await expect(pill).not.toHaveTextContent('·');
    await expect(pill).toHaveTextContent('building in the open');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The brand panel before the community stats resolve. The pill keeps its full width and ' +
          'its trailing tag, so the count arriving a moment later does not reflow the panel.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below 940px `marketing.css` collapses `data-authgrid` to a single column and hides ' +
          '`data-brandpanel` outright, so a phone visitor gets the form column alone - the header ' +
          'row, the heading and the fields, with the eyebrow/points/star pill dropped rather than ' +
          'stacked above the form. That is a viewport media query applied by the Storybook ' +
          'manager, so this story carries no play function: a headless render of the preview ' +
          'iframe would measure the desktop split under a phone-shaped name.',
      },
    },
  },
};
