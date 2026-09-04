import { PLATFORM_STATUS_API_URL } from '@/app/hooks/usePlatformStatus';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import PhoneDevHome from './PhoneDevHome';

/**
 * The status pill asks openstatus.dev on mount, so without a stub every story
 * here would depend on a third-party request and settle on "Status unavailable"
 * in CI. Same shape as the Footer stories: swap `fetch`, put the real one back
 * on unmount.
 */
const withPlatformStatus = (status: string) => () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith(PLATFORM_STATUS_API_URL)) {
      return Promise.resolve(
        new Response(JSON.stringify({ status }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return original.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
  };
};

/** The layout is phone-only; a desktop-width canvas stretches the two nav tiles. */
const Phone = (Story: React.ComponentType) => (
  <div className="mx-auto w-[375px] bg-[var(--screen)]">
    <Story />
  </div>
);

const meta = {
  title: 'Developers/PhoneDevHome',
  component: PhoneDevHome,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The bespoke phone layout for the developer home. Presentation only, over the live ' +
          'display name and the live platform-status pill. It carries no request log, plugin ' +
          'card or throughput figures: nothing in the platform records any of those, and the ' +
          'fixed strings that used to stand in for them disagreed with the real usage the ' +
          'Billing page reports. It also says plainly which part of the portal a phone cannot ' +
          'do, instead of shipping a builder that does not work at this width.',
      },
    },
  },
  tags: ['autodocs'],
  args: { displayName: 'Ravi Patel' },
  beforeEach: withPlatformStatus('operational'),
  decorators: [Phone],
} satisfies Meta<typeof PhoneDevHome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Everything operational',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('All systems operational')).toBeInTheDocument());

    // The two nav tiles are links, not buttons - they navigate, so they have to
    // be openable in a new tab and readable by a screen reader as destinations.
    await expect(canvas.getByRole('link', { name: /API keys/ })).toHaveAttribute(
      'href',
      '/developers/api-keys'
    );
    await expect(canvas.getByRole('link', { name: /Billing/ })).toHaveAttribute(
      'href',
      '/developers/billing'
    );
  },
};

export const DegradedPlatform: Story = {
  name: 'Degraded performance',
  beforeEach: withPlatformStatus('degraded_performance'),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByText('Degraded performance')).toBeInTheDocument()
    );
  },
};

export const StatusUnreachable: Story = {
  name: 'The status API is unreachable',
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith(PLATFORM_STATUS_API_URL))
        return Promise.reject(new Error('offline'));
      return original.call(globalThis, input, init);
    }) as typeof globalThis.fetch;
    return () => {
      globalThis.fetch = original;
    };
  },
  play: async ({ canvasElement }) => {
    /* "Status unavailable", never a green "all systems operational" we have not
       verified - the pill degrades rather than guessing. */
    await waitFor(() =>
      expect(within(canvasElement).getByText('Status unavailable')).toBeInTheDocument()
    );
  },
};

export const NoInventedFigures: Story = {
  name: 'States no throughput it cannot measure',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // These were fixed strings, and the request count did not even agree with
    // the desktop card's. Nothing measures any of them.
    await expect(canvas.queryByText('Requests · 24h')).not.toBeInTheDocument();
    await expect(canvas.queryByText('P95')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Errors')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Recent requests')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Anesthesia monitor sync')).not.toBeInTheDocument();
  },
};

export const LongDisplayName: Story = {
  name: 'A long name stays inside the screen',
  args: { displayName: 'Konstantina Papadopoulou-Lindqvist' },
  play: async () => {
    /* The greeting is the one place this layout meets an arbitrary-length string
       it does not control, so this is where a missing truncation shows up as a
       sideways-scrolling page. */
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
