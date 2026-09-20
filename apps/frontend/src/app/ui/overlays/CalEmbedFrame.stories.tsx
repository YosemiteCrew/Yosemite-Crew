import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import CalEmbedFrame from './CalEmbedFrame';

const DEMO_URL =
  'https://app.cal.com/yosemitecrew/demo/embed?theme=light&layout=month_view&embedType=inline&embed=30min';
const ONBOARDING_URL =
  'https://app.cal.com/yosemitecrew/onboarding/embed?theme=light&layout=month_view&embedType=inline&embed=30min';

type CalCall = [string, ...unknown[]];
type InlineOptions = {
  elementOrSelector: HTMLElement;
  calLink: string;
  config: { theme: string; layout: string };
};
type CalNamespace = ((...args: CalCall) => void) & { q: unknown[] };
type CalGlobal = ((...args: CalCall) => void) & {
  loaded: boolean;
  ns: Record<string, CalNamespace>;
  q: unknown[];
};

/** Every call the component made to the namespaced Cal API, in order. */
const calls: CalCall[] = [];

/**
 * What the stub draws where the real embed would mount its iframe: a dashed
 * panel in the warm-bone tokens naming the link and layout it was asked for.
 */
const paint = (container: HTMLElement, options: InlineOptions) => {
  const panel = document.createElement('div');
  panel.dataset.calStub = 'true';
  panel.dataset.calStubLink = options.calLink;
  panel.setAttribute(
    'style',
    'height:100%;min-height:inherit;display:grid;place-items:center;align-content:center;gap:6px;' +
      'border:1px dashed var(--hairline);border-radius:16px;background:var(--screen);' +
      'color:var(--ink-muted);font-size:13px;text-align:center;padding:24px;'
  );
  const title = document.createElement('strong');
  title.style.color = 'var(--ink)';
  title.textContent = 'Cal.com embed (stubbed for Storybook)';
  const detail = document.createElement('span');
  detail.textContent = `${options.calLink} · ${options.config.layout} · ${options.config.theme} theme`;
  panel.append(title, detail);
  container.replaceChildren(panel);
};

const makeNamespace = (): CalNamespace => {
  const namespace = ((...args: CalCall) => {
    calls.push(args);
    if (args[0] === 'inline')
      paint((args[1] as InlineOptions).elementOrSelector, args[1] as InlineOptions);
  }) as CalNamespace;
  namespace.q = [];
  return namespace;
};

/**
 * `getCalApi` runs Cal's loader snippet, which does `window.Cal = window.Cal || …`
 * and injects `https://app.cal.com/embed/embed.js` the first time the global is
 * called. That script tag is a subresource, so the preview's offline guard
 * cannot intercept it. Installing a pre-loaded `window.Cal` first means the
 * snippet keeps ours, never appends the script, and hands the component a
 * namespace we control. The previous global goes back on unmount, so the
 * booking-overlay stories that let the real snippet run are unaffected.
 */
const withStubbedCal = () => {
  calls.length = 0;
  const target = globalThis as typeof globalThis & { Cal?: unknown };
  const previous = target.Cal;
  const stub = ((...args: CalCall) => {
    const namespace = args[1];
    if (args[0] === 'init' && typeof namespace === 'string') {
      stub.ns[namespace] ??= makeNamespace();
      return;
    }
    calls.push(args);
  }) as CalGlobal;
  stub.loaded = true;
  stub.ns = {};
  stub.q = [];
  target.Cal = stub;
  return () => {
    if (previous === undefined) {
      delete target.Cal;
    } else {
      target.Cal = previous;
    }
  };
};

const findStub = (frame: HTMLElement) =>
  waitFor(() => {
    const panel = frame.querySelector<HTMLElement>('[data-cal-stub="true"]');
    if (!panel) throw new Error('embed not mounted yet');
    return panel;
  });

const meta = {
  title: 'Overlays/CalEmbedFrame',
  component: CalEmbedFrame,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The container the Cal.com scheduler is mounted into, behind "Book a demo" on the ' +
          'public site, the onboarding "book a call" page and the dashboard booking overlay. ' +
          'It renders one `<div>` labelled by `title` and, in an effect, asks the Cal embed API ' +
          'for the `30min` namespace, sets the UI to the month view, and mounts the calendar ' +
          'inline for `calLink` with a light theme. The URL it will load is advertised on ' +
          '`data-cal-embed-src` before any script runs, which is what the tests and the overlay ' +
          'stories assert against. On unmount, and whenever `calLink` changes, the container is ' +
          'emptied so a stale calendar is never left behind.\n\n' +
          'The real embed is a third-party script and an iframe from app.cal.com. These stories ' +
          'install a stand-in `window.Cal` before the component mounts, so the loader snippet ' +
          'never injects the script and the container is filled by a stub that records every ' +
          'call it receives. What is under review is the container itself and the exact ' +
          'configuration handed to Cal; the calendar pixels belong to Cal.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    calLink: { control: 'radio', options: ['yosemitecrew/demo', 'yosemitecrew/onboarding'] },
  },
  args: {
    calLink: 'yosemitecrew/demo',
    title: 'Book a demo',
    className: 'h-[520px] w-full border-0',
  },
  beforeEach: withStubbedCal,
} satisfies Meta<typeof CalEmbedFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Demo: Story = {
  name: 'Book a demo',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByLabelText('Book a demo');
    await expect(frame).toHaveAttribute('data-cal-embed-frame', 'true');
    await expect(frame).toHaveAttribute('data-cal-embed-src', DEMO_URL);

    const panel = await findStub(frame);
    await expect(panel).toHaveAttribute('data-cal-stub-link', 'yosemitecrew/demo');

    // UI first, then the inline mount, both on the `30min` namespace.
    await expect(calls.map((call) => call[0])).toEqual(['ui', 'inline']);
    await expect(calls[0][1]).toEqual({ hideEventTypeDetails: false, layout: 'month_view' });
    const inline = calls[1][1] as InlineOptions;
    await expect(inline.elementOrSelector).toBe(frame);
    await expect(inline.calLink).toBe('yosemitecrew/demo');
    await expect(inline.config).toEqual({ theme: 'light', layout: 'month_view' });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The public-site demo booking, at a fixed 520px so the container has a height of its ' +
          'own; the default `flex-1` class relies on a flex parent. The stub panel shows what Cal ' +
          'was asked to mount.',
      },
    },
  },
};

export const Onboarding: Story = {
  name: 'Book onboarding call',
  args: {
    calLink: 'yosemitecrew/onboarding',
    title: 'Book onboarding call',
    className: 'min-h-[520px] w-full border-0',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByLabelText('Book onboarding call');
    await expect(frame).toHaveAttribute('data-cal-embed-src', ONBOARDING_URL);
    const panel = await findStub(frame);
    await expect(panel).toHaveAttribute('data-cal-stub-link', 'yosemitecrew/onboarding');
    await expect((calls[1][1] as InlineOptions).calLink).toBe('yosemitecrew/onboarding');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The onboarding link, sized the way the book-onboarding page sizes it (a viewport-tall ' +
          'minimum). Same namespace, same layout, different event type.',
      },
    },
  },
};
