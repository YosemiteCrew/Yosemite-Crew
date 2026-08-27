import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import DevRouteGuard from './DevRouteGuard';
import { useAuthStore } from '@/app/stores/authStore';

type AuthStatus =
  'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'signin-authenticated';

/**
 * Seeds the auth store the way a resolved session does and restores the previous
 * state when the story unmounts, so a seeded role cannot leak into the next
 * story. Nothing here touches SuperTokens or the API.
 */
const withSession = (status: AuthStatus, role: string | null) => {
  return () => {
    const snapshot = useAuthStore.getState();
    useAuthStore.setState({ status, role });
    return () => {
      useAuthStore.setState({ status: snapshot.status, role: snapshot.role });
    };
  };
};

/** Stand-in for whatever developer-portal page the guard is wrapped around. */
const DeveloperPanel = () => (
  <div className="rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5 py-4 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
    <p className="text-[15px] font-semibold text-[var(--ink-body)]">API keys</p>
    <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
      Two live keys, one sandbox key. Visible because the session carries the developer role.
    </p>
  </div>
);

/**
 * The guard renders either its children or nothing, so an empty story would be
 * an empty canvas. The slot makes the difference legible: what sits inside the
 * dashed outline is the guard's entire output.
 */
const RouteSlot = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <span className="text-[11px] font-semibold tracking-[0.1em] text-[var(--ink-faint)] uppercase">
      Route slot
    </span>
    <div className="min-h-[96px] rounded-[18px] border border-dashed border-[var(--hairline)] p-3">
      {children}
    </div>
  </div>
);

const meta = {
  title: 'Layout/DevRouteGuard',
  component: DevRouteGuard,
  parameters: {
    layout: 'padded',
    // The guard reads `usePathname` and can call `redirect`, both of which need
    // the App Router mock.
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/api-keys' } },
    docs: {
      description: {
        component:
          'Route wrapper for the developer portal: under `/developers` it renders its children only ' +
          'for an authenticated session carrying the developer role, and renders nothing while auth ' +
          'is still resolving. Any other path passes straight through, so it is safe to mount high in ' +
          'the tree.\n\n' +
          'An authenticated non-developer gets a denial view and keeps their session. Signing them ' +
          'out instead — as this did — threw away a valid session for the whole app because a ' +
          '`/developers/*` URL was opened, and the redirect that followed landed on a sign-in that ' +
          'could only fail the same way, which read as valid credentials being rejected.',
      },
    },
  },
  args: {
    children: <DeveloperPanel />,
  },
  decorators: [
    (Story) => (
      <RouteSlot>
        <Story />
      </RouteSlot>
    ),
  ],
  beforeEach: withSession('authenticated', 'developer'),
} satisfies Meta<typeof DevRouteGuard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Developer: Story = {
  name: 'Developer session',
  parameters: {
    docs: {
      description: {
        story:
          'The permitted case: the guard is invisible and the page renders as though it were not ' +
          'wrapped at all.',
      },
    },
  },
};

export const Pending: Story = {
  name: 'Session still resolving',
  beforeEach: withSession('checking', null),
  parameters: {
    docs: {
      description: {
        story:
          'While the session check is in flight the guard renders nothing — deliberately, since ' +
          'showing the portal first and pulling it back would flash developer content at a visitor ' +
          'who has not been verified yet. The slot is empty for the whole of that window, so pages ' +
          'behind this guard should not rely on their own loading state to fill it.',
      },
    },
  },
};

export const NonDeveloperRoute: Story = {
  name: 'Outside /developers',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/dashboard' } },
    docs: {
      description: {
        story:
          'On any path outside `/developers` the guard is a pass-through: no role is required and ' +
          'nothing is redirected, even for a signed-out visitor. The unauthenticated redirect is not ' +
          'storied — it navigates rather than renders, which throws inside a story.',
      },
    },
  },
  beforeEach: withSession('unauthenticated', null),
};

export const NotADeveloper: Story = {
  name: 'Signed in, not a developer',
  beforeEach: withSession('authenticated', 'user'),
  parameters: {
    docs: {
      description: {
        story:
          'A valid session for an account that is not a developer one. The distinction the copy has ' +
          'to carry is that nothing is wrong with the credentials — the portal is a separate account ' +
          'type — so the way forward is a developer account, not another sign-in attempt.\n\n' +
          'The session is left intact. It is only cleared if the reader chooses to go and register, ' +
          'so that the sign-up form does not open on top of a live session for a different account.',
      },
    },
  },
};
