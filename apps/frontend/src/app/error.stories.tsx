import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import GlobalError from './error';

const meta = {
  title: 'Layout/GlobalError',
  component: GlobalError,
  parameters: {
    layout: 'fullscreen',
    // The primary action is a next/link, which wants the App Router mock mounted.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "Next.js's root error boundary (`app/error.tsx`) - what a user sees when an " +
          'unhandled render error escapes the whole app. Uses the same warm-bone state-card ' +
          'language as NotFoundState and PermissionDeniedState rather than a generic panel, ' +
          'and always logs the caught error to the console for diagnosis.',
      },
    },
  },
  args: {
    error: Object.assign(new Error('Simulated render error'), { digest: 'story-digest' }),
    reset: fn(),
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GlobalError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Something went wrong')).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'An unexpected error occurred. If this keeps happening, please contact support.'
      )
    ).toBeInTheDocument();

    await expect(canvas.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );

    await expect(args.reset).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(args.reset).toHaveBeenCalledTimes(1);
  },
};
