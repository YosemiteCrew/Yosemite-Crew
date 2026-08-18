import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { expect, userEvent, within } from 'storybook/test';

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
          'their own navigation.\n\n' +
          'The drawer itself is the part no story drew. `MobileMenu` is gated on a `menuOpen` ' +
          '`useState` that only `HamburgerMenuButton` can flip, and while closed it carries both ' +
          '`inert` and `hidden` - so its eight children are not merely off-screen, they are absent ' +
          'from the accessibility tree entirely and unreachable by any query. Every mobile snapshot ' +
          'was therefore of a header with no navigation in it. The `MobileMenuOpen` stories below ' +
          'click the hamburger and count what is inside, because a drawer that opens onto nothing ' +
          'satisfies `aria-expanded` just as well as one that works.\n\n' +
          'Two details are only visible open: the auth CTA lives **inside** the drawer on mobile ' +
          '(passed `href="#"` with an `onClick`, so it renders as a `<button>`, not a link, and ' +
          'routes through the 400ms close-then-push handler), and the current route keeps its ' +
          '`yc-guest-mobile-route-active` treatment in the list as well as in the desktop bar.',
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

/**
 * Opens the drawer and returns it, asserting it was genuinely unreachable first.
 *
 * Queries here are deliberately name/attribute based rather than `getByRole`.
 * Both the hamburger and the drawer are `lg:hidden`, so at any canvas wider than
 * 1024 they are `display: none` and role queries skip them - which would make
 * this story pass or fail on the width of whatever loaded it rather than on the
 * component. The `hidden`/`inert` pair below is the real gate and holds at every
 * width.
 */
const openDrawer = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const drawer = canvasElement.querySelector('#guest-mobile-menu') as HTMLElement;
  await expect(drawer).toBeInTheDocument();
  // Closed means out of the accessibility tree and untabbable, not just off-screen.
  await expect(drawer).toHaveAttribute('hidden');
  await expect(drawer).toHaveAttribute('inert');
  await userEvent.click(canvas.getByLabelText('Open menu'));
  await expect(drawer).not.toHaveAttribute('hidden');
  await expect(drawer).not.toHaveAttribute('inert');
  return drawer;
};

export const MobileMenuOpen: Story = {
  name: 'Mobile (menu open)',
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    // Count the drawer's contents: seven routes plus the auth CTA, all buttons.
    await expect(within(drawer).getAllByRole('button', { hidden: true })).toHaveLength(8);
    await expect(within(drawer).getByText('Home')).toBeInTheDocument();
    await expect(within(drawer).getByText('Pet Businesses')).toBeInTheDocument();
    await expect(within(drawer).getByText('About us')).toBeInTheDocument();
    // The CTA renders as a <button>, not a link: it is given href="#" plus an
    // onClick, so BaseButton takes its button branch.
    const cta = within(drawer).getByText('Sign up');
    await expect(cta.closest('button')).toBeInTheDocument();
    // The trigger relabels rather than keeping one name for both states.
    await expect(canvas.getByLabelText('Close menu')).toBeInTheDocument();
  },
  parameters: {
    viewport: { options: MOBILE_VIEWPORT },
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The drawer that no snapshot contained: seven full-width route rows in a `gap-3` column, ' +
          'then the primary CTA with its own `mt-3`. The hamburger has rotated into a cross - its ' +
          'three lines are transformed rather than swapped for an icon - and its accessible name ' +
          'has flipped to "Close menu".',
      },
    },
  },
};

export const MobileMenuOpenSignedIn: Story = {
  name: 'Mobile (menu open, signed in)',
  globals: { viewport: { value: 'phone', isRotated: false } },
  beforeEach: withAuth(SIGNED_IN_USER, 'vet'),
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    await expect(within(drawer).getAllByRole('button', { hidden: true })).toHaveLength(8);
    // The CTA is the one row that changes with the session.
    await expect(within(drawer).getByText('Go to app')).toBeInTheDocument();
    await expect(within(drawer).queryByText('Sign up')).not.toBeInTheDocument();
  },
  parameters: {
    viewport: { options: MOBILE_VIEWPORT },
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The same drawer with a session in the store. The route rows are identical and only the ' +
          "last child changes, pointing at the role's default open screen - so this is the story " +
          'that proves the signed-in branch of the mobile CTA renders at all, rather than only the ' +
          'desktop one.',
      },
    },
  },
};
