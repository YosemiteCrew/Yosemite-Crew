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
import SignInPage from './SignInPage';
/* Not decoration. `.yc-field`, `.yc-lbl`, `.yc-btn-primary`, `.yc-switch` and the 940px
   rule live in marketing.css, which the (public) ROUTE LAYOUT imports rather than any
   component. Storybook never renders that layout. Relative, matching SignIn.stories.tsx. */
import '../../../marketing/site/marketing.css';

/**
 * Seeds the marketing-stats session cache the auth brand panel reads through
 * `useGithubStats`, so the mount stays off `/api/community/*` and the star pill
 * is pinned to one number.
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
  title: 'Auth/SignInPage',
  component: SignInPage,
  parameters: {
    layout: 'fullscreen',
    /* AuthShell puts `data-yc-app` on the form column itself and keeps the dark
       brand panel outside it; the decorator's wrapper would widen that scope. */
    surface: 'marketing',
    /* `SignInForm` reads `email` and `next` from `useSearchParams` on first render
       and the shell calls `redirect()`, so the App Router mock is required. */
    nextjs: { appDirectory: true, navigation: { pathname: '/signin', query: {} } },
    docs: {
      description: {
        component:
          'The `/signin` route page: `SignIn` inside `AuthedRedirectShell`. The screen itself ' +
          'is reviewed in `Auth/SignIn`; what this wrapper adds is the gate. A visitor whose ' +
          'session is still `idle` triggers one `checkSession()` and sees the form meanwhile; ' +
          'a signed-out visitor sees the form; a signed-in visitor sees nothing, because the ' +
          'shell returns `null` and hands the navigation to `redirect()` as soon as ' +
          '`resolvePostAuthRedirect` answers. That third reading has no pixels of its own, so ' +
          'its story asserts the redirect and the absence of the form.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: () => {
    seedGithubStats();
  },
} satisfies Meta<typeof SignInPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  name: 'Signed out',
  beforeEach: withSession({ status: 'unauthenticated', checkSession: fn(async () => null) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    await expect(canvas.getByRole('radio', { name: 'Pet business' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(canvas.getByRole('textbox', { name: 'Work email' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await expect(useAuthStore.getState().checkSession).not.toHaveBeenCalled();
    await expect(redirect).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The page as a signed-out visitor sees it: the shell is transparent and the sign-in ' +
          'screen renders exactly as in its own stories. The status is already settled, so no ' +
          'session check is started.',
      },
    },
  },
};

export const SessionUnresolved: Story = {
  name: 'Session not yet checked',
  beforeEach: withSession({ status: 'idle', checkSession: fn(async () => null) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    // The shell asks once; the form is on screen while the answer is pending.
    await waitFor(() => expect(useAuthStore.getState().checkSession).toHaveBeenCalledTimes(1));
    await expect(redirect).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A cold load of `/signin`. Public routes do not bootstrap the session check, so the ' +
          'shell does it, and it does not blank the form while waiting.',
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
    await expect(canvas.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-authgrid]')).toBeNull();
    await expect(canvas.getByTestId('page-output').childElementCount).toBe(0);
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/developers/home'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'A developer with a live session opening `/signin`. The form never mounts; the shell ' +
          'resolves the portal as the destination (no request is needed for a developer who came ' +
          "through the developer door) and calls `redirect('/developers/home')`. The empty " +
          'canvas is the honest reading - it is what the visitor sees for the instant before ' +
          'the portal paints.',
      },
    },
  },
};
