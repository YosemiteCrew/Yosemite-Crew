import type { Meta, StoryObj } from '@storybook/react';

import ProtectedRoute from './ProtectedRoute';
import PageSkeleton from '../PageSkeleton';
// Relative, not `@/`: the Storybook Vite build does not resolve the `@/` alias
// for runtime imports inside story files (type-only `@/` imports are erased
// before Rollup sees them, which is why they are safe elsewhere).
import { useAuthStore } from '../../../stores/authStore';

type AuthStatus =
  'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'signin-authenticated';

/**
 * Seeds the auth status the guard reads and restores the previous state when
 * the story unmounts. Only the status is touched — no store action is called,
 * so nothing here reaches SuperTokens.
 */
const withAuthStatus = (status: AuthStatus) => {
  return () => {
    const snapshot = useAuthStore.getState();
    useAuthStore.setState({ status });
    return () => {
      useAuthStore.setState(snapshot);
    };
  };
};

const ProtectedPage = () => (
  <div className="flex flex-col gap-2 rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5 py-4">
    <span className="text-[15px] font-semibold text-[var(--ink)]">Today&apos;s schedule</span>
    <span className="text-[13px] text-[var(--ink-muted)]">
      Eleven appointments, four practitioners on duty.
    </span>
  </div>
);

const meta = {
  title: 'Layout/Guards/ProtectedRoute',
  component: ProtectedRoute,
  parameters: {
    layout: 'padded',
    // The guard reads `usePathname` to build the sign-in return URL, so the App
    // Router mock has to be on even in the stories that never redirect.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The gate every signed-in route sits behind. While the auth provider is still resolving ' +
          'the session it renders the caller’s `skeleton` and holds the protected children ' +
          'unmounted, so no org-scoped loader can fire against a session that may not exist; once ' +
          'the session is confirmed it renders the children unchanged. An unauthenticated visitor is ' +
          'redirected to `/signin` with the current path as `next` — that branch throws Next’s ' +
          'redirect signal, so it has no story here.',
      },
    },
  },
  args: {
    children: <ProtectedPage />,
  },
} satisfies Meta<typeof ProtectedRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Session confirmed. The guard is invisible: children render exactly as they
 * would without it, with no wrapper element of its own.
 */
export const Authenticated: Story = {
  beforeEach: withAuthStatus('authenticated'),
};

/**
 * The state worth looking at. While the session is being checked the guard
 * swaps in the page skeleton rather than a spinner, so the layout the user is
 * about to get is already on screen at the right shape.
 */
export const Checking: Story = {
  name: 'Session being checked',
  args: { skeleton: <PageSkeleton variant="list" /> },
  beforeEach: withAuthStatus('checking'),
};

/**
 * A caller that passes no `skeleton`. The guard renders nothing at all rather
 * than inventing a placeholder — correct for a small embedded region, wrong for
 * a full page, which is why every route-level caller passes one.
 */
export const CheckingWithoutSkeleton: Story = {
  name: 'Checking, no skeleton',
  beforeEach: withAuthStatus('checking'),
};
