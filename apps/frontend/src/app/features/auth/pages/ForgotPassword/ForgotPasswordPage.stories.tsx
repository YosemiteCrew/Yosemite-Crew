import type { Meta, StoryObj } from '@storybook/react';
import { redirect } from '@storybook/nextjs-vite/navigation.mock';
import { expect, within } from 'storybook/test';

import {
  getStorageItem,
  removeStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from '@/app/lib/browserStorage';
import { useAuthStore, type AuthUser } from '@/app/stores/authStore';
import ForgotPasswordPage from './ForgotPasswordPage';
/* Not decoration. `.yc-field`, `.yc-lbl`, `.yc-switch` and `.yc-btn-primary` live in
   marketing.css, which the (public) ROUTE LAYOUT imports rather than any component.
   Relative, matching ForgotPassword.stories.tsx. */
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

const OWNER: AuthUser = {
  userId: 'user-owner-1',
  email: 'lena.weber@sunrisevet.example',
  authProfile: null,
  loginMethod: 'emailpassword',
  emailVerified: true,
  getUsername: () => 'user-owner-1',
};

/**
 * Pins `user` and `role`, which are all this wrapper reads, and clears the saved
 * default-screen preference so the role decides the route. `redirect()` from the
 * App Router mock throws the real Next redirect error; for the story it is
 * re-implemented as a recorder, and Storybook's mock reset restores it after.
 */
const withSession = (user: AuthUser | null, role: string | null) => () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({ user, role, status: user ? 'authenticated' : 'unauthenticated' });
  const previousScreen = getStorageItem('local', 'yc_default_open_screen');
  removeStorageItem('local', 'yc_default_open_screen');
  redirect.mockImplementation(() => undefined as never);
  return () => {
    useAuthStore.setState({ user: snapshot.user, role: snapshot.role, status: snapshot.status });
    if (previousScreen !== null) {
      setStorageItem('local', 'yc_default_open_screen', previousScreen);
    }
  };
};

const meta = {
  title: 'Auth/ForgotPasswordPage',
  component: ForgotPasswordPage,
  parameters: {
    layout: 'fullscreen',
    surface: 'marketing',
    // The shell's logo, "Back to home" and "Sign in" are next/link, and the
    // wrapper calls `redirect()` at render.
    nextjs: { appDirectory: true, navigation: { pathname: '/forgot-password' } },
    docs: {
      description: {
        component:
          'The `/forgot-password` route page. Unlike `/signin` and `/signup` it does not use ' +
          '`AuthedRedirectShell`: it reads `user` and `role` straight from the auth store and, ' +
          'if a user is present, calls `redirect(resolveDefaultOpenScreenRoute(role))` during ' +
          'render - `/dashboard` for an owner, `/appointments` for everyone else, or whatever ' +
          'default screen the person saved in settings. It does not kick off a session check ' +
          'of its own, so a cold load with an `idle` store simply shows the form.\n\n' +
          'In the app `redirect()` throws and Next performs the navigation, so nothing below it ' +
          'renders. The App Router mock throws the same error, which would put an error ' +
          'boundary on the canvas; the signed-in stories re-implement it as a recorder for ' +
          'their run, and as a consequence the form renders beneath the (recorded) redirect. ' +
          'That form is an artefact of the mock, not something a signed-in visitor sees.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: () => {
    seedGithubStats();
  },
} satisfies Meta<typeof ForgotPasswordPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  name: 'Signed out',
  beforeEach: withSession(null, null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Work email' })).toHaveValue('');
    await expect(canvas.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
    await expect(canvas.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/signin'
    );
    await expect(redirect).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'No user in the store: the wrapper is transparent and the reset form renders exactly ' +
          'as in `Auth/ForgotPassword`.',
      },
    },
  },
};

export const SignedInOwner: Story = {
  name: 'Signed in as owner (redirects to dashboard)',
  beforeEach: withSession(OWNER, 'owner'),
  play: async () => {
    await expect(redirect).toHaveBeenCalledWith('/dashboard');
  },
  parameters: {
    docs: {
      description: {
        story:
          "An owner with a session. `redirect('/dashboard')` is called synchronously during " +
          'the first render, before anything is painted. The form visible here only exists ' +
          "because the story's recorder returns instead of throwing.",
      },
    },
  },
};

export const SignedInVet: Story = {
  name: 'Signed in as vet (redirects to appointments)',
  beforeEach: withSession(
    { ...OWNER, userId: 'user-vet-1', email: 'jonas.brandt@sunrisevet.example' },
    'vet'
  ),
  play: async () => {
    await expect(redirect).toHaveBeenCalledWith('/appointments');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Any non-owner role defaults to the appointments board. The saved default-screen ' +
          'preference would override this, which is why the story clears it first.',
      },
    },
  },
};
