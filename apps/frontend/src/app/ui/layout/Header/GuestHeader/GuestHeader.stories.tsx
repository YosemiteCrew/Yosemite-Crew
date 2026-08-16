import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';

import type { AuthUser } from '@/app/stores/authStore';
import { useAuthStore } from '@/app/stores/authStore';
import GuestHeader from './GuestHeader';

// The header is styled by the shell stylesheet, which the app loads through
// `Header`, not through GuestHeader itself.
import '../Header.css';

const SIGNED_IN_USER: AuthUser = {
  userId: 'user-storybook',
  email: 'alina@sunrisevet.example',
  authProfile: null,
  loginMethod: 'emailpassword',
  emailVerified: true,
  getUsername: () => 'user-storybook',
};

/**
 * The header kicks off `checkSession()` whenever the auth store is still `idle`,
 * so every story seeds a settled status instead - that keeps the canvas offline
 * and deterministic. The previous store state is put back on unmount.
 */
const withAuth = (user: AuthUser | null, role: string | null) => () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({
    user,
    role,
    status: user ? 'authenticated' : 'unauthenticated',
  });
  return () => {
    useAuthStore.setState(snapshot);
  };
};

/**
 * The mobile story has to be snapshotted at a real narrow viewport: everything that
 * collapses the route list into the drawer is a `lg:` media query, so a merely narrow
 * container still renders the desktop bar.
 */
const MOBILE_VIEWPORT = {
  phone: {
    name: 'Mobile (375)',
    styles: { width: '375px', height: '812px' },
    type: 'mobile',
  },
};

/** Reproduces the sticky glass shell `Header` wraps the guest bar in. */
const HeaderShell = ({ children }: { children: ReactNode }) => (
  <div style={{ background: 'var(--page)', minHeight: 220 }}>
    <header className="yc-liquid-header-shell yc-guest-header-shell flex w-full items-center justify-center sticky top-0 left-0 z-997">
      {children}
    </header>
  </div>
);

const meta = {
  title: 'Layout/GuestHeader',
  component: GuestHeader,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
    docs: {
      description: {
        component:
          'The public marketing header: brand mark, the seven public routes and a single auth action. ' +
          'The active route is matched against the pathname and underlined. Below `lg` the route list ' +
          'collapses into the hamburger-driven `MobileMenu` and the auth action moves inside the ' +
          'drawer. Which action is shown depends on where you are - "Go to app" once a session exists, ' +
          'the opposite of the current auth page otherwise, and nothing at all on the routes that own ' +
          'their own navigation.',
      },
    },
  },
  decorators: [
    (Story) => (
      <HeaderShell>
        <Story />
      </HeaderShell>
    ),
  ],
  beforeEach: withAuth(null, null),
} satisfies Meta<typeof GuestHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  name: 'Signed out, on Home',
  parameters: {
    docs: {
      description: {
        story:
          'The default marketing state. "Home" carries the active-route treatment and the right-hand ' +
          'action is the primary "Sign up" button.',
      },
    },
  },
};

export const OnSignUpPage: Story = {
  name: 'On the sign-up page',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/signup' } },
    docs: {
      description: {
        story:
          'On `/signup` the action inverts to "Sign in", so the header never offers the page you are ' +
          'already on. `/signin` is the mirror image of this.',
      },
    },
  },
};

export const SignedIn: Story = {
  name: 'Signed in',
  beforeEach: withAuth(SIGNED_IN_USER, 'vet'),
  parameters: {
    docs: {
      description: {
        story:
          'With a session in the auth store the action becomes "Go to app", pointing at the default ' +
          "open screen for the member's role rather than at sign-up.",
      },
    },
  },
};

export const Mobile: Story = {
  name: 'Mobile (menu closed)',
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: {
    viewport: { options: MOBILE_VIEWPORT },
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below `lg` the route list and the desktop button are hidden and the hamburger takes over. ' +
          'The drawer itself is `inert` and `hidden` while closed, so nothing in it is tabbable from ' +
          'this state.',
      },
    },
  },
};
