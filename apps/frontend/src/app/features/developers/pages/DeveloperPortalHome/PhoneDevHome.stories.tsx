import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import PhoneDevHome from './PhoneDevHome';
import type { ActivityEntry } from './DeveloperPortalHome';

/**
 * The status pill asks openstatus.dev on mount, so without a stub every story
 * here would depend on a third-party request and settle on "Status unavailable"
 * in CI. Same shape as the Footer stories: swap `fetch`, put the real one back
 * on unmount.
 */
const withPlatformStatus = (status: string) => () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('openstatus.dev')) {
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

const ACTIVITY: ActivityEntry[] = [
  { method: 'GET', path: '/v1/appointments?date=2026-07-15', status: '200', ok: true },
  { method: 'POST', path: '/v1/companions', status: '201', ok: true },
  { method: 'GET', path: '/v1/inventory/products', status: '200', ok: true },
  { method: 'POST', path: '/v1/webhooks/test', status: '422', ok: false },
  { method: 'GET', path: '/v1/practitioners/me', status: '200', ok: true },
];

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
          'The bespoke phone layout for the developer home. It is presentation only - the display ' +
          'name and the recent-request log are the same data the desktop layout renders, so there ' +
          'is one source of truth for the log rather than a phone copy that can drift. It also ' +
          'says plainly which part of the portal a phone cannot do, instead of shipping a builder ' +
          'that does not work at this width.',
      },
    },
  },
  tags: ['autodocs'],
  args: { displayName: 'Ravi Patel', recentActivity: ACTIVITY },
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
    await expect(canvas.getByRole('link', { name: /Plugins/ })).toHaveAttribute(
      'href',
      '/developers/plugins'
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
      if (String(input).includes('openstatus.dev')) return Promise.reject(new Error('offline'));
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

export const FailedRequestsInTheLog: Story = {
  name: 'A 4xx in the request log',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const failed = canvas.getByText('422');
    // The failing row is distinguished by a class, not only by the number, so the
    // status colour survives the log being scanned rather than read.
    await expect(failed).toHaveClass('err');
    // The other four rows succeeded, three of them with a 200.
    await expect(canvas.getAllByText('200')).toHaveLength(3);
    for (const ok of canvas.getAllByText('200')) await expect(ok).toHaveClass('ok');
  },
};

export const EmptyLog: Story = {
  name: 'No requests yet',
  args: { recentActivity: [] },
  play: async ({ canvasElement }) => {
    // The rest of the page still renders: a new integration with no traffic is the
    // normal first-run state, not an error.
    await expect(within(canvasElement).getByText('Recent requests')).toBeInTheDocument();
    await expect(within(canvasElement).getByRole('link', { name: /API keys/ })).toBeInTheDocument();
  },
};

export const LongPathsAndNames: Story = {
  name: 'Long name and long paths stay inside the screen',
  args: {
    displayName: 'Konstantina Papadopoulou-Lindqvist',
    recentActivity: [
      {
        method: 'GET',
        path: '/v1/appointments?from=2026-07-01&to=2026-07-31&practitioner=prac-amara-weber&include=patient,room',
        status: '200',
        ok: true,
      },
      ...ACTIVITY,
    ],
  },
  play: async () => {
    /* The request log is the one place a phone layout meets arbitrary-length
       strings it does not control, so this is where a missing truncation shows up
       as a sideways-scrolling page. */
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
