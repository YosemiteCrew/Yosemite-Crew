import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import NotADeveloperState from './NotADeveloperState';

const meta = {
  title: 'Layout/Guards/NotADeveloperState',
  component: NotADeveloperState,
  parameters: {
    layout: 'fullscreen',
    // `useRouter` from `next/navigation` throws "app router to be mounted"
    // without this - the component pushes on both of its actions.
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/home' } },
    docs: {
      description: {
        component:
          'Shown when a signed-in user reaches a developer route without the developer role. ' +
          'Deliberately not `PermissionDeniedState`: that one explains an org-membership problem ' +
          'an owner can fix in Organization > Team, which is the wrong advice here - the developer ' +
          'portal is a separate account type, so the way out is a developer account, not a role ' +
          'change. It is also a terminal state rather than a redirect, because bouncing back to ' +
          '`/developers/signin` while the session is still valid just invites the same sign-in to ' +
          'fail the same way.',
      },
    },
  },
  tags: ['autodocs'],
  args: { onSignOut: fn() },
} satisfies Meta<typeof NotADeveloperState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Signed in, but not a developer',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/isn.t a developer account/i)).toBeInTheDocument();

    /* Two ways out and neither is "try again": one creates the account type that
       would actually work, the other leaves. A retry here would loop. */
    await expect(
      canvas.getByRole('button', { name: 'Create a developer account' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Back to Yosemite Crew' })).toBeInTheDocument();
  },
};

export const SignsOutBeforeSigningUp: Story = {
  name: 'Creating an account signs the current one out first',
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Create a developer account' })
    );
    /* The sign-up form would otherwise open on top of a live session for a
       different account type, which is the state that produced this screen. */
    await expect(args.onSignOut).toHaveBeenCalledTimes(1);
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    // A terminal state is the whole screen on a phone, so its two actions have to
    // be reachable without a sideways scroll.
    const buttons = within(canvasElement).getAllByRole('button');
    for (const button of buttons) {
      await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
        globalThis.window.innerWidth
      );
    }
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
