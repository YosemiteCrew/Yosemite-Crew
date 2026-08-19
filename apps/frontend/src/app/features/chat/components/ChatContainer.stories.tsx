import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import { formatDisplayDate } from '@/app/lib/date';
import { ChatClosedFooter, ChatEmptyThread } from './ChatContainer';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Timestamps are built from `Date.now()` at module load, not written as literals.
 *
 * `formatClosedTime` compares against the clock at render, so a fixed ISO string
 * would drift from "3 hours ago" to "2 days ago" to a formatted date as the file
 * aged - the story would keep passing while quietly showing a different branch of
 * the formatter every week.
 */
const AGO = (ms: number) => new Date(Date.now() - ms).toISOString();
const LONG_AGO_MS = 40 * DAY_MS;

const meta = {
  title: 'Chat/ChatContainer',
  component: ChatClosedFooter,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Two terminal states of the chat window that no Storybook could reach, because both ' +
          'are chosen by live Stream channel data rather than by a prop.\n\n' +
          '`ChatClosedFooter` **replaces** the typing indicator and the composer - it is the ' +
          'other arm of a ternary, not an overlay on top of them - the moment ' +
          '`channelState.frozen` is true or the linked appointment reports status `ended`. ' +
          'Reaching it in a running app means freezing a real channel or ending a real ' +
          'appointment, which is why the state that removes the entire message input had never ' +
          'been drawn.\n\n' +
          '`ChatEmptyThread` is wired in as the `Channel` component’s `EmptyStateIndicator`, ' +
          'so it renders only when a real, watched channel happens to hold zero messages. It is ' +
          'exported here for the same reason.\n\n' +
          'The timestamp under "Chat session closed" is `formatClosedTime`, a four-branch ' +
          'relative formatter that falls back to an absolute date past seven days - and it ' +
          'returns an empty string when the channel carries neither a `closedAt` nor an ' +
          '`updatedAt`, which drops the line entirely rather than showing a placeholder. All ' +
          'four branches plus the empty one are below.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="flex min-h-[220px] flex-col justify-end bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatClosedFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The footer's own box, hoisted so no DOM read happens inside a `waitFor` body. */
const footerOf = (canvasElement: HTMLElement): HTMLElement => {
  const el = canvasElement.querySelector('div.flex.shrink-0');
  if (!el) throw new Error('The closed footer did not render.');
  return el as HTMLElement;
};

/**
 * The footer's two lines, in order.
 *
 * Asserting the pair rather than "the timestamp is somewhere on the page" is what
 * pins the layout: the heading and the timestamp are separate `<p>`s in a centred
 * column, so a formatter that returned its string into the wrong slot, or a second
 * line that rendered above the first, would still satisfy a bare text query.
 */
const footerLines = (canvasElement: HTMLElement): (string | null)[] =>
  [...footerOf(canvasElement).children].map((line) => line.textContent);

export const ClosedRecently: Story = {
  name: 'Closed (relative timestamp)',
  args: { closedAt: AGO(3 * HOUR_MS) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Chat session closed')).toBeInTheDocument();
    await expect(canvas.getByText('3 hours ago')).toBeInTheDocument();

    /* The composer is GONE, not disabled. Asserting the absence of the send
       control is what makes this the closed state rather than a footer that
       happens to be stacked under a live input. */
    await expect(canvas.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
    await expect(canvas.queryByPlaceholderText('Write a message…')).not.toBeInTheDocument();

    /* `bg-chat-surface-soft` and `border-chat-divider` are named Tailwind tokens.
       An undefined token emits no declaration at all - the class is simply absent
       from the stylesheet - so the footer would render transparent and flush with
       the message list and still pass any "the text is there" check. Polled, since
       nothing guarantees the sheet has applied on the first synchronous read. */
    const footer = footerOf(canvasElement);
    await waitFor(() => {
      expect(getComputedStyle(footer).backgroundColor).toBe('rgb(241, 235, 225)');
    });
    await expect(getComputedStyle(footer).borderTopWidth).toBe('1px');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The common case: a session ended earlier today. Two centred lines on the warm ' +
          '`--color-chat-surface-soft` band, separated from the message list by a single ' +
          '`--color-chat-divider` hairline.',
      },
    },
  },
};

export const ClosedJustNow: Story = {
  name: 'Closed (under a minute)',
  /* Stamped at RENDER, not in `args`. Args are evaluated once when the module is
     imported, and this branch only holds for 60 seconds - a story left open in the
     sidebar for two minutes would have re-run against a stale timestamp and read
     "2 minutes ago". The other stories here are hours or days wide and are safe as
     args. */
  render: () => <ChatClosedFooter closedAt={new Date().toISOString()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The first branch of the formatter, and the one a reader actually sees:
       closing a session swaps the composer for this footer immediately, so this
       is the frame that follows the click. */
    await expect(canvas.getByText('just now')).toBeInTheDocument();
    await expect(footerLines(canvasElement)).toEqual(['Chat session closed', 'just now']);
    await expect(canvas.queryByPlaceholderText('Write a message…')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`diffMins < 1`. Note it never re-renders itself - the footer has no timer, so it ' +
          'reads "just now" until something else re-renders the window, however long the tab ' +
          'stays open.',
      },
    },
  },
};

export const ClosedDaysAgo: Story = {
  name: 'Closed (days)',
  args: { closedAt: AGO(4 * DAY_MS) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(footerLines(canvasElement)).toEqual(['Chat session closed', '4 days ago']);

    /* Plural, and not "96 hours ago": the formatter switches unit at 24 hours and
       again at 7 days, so the wrong branch here reads as a plausible sentence
       rather than as a bug. */
    await expect(canvas.queryByText('96 hours ago')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The relative form holds up to seven days. Singular and plural are handled, so a ' +
          'one-day-old session reads "1 day ago" rather than "1 days ago".',
      },
    },
  },
};

export const ClosedLongAgo: Story = {
  name: 'Closed (past seven days, absolute date)',
  args: { closedAt: AGO(LONG_AGO_MS) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Compared against the real formatter rather than a hand-written date string:
       `formatDisplayDate` resolves the practice timezone, so hard-coding the
       expected text would pass on one machine and fail on another. */
    const expected = formatDisplayDate(new Date(Date.now() - LONG_AGO_MS));
    await expect(footerLines(canvasElement)).toEqual(['Chat session closed', expected]);
    await expect(canvas.queryByText(/ago$/)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Past seven days the line switches to an absolute date. This is the form an archived ' +
          'conversation shows, and it is the only branch where the footer text is not readable ' +
          'as a duration.',
      },
    },
  },
};

export const ClosedWithoutTimestamp: Story = {
  name: 'Closed (no timestamp at all)',
  args: { closedAt: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Chat session closed')).toBeInTheDocument();

    /* The caller passes `closedAt || updatedAt`, so this needs BOTH to be missing -
       a frozen channel restored from a cache that never carried either field. The
       formatter returns '' and the second line is dropped, leaving a footer whose
       height differs from every other closed conversation in the list. */
    const footer = footerOf(canvasElement);
    await expect(footer.children).toHaveLength(1);
    await expect(canvas.queryByText('just now')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'One line instead of two. Nothing renders a dash or a placeholder, so the band is ' +
          'roughly 18px shorter here than in every story above it.',
      },
    },
  },
};

export const EmptyThread: Story = {
  name: 'Empty thread',
  render: () => <ChatEmptyThread />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No messages yet')).toBeInTheDocument();
    await expect(
      canvas.getByText('Send the first message to start the conversation.')
    ).toBeInTheDocument();

    /* The icon disc is `bg-chat-panel`, another named token. Same failure mode as
       the footer band: an undefined token leaves a bare glyph floating with no
       circle behind it, which reads as a rendering glitch rather than a missing
       style. */
    const disc = canvasElement.querySelector('span.rounded-full');
    if (!disc) throw new Error('The empty-state icon disc did not render.');
    await waitFor(() => {
      expect(getComputedStyle(disc).backgroundColor).toBe('rgb(241, 235, 225)');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'A brand-new conversation, before either side has written anything. It is centred in ' +
          'the message list with `flex-1`, so it sits mid-panel rather than at the top - and it ' +
          'is the one chat surface that appears above a live composer rather than instead of it.',
      },
    },
  },
};
