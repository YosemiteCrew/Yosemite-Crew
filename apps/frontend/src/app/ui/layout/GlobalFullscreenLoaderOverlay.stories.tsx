import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';
import GlobalFullscreenLoaderOverlay from './GlobalFullscreenLoaderOverlay';

const LOADER_TEST_ID = 'global-fullscreen-loader';

type HarnessProps = {
  /** Seeds `routeLoaderStore.isLoading` - the navigation half of the gate. */
  routeLoading: boolean;
  /** Seeds `fullscreenLoaderStore.activeSources` - the blocking-work half. */
  blockingSources: string[];
};

/**
 * The overlay takes no props: it reads two zustand stores and returns `null`
 * unless one of them is active, so there is no way to render it from args
 * alone. The harness seeds both stores on mount and clears them on unmount, and
 * carries a button that calls `show()` the way real blocking work does - so one
 * story can reach the overlay through an interaction rather than a fixture.
 */
const LoaderHarness = ({ routeLoading, blockingSources }: HarnessProps) => {
  useEffect(() => {
    useRouteLoaderStore.setState({ isLoading: routeLoading });
    useFullscreenLoaderStore.setState({
      activeSources: Object.fromEntries(blockingSources.map((source) => [source, true] as const)),
    });
    // Never leak state into the next story: both stores are module singletons.
    return () => {
      useRouteLoaderStore.setState({ isLoading: false });
      useFullscreenLoaderStore.setState({ activeSources: {} });
    };
  }, [routeLoading, blockingSources]);

  return (
    <div className="flex min-h-[420px] flex-col gap-4 p-6">
      <h2 className="text-yc-20-b-primary">Page content behind the overlay</h2>
      <p className="max-w-[520px] text-body-4 text-text-secondary">
        The overlay is translucent and blurred rather than opaque, so whatever it covers stays
        legible underneath. Text and controls are here specifically so that blur has something to
        act on.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full border border-card-border px-4 py-2 text-body-4 text-text-primary"
          onClick={() => useFullscreenLoaderStore.getState().show('storybook-action')}
        >
          Start blocking action
        </button>
        <button
          type="button"
          className="rounded-full border border-card-border px-4 py-2 text-body-4 text-text-primary"
          onClick={() => useFullscreenLoaderStore.getState().hide('storybook-action')}
        >
          Finish blocking action
        </button>
      </div>
      <GlobalFullscreenLoaderOverlay />
    </div>
  );
};

const meta = {
  title: 'Layout/GlobalFullscreenLoaderOverlay',
  component: LoaderHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The app-wide blocking loader. It is mounted permanently in the shell and spends almost ' +
          'all of its life returning `null`: it renders only when `routeLoaderStore.isLoading` is ' +
          'true **or** `fullscreenLoaderStore.activeSources` holds at least one key. Both are ' +
          'zustand singletons written by navigation and by long-running actions, so the visible ' +
          'state exists for a second or two at a time and had never been captured anywhere.\n\n' +
          'That matters more than a spinner usually would, because of what the visible state does: ' +
          "`YosemiteLoader`'s `fullscreen-translucent` variant is `position: fixed; inset: 0` at " +
          '`z-index: 9999` with `background: var(--glass-93)` and an 8px backdrop blur. It is a ' +
          'full-viewport input trap. If the gate ever inverted - or a source were shown and never ' +
          'hidden - the app would look fine in every snapshot and be completely unusable, because ' +
          'nothing about `return null` shows up in a screenshot of the resting state.\n\n' +
          'The two halves of the gate are independent and both matter: route loading clears itself ' +
          'on navigation, while `activeSources` is ref-counted by key, so an overlay stays up until ' +
          'every source that called `show()` has called `hide()`. A story that seeds two sources ' +
          'and releases one is the only way to see that the overlay correctly stays.\n\n' +
          'The component takes no props, so these stories drive it through a harness that writes ' +
          'the stores directly and clears them on unmount - and one story reaches it purely by ' +
          'clicking, through the same `show()` call the app uses.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    routeLoading: false,
    blockingSources: [],
  },
} satisfies Meta<typeof LoaderHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  name: 'Idle (renders nothing)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId(LOADER_TEST_ID)).not.toBeInTheDocument();
    // The page underneath must stay interactive - no invisible full-viewport shell.
    await expect(canvas.getByRole('button', { name: 'Start blocking action' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both stores idle. The assertion is the point: the overlay must render *nothing*, not an ' +
          'empty transparent `inset-0` element, or it would silently eat every click on the page.',
      },
    },
  },
};

export const RouteLoading: Story = {
  name: 'Route navigation',
  args: { routeLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loader = await canvas.findByTestId(LOADER_TEST_ID);
    await expect(loader).toHaveAccessibleName('Loading');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The half driven by navigation. The full-viewport translucent wash over real page content ' +
          'is the whole surface - and the only place to judge whether `--glass-93` plus an 8px blur ' +
          'reads as "busy" rather than as "broken", in either theme.',
      },
    },
  },
};

export const BlockingAction: Story = {
  name: 'Blocking action (one source)',
  args: { blockingSources: ['invoice-finalize'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId(LOADER_TEST_ID)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The other half of the gate, driven by a named source rather than by routing. Visually ' +
          'identical to route loading on purpose - the user should not be told which subsystem is ' +
          'busy.',
      },
    },
  },
};

export const ShownByInteraction: Story = {
  name: 'Raised by a click',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId(LOADER_TEST_ID)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Start blocking action' }));
    // Reached through the same store call the app makes, not by seeding a fixture.
    await expect(await canvas.findByTestId(LOADER_TEST_ID)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gate opened the way the app opens it: `fullscreenLoaderStore.show(source)`. This is ' +
          'the transition itself - resting page, then a full-viewport blocking wash - which no ' +
          'static story can contain.',
      },
    },
  },
};

export const RefCountedSources: Story = {
  name: 'Two sources, one released',
  args: { blockingSources: ['workspace-bootstrap', 'storybook-action'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId(LOADER_TEST_ID)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Finish blocking action' }));
    // One source released, one still held: the overlay must stay up.
    await expect(canvas.getByTestId(LOADER_TEST_ID)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two concurrent sources, one of them released mid-story. Because `activeSources` is keyed ' +
          'rather than counted with a boolean, the overlay correctly stays up for the remaining ' +
          'source - the failure mode being a shared flag that the first `hide()` clears, dropping ' +
          'the block while work is still running.',
      },
    },
  },
};
