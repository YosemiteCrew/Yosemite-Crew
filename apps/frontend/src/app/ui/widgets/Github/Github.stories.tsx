import type { Meta, StoryObj } from '@storybook/react';

import { removeStorageItem, setJsonStorageItem } from '@/app/lib/browserStorage';
import Github from './Github';

const CACHE_KEY = 'gh:stars:YosemiteCrew/Yosemite-Crew';

type StubbedResponse = number | 'unavailable' | 'pending';

/**
 * The banner reads a cached star count out of localStorage on its first render and
 * then refreshes it from api.github.com once the page goes idle. Both are stubbed
 * here: seeding the cache makes the rendered figure deterministic, and replacing
 * `fetch` keeps the story - and the Chromatic snapshot - off the network entirely.
 * Everything is restored when the story unmounts.
 */
const withStubbedStars = (cached: number | null, response: StubbedResponse) => () => {
  const realFetch = globalThis.fetch;

  if (cached === null) {
    removeStorageItem('local', CACHE_KEY);
  } else {
    setJsonStorageItem('local', CACHE_KEY, { value: cached, ts: Date.now() });
  }

  // Only the GitHub call is intercepted - anything else the preview iframe asks
  // for still goes through the real implementation.
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (!url.includes('api.github.com')) return realFetch(input, init);
    if (response === 'pending') return new Promise<Response>(() => {});
    if (response === 'unavailable') {
      return Promise.resolve({ ok: false, status: 403 } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: response }),
    } as unknown as Response);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = realFetch;
    removeStorageItem('local', CACHE_KEY);
  };
};

const meta = {
  title: 'Widgets/Github',
  component: Github,
  parameters: {
    layout: 'fullscreen',
    // The banner only shows itself on the public marketing routes, so the App
    // Router mock has to report one or the story renders an empty canvas.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
    docs: {
      description: {
        component:
          'The dismissible "Star us on Github" banner pinned to the bottom of the public marketing ' +
          'pages. A dark `--color-text-primary` pill holds the prompt, a white chip with the repo star ' +
          'count, and a close button. The count comes from the GitHub API but is cached in ' +
          'localStorage for an hour and read synchronously on first render, so a returning visitor ' +
          'never sees the placeholder. The banner hides itself on every non-public route.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 200, background: 'var(--page)' }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: withStubbedStars(2480, 2480),
} satisfies Meta<typeof Github>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Cached star count',
  parameters: {
    docs: {
      description: {
        story:
          'The normal state: a warm cache means the compact-formatted count ("2.5K") is on screen from ' +
          'the very first paint, with no placeholder flash.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'First visit (no cache)',
  beforeEach: withStubbedStars(null, 'pending'),
  parameters: {
    docs: {
      description: {
        story:
          'A cold cache on a first visit. The chip holds an ellipsis until the deferred request lands. ' +
          'The pill is sized by its label, not by the count, so resolving the number does not reflow ' +
          'the banner.',
      },
    },
  },
};

export const Unavailable: Story = {
  name: 'API unavailable',
  beforeEach: withStubbedStars(null, 'unavailable'),
  parameters: {
    docs: {
      description: {
        story:
          'Rate-limited or offline, with nothing cached to fall back on: the count degrades to an em ' +
          'dash rather than disappearing, so the chip keeps its shape and the link still works.',
      },
    },
  },
};
