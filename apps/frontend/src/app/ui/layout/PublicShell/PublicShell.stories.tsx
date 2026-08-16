import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import PublicShell from '.';
import { useAuthStore } from '../../../stores/authStore';

/**
 * The guest header fires `checkSession()` whenever the auth status is still
 * `idle`, which in Storybook means a doomed request to an API that is not there.
 * Parking the store on `unauthenticated` skips that call entirely and pins the
 * shell to the signed-out chrome these stories are about.
 */
const withSignedOutSession = () => {
  const { status, user, role } = useAuthStore.getState();
  useAuthStore.setState({ status: 'unauthenticated', user: null, role: null });
  return () => useAuthStore.setState({ status, user, role });
};

/** Registered on the story that needs it so the phone width survives a Chromatic run. */
const MOBILE_VIEWPORT = {
  mobile: {
    name: 'Mobile (375)',
    styles: { width: '375px', height: '812px' },
    type: 'mobile',
  },
};

const PageBody = () => (
  <section style={{ padding: '120px 24px 200px', maxWidth: 760, margin: '0 auto' }}>
    <h2 className="text-[34px] leading-[1.15] font-normal text-[var(--ink)]">
      Practice software your whole team actually likes
    </h2>
    <p className="mt-4 text-[15px] text-[var(--ink-muted)]">
      Placeholder route content. The shell owns everything around it — the sticky header, the
      public-page gutters, and the GitHub badge pinned to the bottom of the viewport.
    </p>
  </section>
);

const meta = {
  title: 'Layout/PublicShell',
  component: PublicShell,
  parameters: {
    layout: 'fullscreen',
    // The header and the GitHub badge both read the current route through
    // next/navigation, so the App Router mock has to be mounted.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
    docs: {
      description: {
        component:
          'The chrome wrapped around every marketing and auth route: the sticky guest header, the ' +
          '`.yc-public-page` content well that supplies the public gutters, and the "Star us on ' +
          'GitHub" badge. It is route-aware — the badge only shows on public paths and the header ' +
          'CTA flips between Sign in and Sign up — so each story sets a different pathname.',
      },
    },
  },
  beforeEach: withSignedOutSession,
  args: {
    children: <PageBody />,
  },
} satisfies Meta<typeof PublicShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The marketing home route. The header sits in its floating pill form until the page is ' +
          'scrolled past 60% of the viewport height, at which point it docks flush.',
      },
    },
  },
};

export const SignInRoute: Story = {
  name: 'Sign-in route',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/signin' } },
    docs: {
      description: {
        story:
          'On `/signin` the header offers Sign up instead, so the CTA never points at the page the ' +
          'visitor is already on.',
      },
    },
  },
};

export const NonPublicRoute: Story = {
  name: 'Non-public route',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/organizations' } },
    docs: {
      description: {
        story:
          'Routes outside the public set hide the GitHub badge, and `/organizations` also drops the ' +
          'auth buttons — mid-onboarding there is nowhere useful for them to lead.',
      },
    },
  },
};

export const Mobile: Story = {
  name: 'Mobile (hamburger)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    viewport: { options: MOBILE_VIEWPORT },
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below the `lg` breakpoint the nav collapses into the hamburger menu and the desktop CTA ' +
          'is replaced by the one inside the mobile sheet.',
      },
    },
  },
};
