import type { MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { stopRouteLoader } from '@/app/lib/routeLoader';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';
import RouteLoaderOverlay from './RouteLoaderOverlay';

const STATE_TEST_ID = 'route-loader-state';
const SLOT_TEST_ID = 'route-loader-slot';

const linkClass =
  'w-fit text-[13.5px] font-medium text-[var(--ink-body)] underline underline-offset-2';

/**
 * Every anchor here prevents its default: the overlay decides in the CAPTURE
 * phase on `document`, before any handler on the anchor runs, so the loader
 * still starts - and the preview iframe stays on this story instead of
 * navigating away.
 */
const stay = (event: MouseEvent<HTMLAnchorElement>) => {
  event.preventDefault();
};

/**
 * The overlay renders nothing and takes no props: its whole output is a write
 * to `routeLoaderStore`. The harness draws that store back out as text, offers
 * one link of every kind the click filter distinguishes, and mounts the overlay
 * inside a marked slot so a story can assert it really paints no DOM.
 */
const Harness = () => {
  const isLoading = useRouteLoaderStore((s) => s.isLoading);
  // Read at render, so the "same route" link points at the preview iframe's own
  // URL whatever story id and view mode it was opened with.
  const currentRoute = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;

  return (
    <div className="grid max-w-[560px] gap-5 p-6">
      <output
        data-testid={STATE_TEST_ID}
        className="w-fit rounded-full border border-[var(--hairline)] px-3 py-1 text-[12.5px] font-semibold"
        style={{
          background: isLoading ? 'var(--cta)' : 'var(--screen)',
          color: isLoading ? 'var(--cta-text)' : 'var(--ink-muted)',
        }}
      >
        {isLoading ? 'Route loader active' : 'Route loader idle'}
      </output>

      <nav aria-label="Sample links" className="grid gap-2">
        <a href="/companions" className={linkClass} onClick={stay}>
          Companions (internal route)
        </a>
        <a href="https://example.com/pricing" className={linkClass} onClick={stay}>
          External pricing page
        </a>
        <a href="/help" target="_blank" rel="noreferrer" className={linkClass} onClick={stay}>
          Help centre (opens a new tab)
        </a>
        <a href="/exports/invoices.csv" download className={linkClass} onClick={stay}>
          Download invoices (download attribute)
        </a>
        <a href="#billing" className={linkClass} onClick={stay}>
          Jump to billing (hash only)
        </a>
        <a href="/settings" data-no-route-loader="true" className={linkClass} onClick={stay}>
          Settings (opted out)
        </a>
        <a href="mailto:hello@yosemitecrew.example" className={linkClass} onClick={stay}>
          Email the practice (mailto)
        </a>
        <a href={currentRoute} className={linkClass} onClick={stay}>
          Reload this page (same route)
        </a>
      </nav>

      <button
        type="button"
        onClick={stopRouteLoader}
        className="w-fit rounded-full border border-[var(--hairline)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-body)]"
      >
        Release loader
      </button>

      <div data-testid={SLOT_TEST_ID}>
        <RouteLoaderOverlay />
      </div>
    </div>
  );
};

/** Both stores are module singletons; a loader left running would leak into the next story. */
const withIdleStores = () => {
  useRouteLoaderStore.setState({ isLoading: false });
  return () => {
    useRouteLoaderStore.setState({ isLoading: false });
    useFullscreenLoaderStore.getState().hide('org-switch');
  };
};

const meta = {
  title: 'Layout/RouteLoaderOverlay',
  component: RouteLoaderOverlay,
  parameters: {
    layout: 'fullscreen',
    // `usePathname` and `useSearchParams` are read on every render.
    nextjs: { appDirectory: true, navigation: { pathname: '/dashboard' } },
    docs: {
      description: {
        component:
          'The listener that starts the route loader the moment a same-origin link is clicked, ' +
          'so the fullscreen wash appears before Next has even begun the navigation. It returns ' +
          '`null` always: what it owns is a capture-phase click listener on `document` and three ' +
          'effects, and none of them paint.\n\n' +
          'The click filter is the part worth reviewing because every rule in it was added for a ' +
          'real regression. It ignores modified clicks (new tab, new window), non-primary ' +
          'buttons, anchors with a `target` other than `_self`, `download` links, bare `#` hashes, ' +
          'non-http(s) protocols such as `mailto:`, anything cross-origin, an anchor marked ' +
          '`data-no-route-loader="true"`, and a link to the route already on screen - that last ' +
          'one because a loader started for a navigation that never happens has nothing to stop it.\n\n' +
          'Stopping is the other half: the loader is released when `pathname` or the query string ' +
          'changes (which also hides the `org-switch` fullscreen source), and by a 15 second ' +
          'safety timeout in case a navigation is cancelled. Neither can be driven from inside ' +
          'one story, since the router mock never changes its pathname, so they are documented ' +
          'here and exercised by the unit tests.',
      },
    },
  },
  tags: ['autodocs'],
  render: () => <Harness />,
  beforeEach: withIdleStores,
} satisfies Meta<typeof RouteLoaderOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  name: 'Idle (renders nothing)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId(STATE_TEST_ID)).toHaveTextContent('Route loader idle');
    // Not hidden, not empty-but-present: no DOM at all.
    await expect(canvas.getByTestId(SLOT_TEST_ID).childElementCount).toBe(0);
    await expect(useRouteLoaderStore.getState().isLoading).toBe(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state, which is also the only visual state. Everything the component does ' +
          'shows up in the store readout above the links.',
      },
    },
  },
};

export const InternalNavigation: Story = {
  name: 'Internal link starts the loader',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Companions (internal route)' }));
    await expect(canvas.getByTestId(STATE_TEST_ID)).toHaveTextContent('Route loader active');
    await expect(useRouteLoaderStore.getState().isLoading).toBe(true);

    // What a pathname change does in the app, done here by hand.
    await userEvent.click(canvas.getByRole('button', { name: 'Release loader' }));
    await expect(canvas.getByTestId(STATE_TEST_ID)).toHaveTextContent('Route loader idle');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A plain same-origin link to another route. The store flips on the click itself, which ' +
          'is what lets `GlobalFullscreenLoaderOverlay` paint before the new route has fetched ' +
          'anything.',
      },
    },
  },
};

export const IgnoredLinks: Story = {
  name: 'Links the filter ignores',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ignored = [
      'External pricing page',
      'Help centre (opens a new tab)',
      'Download invoices (download attribute)',
      'Jump to billing (hash only)',
      'Settings (opted out)',
      'Email the practice (mailto)',
      'Reload this page (same route)',
    ];
    for (const name of ignored) {
      await userEvent.click(canvas.getByRole('link', { name }));
      await expect(canvas.getByTestId(STATE_TEST_ID)).toHaveTextContent('Route loader idle');
    }
    await expect(useRouteLoaderStore.getState().isLoading).toBe(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Seven clicks, no loader. Cross-origin, new-tab, download, hash-only, opted-out, ' +
          '`mailto:` and same-route links are each a navigation the App Router will not perform, ' +
          'so starting a loader for them would leave the wash on screen until the 15 second ' +
          'timeout gave up.',
      },
    },
  },
};

export const ModifiedClick: Story = {
  name: 'Modified click is ignored',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'Companions (internal route)' });

    /* ONE session, not the bare `userEvent.click` helper. Each call of the
       direct API sets up its own instance with fresh keyboard state, so a
       modifier held by a separate `userEvent.keyboard('{Meta>}')` is simply not
       applied to the click that follows - the event arrives with `metaKey`
       false and the loader starts, which is what this story caught. */
    const user = userEvent.setup();

    // Cmd-click and shift-click open the route elsewhere; this document stays put.
    await user.keyboard('{Meta>}');
    await user.click(link);
    await user.keyboard('{/Meta}');
    await expect(canvas.getByTestId(STATE_TEST_ID)).toHaveTextContent('Route loader idle');

    await user.keyboard('{Shift>}');
    await user.click(link);
    await user.keyboard('{/Shift}');
    await expect(canvas.getByTestId(STATE_TEST_ID)).toHaveTextContent('Route loader idle');

    // The same link, unmodified, still counts.
    await user.click(link);
    await expect(canvas.getByTestId(STATE_TEST_ID)).toHaveTextContent('Route loader active');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same internal link with a modifier held. Meta, ctrl, shift and alt clicks are ' +
          'browser affordances for opening a link somewhere else, and the page the reader is on ' +
          'does not navigate, so the loader must not start.',
      },
    },
  },
};
