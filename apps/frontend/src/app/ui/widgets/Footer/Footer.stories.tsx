import { PLATFORM_STATUS_API_URL } from '@/app/hooks/usePlatformStatus';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

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

export const DarkTheme: Story = {
  name: 'Compliance badges (dark)',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(document.documentElement.dataset.theme).toBe('dark');

    /* GDPR/ISO/FHIR are solid dark ink on a transparent PNG and the SOC 2 seal
       is AICPA's own near-black circle - all four disappear into the footer's
       own dark background without this filter. Asserting the computed style
       (not just that the <img> is present) is the point: a broken selector
       still renders four healthy-looking, invisible images. */
    const badges = [
      canvas.getAllByRole('img').find((img) => img.className.includes('gdpr-footer')),
      canvas.getAllByRole('img').find((img) => img.className.includes('soc-footer')),
      canvas.getAllByRole('img').find((img) => img.className.includes('iso-footer')),
      canvas.getAllByRole('img').find((img) => img.className.includes('fhir-footer')),
    ];
    for (const badge of badges) {
      await expect(badge).toBeDefined();
      await expect(getComputedStyle(badge as Element).filter).toContain('brightness');
    }

    // The FDA/21 CFR mark ships on its own opaque white plate already, so it
    // reads fine on either theme and must NOT get the same filter - that
    // would wash its black wordmark out against its own white background.
    const fda = canvas.getAllByRole('img').find((img) => img.className.includes('fda-footer'));
    await expect(getComputedStyle(fda as Element).filter).not.toContain('brightness');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The certification strip is the one part of the footer with real third-party marks in it, ' +
          "so this recolours the existing images (grayscale + brightness, the same filter AuthShell's " +
          'permanently-dark brand panel already uses for the identical problem) rather than swapping ' +
          'in a redrawn "dark" logo for anything AICPA/ISO/HL7 actually issued.',
      },
    },
  },
};
