import type { Meta, StoryObj } from '@storybook/react';
import { redirect } from '@storybook/nextjs-vite/navigation.mock';
import { expect, fn, waitFor, within } from 'storybook/test';

import {
  getStorageItem,
  removeStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from '@/app/lib/browserStorage';
import { useAuthStore, type AuthStore, type AuthUser } from '@/app/stores/authStore';
import SignUpPage from './SignUpPage';
/* Not decoration. `.yc-field`, `.yc-lbl`, `.yc-btn-primary`, `.yc-switch` and both
   keyframe sets the shell animates with live in marketing.css, which the (public)
   ROUTE LAYOUT imports rather than any component. Relative, matching SignUp.stories.tsx. */
import '../../../marketing/site/marketing.css';

/** Seeds the marketing-stats cache the brand panel reads, so the mount stays offline. */
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

/** `useSignUpDraft` restores a typed draft from sessionStorage; clear it so the form starts empty. */
const clearSignUpDraft = () => {
  removeStorageItem('session', 'yc_signup_draft');
};

const DEVELOPER: AuthUser = {
  userId: 'user-dev-1',
  email: 'mira.lindqvist@yosemitecrew.example',
  authProfile: null,
  loginMethod: 'emailpassword',
  emailVerified: true,
  getUsername: () => 'user-dev-1',
};

type SessionFixture = {
  status: AuthStore['status'];
  user?: AuthUser;
  role?: string;
  roles?: string[];
  checkSession?: AuthStore['checkSession'];
  developerDoor?: boolean;
};

/**
 * Pins the auth store, the `devAuth` flag and the saved default screen for the
 * story, and restores all three. `redirect()` from the App Router mock throws
 * the real Next redirect error; for the story it is re-implemented as a
 * recorder, and Storybook's mock reset restores it before the next story.
 */
const withSession =
  ({ status, user, role, roles, checkSession, developerDoor }: SessionFixture) =>
  () => {
    const snapshot = useAuthStore.getState();
    useAuthStore.setState({
      status,
      user: user ?? null,
      role: role ?? null,
      roles: roles ?? [],
      checkSession: checkSession ?? snapshot.checkSession,
    });
    const previousDevAuth = getStorageItem('session', 'devAuth');
    if (developerDoor) {
      setStorageItem('session', 'devAuth', 'true');
    } else {
      removeStorageItem('session', 'devAuth');
    }
    const previousScreen = getStorageItem('local', 'yc_default_open_screen');
    removeStorageItem('local', 'yc_default_open_screen');
    redirect.mockImplementation(() => undefined as never);

    return () => {
      useAuthStore.setState({
        status: snapshot.status,
        user: snapshot.user,
        role: snapshot.role,
        roles: snapshot.roles,
        checkSession: snapshot.checkSession,
      });
      if (previousDevAuth === null) {
        removeStorageItem('session', 'devAuth');
      } else {
        setStorageItem('session', 'devAuth', previousDevAuth);
      }
      if (previousScreen !== null) {
        setStorageItem('local', 'yc_default_open_screen', previousScreen);
      }
    };
  };

const meta = {
  title: 'Auth/SignUpPage',
  component: SignUpPage,
  parameters: {
    layout: 'fullscreen',
    surface: 'marketing',
    // A closed OtpModal holds a router, the shell's links are next/link, and the
    // shell calls `redirect()`: all three want the App Router mock.
    nextjs: { appDirectory: true, navigation: { pathname: '/signup' } },
    docs: {
      description: {
        component:
          'The `/signup` route page: `SignUp` inside `AuthedRedirectShell`. The form itself is ' +
          'reviewed in `Auth/SignUp`; this wrapper adds the same gate `/signin` has. An `idle` ' +
          'session triggers one `checkSession()` with the form on screen, a signed-out visitor ' +
          'gets the form, and a visitor who already has a session gets nothing at all while the ' +
          'shell resolves where they belong and calls `redirect()`.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: () => {
    seedGithubStats();
    clearSignUpDraft();
  },
} satisfies Meta<typeof SignUpPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  name: 'Signed out',
  beforeEach: withSession({ status: 'unauthenticated', checkSession: fn(async () => null) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('combobox', { name: 'I am' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(
      'See the whole animal.'
    );
    await expect(useAuthStore.getState().checkSession).not.toHaveBeenCalled();
    await expect(redirect).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The page as a new visitor sees it. The shell is transparent and the sign-up form ' +
          'renders exactly as in its own stories, with no session check because the status is ' +
          'already settled.',
      },
    },
  },
};

export const SessionUnresolved: Story = {
  name: 'Session not yet checked',
  beforeEach: withSession({ status: 'idle', checkSession: fn(async () => null) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    await waitFor(() => expect(useAuthStore.getState().checkSession).toHaveBeenCalledTimes(1));
    await expect(redirect).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A cold load of `/signup`. The shell starts the one session check a public route ' +
          'otherwise never makes, and keeps the form on screen while it waits.',
      },
    },
  },
};

export const AuthenticatedRedirect: Story = {
  name: 'Already signed in (redirects)',
  beforeEach: withSession({
    status: 'authenticated',
    user: DEVELOPER,
    role: 'developer',
    roles: ['developer'],
    developerDoor: true,
  }),
  decorators: [
    (StoryFn) => (
      <div style={{ padding: 32, display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, maxWidth: 560, fontSize: 13, color: 'var(--ink-muted)' }}>
          Nothing below this note is painted by the page: a signed-in visitor never sees the form.
          The shell resolves the destination and calls redirect().
        </p>
        <div data-testid="page-output">
          <StoryFn />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-authgrid]')).toBeNull();
    await expect(canvas.getByTestId('page-output').childElementCount).toBe(0);
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/developers/home'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'A developer with a live session opening `/signup`. The form never mounts and the ' +
          "shell calls `redirect('/developers/home')` once the destination resolves. The " +
          'canvas is empty because that is what the page renders for a visitor on their way ' +
          'elsewhere.',
      },
    },
  },
};
