import type { Meta, StoryObj } from '@storybook/react';
import { redirect } from '@storybook/nextjs-vite/navigation.mock';
import { expect, fn, waitFor, within } from 'storybook/test';

import { getStorageItem, removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { useAuthStore, type AuthStore, type AuthUser } from '@/app/stores/authStore';
import AuthedRedirectShell from './AuthedRedirectShell';

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
  /** Marks the session as entered through the developer sign-in form. */
  developerDoor?: boolean;
};

/**
 * Pins the auth store the story is built around and restores it afterwards.
 * `checkSession` is replaced whenever the fixture supplies one, because the
 * real one reaches SuperTokens and would overwrite `status` as it settled.
 *
 * `devAuth` decides where an authenticated developer is sent, and the saved
 * default-screen preference decides where a practice role lands, so both are
 * pinned too: `resolvePostAuthRedirect` returns `/developers/home` synchronously
 * for a developer who came through the developer door, which keeps the
 * authenticated story off the network entirely.
 *
 * `redirect()` from the App Router mock THROWS a Next redirect error, which is
 * the right thing in the app (Next's boundary performs the navigation) and the
 * wrong thing in a story (an error boundary and a console error). It is
 * re-implemented as a recorder for the story, and Storybook's mock reset puts
 * the original back before the next one.
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

/** Stands in for the sign-in or sign-up screen the shell wraps. */
const AuthScreen = () => (
  <section
    aria-labelledby="auth-screen-title"
    style={{
      maxWidth: 420,
      padding: 28,
      border: '1px solid var(--hairline)',
      borderRadius: 20,
      background: 'var(--screen)',
      display: 'grid',
      gap: 8,
    }}
  >
    <h2 id="auth-screen-title" style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
      Auth screen renders here
    </h2>
    <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>
      The shell wraps this in a Suspense boundary and only withholds it for a visitor who is already
      signed in.
    </p>
  </section>
);

const meta = {
  title: 'Auth/AuthedRedirectShell',
  component: AuthedRedirectShell,
  parameters: {
    layout: 'padded',
    // `redirect()` is the App Router's.
    nextjs: { appDirectory: true, navigation: { pathname: '/signin' } },
    docs: {
      description: {
        component:
          'The wrapper the `/signin` and `/signup` route pages render around their screens. It ' +
          'has one job: a visitor who is already authenticated must never see the auth form, ' +
          'they are forwarded to wherever they belong. Public routes do not bootstrap the ' +
          'SuperTokens session check, so the shell kicks `checkSession()` off itself when the ' +
          'store is still `idle`; once the status is `authenticated` it resolves the destination ' +
          'with `resolvePostAuthRedirect` (developer portal, organisation picker, onboarding, ' +
          'dashboard) in an effect and calls `redirect()` during render. While that is in ' +
          'flight, and for anyone not signed in, the children render inside a `Suspense` ' +
          'boundary with a null fallback.\n\n' +
          'The authenticated reading is therefore blank by design: the shell returns `null` the ' +
          'moment the status is `authenticated`, so nothing is painted for a visitor who is on ' +
          'their way somewhere else. The story for it asserts the redirect call instead of ' +
          'looking for pixels.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    children: <AuthScreen />,
  },
  argTypes: {
    children: { table: { disable: true } },
  },
} satisfies Meta<typeof AuthedRedirectShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  name: 'Signed out (renders the screen)',
  beforeEach: withSession({ status: 'unauthenticated', checkSession: fn(async () => null) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Auth screen renders here' })
    ).toBeInTheDocument();
    // Already settled, so no second session check and no redirect.
    await expect(useAuthStore.getState().checkSession).not.toHaveBeenCalled();
    await expect(redirect).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday case. The status is already `unauthenticated`, so the shell neither ' +
          'checks the session again nor resolves a destination; the children are simply there.',
      },
    },
  },
};

export const SessionUnresolved: Story = {
  name: 'Idle session (check kicked off)',
  beforeEach: withSession({ status: 'idle', checkSession: fn(async () => null) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Auth screen renders here' })
    ).toBeInTheDocument();
    await waitFor(() => expect(useAuthStore.getState().checkSession).toHaveBeenCalledTimes(1));
    await expect(redirect).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A cold load: the store is `idle` because nothing on a public route has asked ' +
          'SuperTokens yet. The shell asks once and, while the answer is outstanding, still ' +
          'renders the screen - a signed-out visitor should not stare at a blank page waiting ' +
          'for a check that will confirm they are signed out.',
      },
    },
  },
};

export const Checking: Story = {
  name: 'Session being checked',
  beforeEach: withSession({ status: 'checking', checkSession: fn(async () => null) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Auth screen renders here' })
    ).toBeInTheDocument();
    // `checking` is not `idle`: the shell does not start a second check.
    await expect(useAuthStore.getState().checkSession).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mid-check. Visually identical to signed out, and asserted here so the `idle` guard ' +
          'cannot regress into firing `checkSession()` on every render while one is in flight.',
      },
    },
  },
};

export const Authenticated: Story = {
  name: 'Authenticated (renders nothing, redirects)',
  beforeEach: withSession({
    status: 'authenticated',
    user: DEVELOPER,
    role: 'developer',
    roles: ['developer'],
    developerDoor: true,
  }),
  decorators: [
    (StoryFn) => (
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, maxWidth: 520, color: 'var(--ink-muted)', fontSize: 13 }}>
          Nothing below this note is painted by the shell. An authenticated visitor gets no auth
          screen at all: the shell returns null, resolves the destination, and hands the navigation
          to redirect().
        </p>
        <div data-testid="shell-output">
          <StoryFn />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('heading', { name: 'Auth screen renders here' })
    ).not.toBeInTheDocument();
    await expect(canvas.getByTestId('shell-output').childElementCount).toBe(0);
    // A developer through the developer door resolves without touching the network.
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/developers/home'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'A signed-in developer who opened `/signin`. The children never mount, and once ' +
          "`resolvePostAuthRedirect` answers the shell calls `redirect('/developers/home')`. " +
          'In the app that throws and Next performs the navigation; here the mock records the ' +
          'call and the canvas stays empty, which is exactly what the visitor would see for the ' +
          'instant before the new route paints.',
      },
    },
  },
};
