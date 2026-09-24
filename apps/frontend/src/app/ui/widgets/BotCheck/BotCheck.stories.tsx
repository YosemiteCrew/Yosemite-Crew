import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, waitFor, within } from 'storybook/test';
import { BotCheck, TURNSTILE_UNAVAILABLE_ERROR } from './BotCheck';

const STORY_TOKEN = 'storybook-test-token';

/** A stand-in widget, so the story never depends on the real challenge loading. */
const installTurnstileStub = () => {
  const storyWindow = globalThis.window as Window & { turnstile?: unknown };
  const previous = storyWindow.turnstile;
  storyWindow.turnstile = {
    render: (container: HTMLElement, options: { callback: (token: string) => void }) => {
      container.textContent = 'Verification widget';
      options.callback(STORY_TOKEN);
      return 'storybook-widget';
    },
    reset: () => undefined,
    remove: () => undefined,
  };
  return () => {
    storyWindow.turnstile = previous;
  };
};

const meta = {
  title: 'Widgets/BotCheck',
  component: BotCheck,
  args: {
    siteKey: 'storybook-test-site-key',
    action: 'contact_form',
    resetCounter: 0,
    onTokenChange: fn(),
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Cloudflare Turnstile widget shared by sign-up and the contact forms. It reports each ' +
          'token through `onTokenChange`, and resets when `resetCounter` moves, because a token ' +
          'can be used only once. Stories use a stand-in widget.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: installTurnstileStub,
} satisfies Meta<typeof BotCheck>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await waitFor(() => expect(args.onTokenChange).toHaveBeenCalledWith(STORY_TOKEN));
    await expect(within(canvasElement).getByText('Verification widget')).toBeInTheDocument();
  },
};

export const WithError: Story = {
  args: { error: 'Complete bot verification before sending your message.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Complete bot verification before sending your message.'
    );
  },
};

export const NoSiteKey: Story = {
  args: { siteKey: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      TURNSTILE_UNAVAILABLE_ERROR
    );
  },
};
