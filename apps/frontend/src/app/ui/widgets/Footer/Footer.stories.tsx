import { PLATFORM_STATUS_API_URL } from '@/app/hooks/usePlatformStatus';
import type { Meta, StoryObj } from '@storybook/react';

import Footer from './Footer';

/**
 * The footer asks openstatus.dev for the platform status on mount and colours
 * the status pill from the answer. Left alone that makes every snapshot depend
 * on a third-party request, so the stories swap `fetch` for a canned reply and
 * put the real one back when the story unmounts.
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

const withFailingStatusFetch = () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith(PLATFORM_STATUS_API_URL)) {
      return Promise.reject(new Error('offline'));
    }
    return original.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
  };
};

const meta = {
  title: 'Widgets/Footer',
  component: Footer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The marketing site footer: brand mark, the compliance badge strip, a live platform-status ' +
          'pill, three link columns and the legal block. It reveals itself on scroll (framer-motion ' +
          '`useInView`, once) and the link columns stagger in behind it, so in Storybook it animates ' +
          'straight away because the canvas puts it in view immediately.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: withPlatformStatus('operational'),
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The everyday state - a green "All systems operational" pill under the badge
 * strip.
 */
export const Default: Story = {};

export const DegradedPlatform: Story = {
  name: 'Degraded platform status',
  beforeEach: withPlatformStatus('degraded_performance'),
  parameters: {
    docs: {
      description: {
        story:
          'The warning tone. Only the pill changes - dot colour, text colour and border - so this is ' +
          'the story to watch if the `platform-status-link-*` tones drift apart.',
      },
    },
  },
};

export const MajorOutage: Story = {
  name: 'Major outage',
  beforeEach: withPlatformStatus('major_outage'),
  parameters: {
    docs: {
      description: {
        story: 'The danger tone, shared by partial outage and any active incident.',
      },
    },
  },
};

export const StatusUnavailable: Story = {
  name: 'Status request failed',
  beforeEach: withFailingStatusFetch,
  parameters: {
    docs: {
      description: {
        story:
          'What renders when the status API is unreachable, which is also the first paint before the ' +
          'request resolves: a neutral "Status unavailable" pill rather than an empty gap or a ' +
          'misleading green.',
      },
    },
  },
};

export const Mobile: Story = {
  name: 'Mobile (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below the tablet breakpoint the link columns stack under the brand block and the legal ' +
          'copy centres. The badge strip is the part that struggles here - five fixed-width logos on ' +
          'a 375px canvas.',
      },
    },
  },
};
