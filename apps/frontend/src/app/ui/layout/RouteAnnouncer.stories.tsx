import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import RouteAnnouncer from './RouteAnnouncer';

const ANNOUNCER_SLOT_TEST_ID = 'route-announcer-slot';

/**
 * RouteAnnouncer takes no props and paints nothing visible - its whole output
 * is the text inside an sr-only live region. What actually drives it in the
 * app is Next.js writing a new <title> into <head> on every route change, so
 * this harness stands in for that: it shows the current document title and a
 * button that rewrites it by hand, then RouteAnnouncer's own MutationObserver
 * picks the change up exactly as it would in production.
 */
const Harness = () => {
  const [title, setTitle] = useState(() => document.title);

  const changeTitle = () => {
    const next =
      title === 'Companions - Yosemite Crew'
        ? 'Appointments - Yosemite Crew'
        : 'Companions - Yosemite Crew';
    document.title = next;
    setTitle(next);
  };

  return (
    <div className="grid max-w-[420px] gap-3 p-6">
      <p className="text-[13.5px]">
        Document title: <code>{title || '(none)'}</code>
      </p>
      <button
        type="button"
        onClick={changeTitle}
        className="w-fit rounded-full border border-[var(--hairline)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-body)]"
      >
        Simulate a route change
      </button>
      <p className="text-[12.5px] text-[var(--ink-muted)]">
        The region below is visually hidden by design (sr-only) - a screen reader hears it, a
        sighted reviewer never sees it. Its text is asserted in the play functions on these stories.
      </p>
      <div data-testid={ANNOUNCER_SLOT_TEST_ID}>
        <RouteAnnouncer />
      </div>
    </div>
  );
};

type TitleFixture = { title: string };

/** document.title is a global; a story that changes it must put it back. */
const withDocumentTitle =
  ({ title }: TitleFixture) =>
  () => {
    const previousTitle = document.title;
    document.title = title;
    return () => {
      document.title = previousTitle;
    };
  };

const meta = {
  title: 'Layout/RouteAnnouncer',
  component: RouteAnnouncer,
  parameters: {
    layout: 'centered',
    // `usePathname()`/`useSearchParams()` are called on every render, purely so
    // the component re-renders (and re-reads document.title) when the route
    // changes underneath it - it never reads their values.
    nextjs: { appDirectory: true, navigation: { pathname: '/dashboard' } },
    docs: {
      description: {
        component:
          'A screen-reader-only live region that announces client-side route changes. The Next.js ' +
          'App Router swaps page content without a full page load, so a screen reader user gets ' +
          'none of the load cues a normal navigation gives them - this component fills that gap. ' +
          'It watches document.head with a MutationObserver for the <title> Next writes on every ' +
          'navigation, and reads the result into an aria-live="polite" region as "<title> loaded", ' +
          'or "Page updated" while no title has been set yet. It takes no props, subscribes ' +
          'through useSyncExternalStore rather than an effect plus useState (so the first client ' +
          'render already has the right text, with no flash of the fallback), and renders nothing ' +
          'a sighted user would ever notice.',
      },
    },
  },
  tags: ['autodocs'],
  render: () => <Harness />,
} satisfies Meta<typeof RouteAnnouncer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Title already set',
  beforeEach: withDocumentTitle({ title: 'Appointments - Yosemite Crew' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId(ANNOUNCER_SLOT_TEST_ID)).toHaveTextContent(
      'Appointments - Yosemite Crew loaded'
    );
  },
};

export const NoTitleYet: Story = {
  name: 'No title set yet',
  beforeEach: withDocumentTitle({ title: '' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId(ANNOUNCER_SLOT_TEST_ID)).toHaveTextContent('Page updated');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The fallback text. This is what a reader hears on first paint before any page-level ' +
          '<title> effect has run, or on a page that never sets one.',
      },
    },
  },
};

export const WhitespaceOnlyTitle: Story = {
  name: 'Whitespace-only title also falls back',
  beforeEach: withDocumentTitle({ title: '   ' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // getAnnouncementText() trims before checking truthiness, so a title that is
    // only whitespace reads the same as no title at all rather than announcing
    // "   loaded".
    await expect(canvas.getByTestId(ANNOUNCER_SLOT_TEST_ID)).toHaveTextContent('Page updated');
  },
};

export const RouteChangeAnnouncesNewTitle: Story = {
  name: 'Route change updates the announcement',
  beforeEach: withDocumentTitle({ title: 'Appointments - Yosemite Crew' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId(ANNOUNCER_SLOT_TEST_ID)).toHaveTextContent(
      'Appointments - Yosemite Crew loaded'
    );

    await userEvent.click(canvas.getByRole('button', { name: 'Simulate a route change' }));

    // The MutationObserver callback fires asynchronously, so the announcer's
    // text lags one tick behind the title write.
    await waitFor(() =>
      expect(canvas.getByTestId(ANNOUNCER_SLOT_TEST_ID)).toHaveTextContent(
        'Companions - Yosemite Crew loaded'
      )
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The mechanic that matters: a new document title, which is what the App Router writes ' +
          'on navigation, reaches the live region without a remount - the whole component is ' +
          'subscribed to document.head rather than to the router.',
      },
    },
  },
};
