import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ChannelActionProvider, ChannelStateProvider } from 'stream-chat-react';
import type { ChannelActionContextValue, ChannelStateContextValue } from 'stream-chat-react';

import MessageSearch from './MessageSearch';

/**
 * The component reads exactly two things off Stream: `channel.search` from the
 * channel state context, and `jumpToMessage` from the channel action context.
 * Both providers are plain React contexts that stream-chat-react exports, so a
 * two-key object stands in for the whole SDK - no client, no token, no socket,
 * and no module mocking (this project has no MSW or `sb.mock` wiring).
 *
 * The context values are built once per decorator rather than per render: the
 * debounced effect lists `channel` in its dependencies, so a fresh object on
 * every render would restart the 300ms timer forever.
 */
type FakeMessage = { id: string; text?: string; user?: { id: string; name?: string } };
type Search = (query: string) => Promise<{ results: Array<{ message: FakeMessage }> }>;

const withChannel = (search: Search, jumpToMessage: (id: string) => void = fn()) => {
  const state = { channel: { search } } as unknown as ChannelStateContextValue;
  const actions = { jumpToMessage } as unknown as ChannelActionContextValue;
  return (Story: React.ComponentType) => (
    <ChannelStateProvider value={state}>
      <ChannelActionProvider value={actions}>
        <Story />
      </ChannelActionProvider>
    </ChannelStateProvider>
  );
};

const MATCHES: FakeMessage[] = [
  {
    id: 'm-1',
    text: 'Sutures out on Thursday, and keep the cone on until then.',
    user: { id: 'u-vet', name: 'Dr. Amelia Hart' },
  },
  {
    id: 'm-2',
    text: 'Suture line looks clean this morning, no discharge.',
    user: { id: 'u-nurse', name: 'Tomas Vidal' },
  },
  {
    // No text and no name: the row falls back to the sender id and the literal
    // word "Attachment", which is the only thing an image-only match can show.
    id: 'm-3',
    user: { id: 'u-client' },
  },
];

const asResults = (messages: FakeMessage[]) => ({
  results: messages.map((message) => ({ message })),
});

const found =
  (messages: FakeMessage[]): Search =>
  () =>
    Promise.resolve(asResults(messages));

const NOTHING_FOUND: Search = () => Promise.resolve(asResults([]));
const NEVER_RESOLVES: Search = () => new Promise<never>(() => {});
const FAILS: Search = () => Promise.reject(new Error('search unavailable'));

/** A real wait, for the one assertion that has to prove a state persists. */
const settle = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const MANY: FakeMessage[] = Array.from({ length: 12 }, (_, index) => ({
  id: `bulk-${index}`,
  text: `Suture check ${index + 1} - wound clean, owner updated by phone.`,
  user: { id: 'u-vet', name: 'Dr. Amelia Hart' },
}));

/**
 * The popover is `absolute right-0 top-11`, anchored to the trigger, so the
 * frame mimics its real home: pinned to the right of a header row with the
 * thread underneath it.
 */
const HeaderSlot = (Story: React.ComponentType) => (
  <div className="h-[440px] w-[560px] bg-[var(--screen)]">
    <div className="flex items-center justify-end border-b border-[var(--hairline)] px-4 py-2.5">
      <Story />
    </div>
  </div>
);

/** Opens the popover and returns the panel plus its click-catching backdrop. */
const openSearch = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: 'Search messages' });
  await userEvent.click(trigger);
  const field = await canvas.findByLabelText('Search in conversation');
  // input -> the rounded field pill -> the panel itself.
  const panel = field.parentElement?.parentElement as HTMLElement;
  return {
    canvas,
    trigger,
    field,
    panel,
    backdrop: canvas.getByRole('button', { name: 'Close search' }),
  };
};

/** The result rows are the buttons inside the popover's own list. */
const resultRows = (panel: HTMLElement) =>
  within(panel.querySelector('ul') as HTMLElement).queryAllByRole('button');

/** Every box here is `border-box` with a 1px border, and `getComputedStyle().width` resolves to
 *  the CONTENT box - a `w-80` card reads back as 318px, not 320. Measured off the border box,
 *  which is the number the design names and what the other stories in this repo assert. */
const widthOf = (el: HTMLElement) => Math.round(el.getBoundingClientRect().width);

const meta = {
  title: 'Chat/MessageSearch',
  component: MessageSearch,
  decorators: [HeaderSlot],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The in-conversation search popover behind the magnifier in the thread header. Until ' +
          'someone clicks that 36px circle the component is a single button, and everything ' +
          'below - the 320px card, the field, all four list states - is unmounted. Nothing had ' +
          'ever drawn any of it.\n\n' +
          'The list is a four-way branch and only ever shows one arm: `Searching…` while a request ' +
          'is out, `No messages found` for a query that matched nothing, the rows themselves, and ' +
          'a genuinely empty card before anything is typed. Three of the four need a channel ' +
          'response to reach, which is why each story below supplies its own `channel.search`.\n\n' +
          'Two behaviours are worth watching. The search is debounced 300ms, so a burst of typing ' +
          'is one request carrying the trimmed query, not one per keystroke - and the `Searching…` ' +
          'line appears immediately on the keystroke, during render, well before that request goes ' +
          'out. And the empty line is not evidence of a search at all: it renders on ' +
          '`!searching && hasQuery && results.length === 0`, which a rejected request satisfies ' +
          '(`.catch` sets the results to `[]`) and so does a component with no `channel` to ask. ' +
          'Three stories below - **No matches**, **Search fails** and **Mounted outside a Stream ' +
          'channel** - produce the identical sentence from a healthy empty result, a dead API and ' +
          'a request that never happened. They are the same picture on purpose.\n\n' +
          'The open popover is two siblings, not one: a `fixed inset-0 z-10` transparent button ' +
          'covering the whole app to catch the next click anywhere, and the `z-20` card above it. ' +
          'If those ever level out, the card looks perfect and every row in it stops responding.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MessageSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Closed (the whole resting surface)',
  decorators: [withChannel(found(MATCHES))],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Search messages' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // 36px square, which is the largest of the three circular controls in the
    // header row - see **Chat/ChannelHeaderBar** for the other two.
    await expect(widthOf(trigger)).toBe(36);
    await expect(Math.round(trigger.getBoundingClientRect().height)).toBe(36);
    // A bordered circle with a glyph and no label, so this is the whole resting
    // surface: one child, an svg, and no text at all.
    await expect(trigger.textContent).toBe('');
    await expect(trigger.querySelector('svg')).not.toBeNull();
    // Fully round rather than a squircle: the radius is at least half the box.
    await expect(
      Number.parseFloat(getComputedStyle(trigger).borderTopLeftRadius)
    ).toBeGreaterThanOrEqual(18);
    // Nothing else exists yet - not hidden, not zero-height.
    await expect(canvas.queryByLabelText('Search in conversation')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Close search' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the header actually shows for this component: one bordered circle. The entire ' +
          'feature is behind it, which is the reason the rest of these stories exist.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Open, nothing typed',
  decorators: [withChannel(found(MATCHES))],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Search messages' });
    const restingBorder = getComputedStyle(trigger).borderTopColor;

    const { field, panel, backdrop } = await openSearch(canvasElement);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // The card, measured: 320px (`w-80`), positioned off the trigger rather than
    // laid out in the header flow, and hanging BELOW it (`top-11`) rather than
    // over it.
    await expect(widthOf(panel)).toBe(320);
    await expect(getComputedStyle(panel).position).toBe('absolute');
    await expect(panel.getBoundingClientRect().top).toBeGreaterThan(
      trigger.getBoundingClientRect().bottom
    );

    /* The stacking that makes the card usable at all. The backdrop covers the
       whole viewport; if it ever sat at or above the card's layer, every row
       would be unclickable while looking completely normal. */
    await expect(getComputedStyle(backdrop).position).toBe('fixed');
    await expect(getComputedStyle(backdrop).zIndex).toBe('10');
    await expect(getComputedStyle(panel).zIndex).toBe('20');

    // `autoFocus` means the caret is already in the field - no second click.
    await waitFor(() => {
      expect(document.activeElement).toBe(field);
    });

    // Open with no query is a real state: an empty card, not a prompt line.
    await expect(resultRows(panel)).toHaveLength(0);
    await expect(canvas.queryByText('Searching…')).not.toBeInTheDocument();
    await expect(canvas.queryByText('No messages found')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    // The trigger repaints to the active blue treatment. `transition-colors`, so
    // this is polled rather than read once.
    await waitFor(() => {
      expect(getComputedStyle(trigger).borderTopColor).not.toBe(restingBorder);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The card immediately after opening: a 48px `--field-bg` pill inside a `rounded-2xl` ' +
          '`--screen` card with a two-layer shadow, and below it nothing at all. Note there is no ' +
          'empty-state copy here - the card is silent until a query exists, which is a different ' +
          'choice from the network directory, whose equivalent state carries a prompt line.',
      },
    },
  },
};

export const Searching: Story = {
  name: 'Searching (request in flight)',
  decorators: [withChannel(NEVER_RESOLVES)],
  play: async ({ canvasElement }) => {
    const { canvas, field, panel } = await openSearch(canvasElement);
    await userEvent.type(field, 'suture');

    // Set during render, so it is up before the debounce has even started.
    expect(await canvas.findByText('Searching…')).toBeInTheDocument();
    await expect(resultRows(panel)).toHaveLength(0);

    /* And it stays. A `waitFor` would prove nothing here - it resolves on the
       first passing check - so this waits out the 300ms debounce plus a margin
       and then reads once. This channel's search never settles, so the line has
       to still be there. */
    await settle(600);
    await expect(canvas.getByText('Searching…')).toBeInTheDocument();
    await expect(canvas.queryByText('No messages found')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A slow or hanging `channel.search`. In practice this shows for a few hundred ' +
          'milliseconds and is impossible to catch by hand, so it is worth checking here that the ' +
          'line is centred and that the card does not jump height when rows replace it.',
      },
    },
  },
};

const searchCalls: string[] = [];
const recordingSearch: Search = (query) => {
  searchCalls.push(query);
  return Promise.resolve(asResults(MATCHES));
};

export const Results: Story = {
  name: 'Results (debounced, trimmed)',
  decorators: [withChannel(recordingSearch)],
  play: async ({ canvasElement }) => {
    searchCalls.length = 0;
    const { canvas, field, panel } = await openSearch(canvasElement);

    // Trailing space on purpose: the component searches `query.trim()`.
    await userEvent.type(field, 'suture ');

    await waitFor(() => {
      expect(resultRows(panel)).toHaveLength(3);
    });

    const rows = resultRows(panel);
    // Sender over snippet, both truncated to one line each.
    await expect(rows[0]).toHaveTextContent('Dr. Amelia Hart');
    await expect(rows[0]).toHaveTextContent(
      'Sutures out on Thursday, and keep the cone on until then.'
    );
    await expect(rows[1]).toHaveTextContent('Tomas Vidal');
    // The fallbacks: no display name falls back to the user id, and a message
    // with no text renders the word "Attachment" rather than an empty row.
    await expect(rows[2]).toHaveTextContent('u-client');
    await expect(rows[2]).toHaveTextContent('Attachment');

    // Debounced to a request per pause, not per keystroke, and the query that
    // travelled is trimmed.
    await expect(searchCalls.at(-1)).toBe('suture');
    await expect(searchCalls.length).toBeLessThan('suture '.length);

    // Something to clear now exists, so the clear affordance appears.
    await expect(canvas.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three matches. Each row is a `rounded-xl` button with a 13px sender line over a 12px ' +
          'snippet, both `truncate` - so a long message shows its first line only and there is no ' +
          'highlight of the matched term anywhere in the row. The count of requests is asserted ' +
          'rather than the exact number, because the debounce collapses a burst by timing rather ' +
          'than by counting.',
      },
    },
  },
};

export const ManyResults: Story = {
  name: 'Results overflow the card',
  decorators: [withChannel(found(MANY))],
  play: async ({ canvasElement }) => {
    const { field, panel } = await openSearch(canvasElement);
    await userEvent.type(field, 'suture');

    await waitFor(() => {
      expect(resultRows(panel)).toHaveLength(12);
    });

    const list = panel.querySelector('ul') as HTMLElement;
    // `max-h-72` = 288px, and twelve rows are taller than that, so the list is
    // genuinely scrolling rather than the card growing to fit.
    await expect(getComputedStyle(list).maxHeight).toBe('288px');
    await expect(getComputedStyle(list).overflowY).toBe('auto');
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Twelve matches against a list capped at 288px. There is no result count and no "showing ' +
          '10 of N" line, so the only clue that more exist is the scrollbar - which is the thing ' +
          'to judge here, since the card sits over the message list with a shadow and the boundary ' +
          'is easy to lose.',
      },
    },
  },
};

export const NoMatches: Story = {
  name: 'No matches',
  decorators: [withChannel(NOTHING_FOUND)],
  play: async ({ canvasElement }) => {
    const { canvas, field, panel } = await openSearch(canvasElement);
    await userEvent.type(field, 'radiograph');

    const line = await canvas.findByText('No messages found');
    await expect(resultRows(panel)).toHaveLength(0);
    await expect(canvas.queryByText('Searching…')).not.toBeInTheDocument();

    /* The line replaces the list rather than sitting above an empty one: it is
       the single `<li>` in the scroller, centred, and the whole card is that one
       row plus the field. */
    const list = panel.querySelector('ul') as HTMLElement;
    await expect(list.children).toHaveLength(1);
    await expect(line.closest('li')).toBe(list.children[0]);
    await expect(getComputedStyle(list.children[0] as HTMLElement).textAlign).toBe('center');
    // The query is still in the field, so the user can edit rather than retype.
    await expect(field).toHaveValue('radiograph');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A query the channel has nothing for - the honest version of this line. `searching` ' +
          'gates it, so it never flashes over a request that is still out; but nothing ties it to ' +
          'a request having happened, which is what **Search fails** and **Mounted outside a ' +
          'Stream channel** show reaching the same sentence by other routes.',
      },
    },
  },
};

export const SearchFails: Story = {
  name: 'Search fails (indistinguishable)',
  decorators: [withChannel(FAILS)],
  play: async ({ canvasElement }) => {
    const { canvas, field, panel } = await openSearch(canvasElement);
    await userEvent.type(field, 'radiograph');

    // The rejection is swallowed: same copy, same empty list, no error tone and
    // no retry. Byte-for-byte the NoMatches story above - asserted with the same
    // three checks so the two stories are comparable line by line.
    const line = await canvas.findByText('No messages found');
    await expect(resultRows(panel)).toHaveLength(0);
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();

    const list = panel.querySelector('ul') as HTMLElement;
    await expect(list.children).toHaveLength(1);
    await expect(line.closest('li')).toBe(list.children[0]);
    await expect(line.textContent).toBe('No messages found');
    await expect(getComputedStyle(list.children[0] as HTMLElement).textAlign).toBe('center');
    // No retry affordance is offered either. The only control the card grew is
    // the clear glyph, which is the same one a successful search grows.
    const controls = within(panel)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    await expect(controls).toEqual(['Clear search']);
    await expect(field).toHaveValue('radiograph');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The failure path, drawn beside the empty one so the problem is visible: `.catch` sets ' +
          'the results to `[]`, so a broken search API tells the user their conversation contains ' +
          'no matching messages. Compare this story with **No matches** - they are the same ' +
          'picture, which is the finding.',
      },
    },
  },
};

const jumped = fn();

export const JumpsToMessage: Story = {
  name: 'Selecting a result jumps and closes',
  decorators: [withChannel(found(MATCHES), jumped)],
  play: async ({ canvasElement }) => {
    // Module-scope spy, so it is cleared here rather than relying on the per-story
    // arg reset that only applies to spies passed through `args`.
    jumped.mockClear();
    const { canvas, trigger, field, panel } = await openSearch(canvasElement);
    await userEvent.type(field, 'suture');

    await waitFor(() => {
      expect(resultRows(panel)).toHaveLength(3);
    });
    await userEvent.click(resultRows(panel)[1]);

    // The id of the row that was clicked, not the first match.
    await expect(jumped).toHaveBeenCalledWith('m-2');
    // And the popover closes on selection, handing the thread back.
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByLabelText('Search in conversation')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The point of the feature. `jumpToMessage` is the channel action that scrolls the ' +
          'message list to that id and highlights it, so the popover closes in the same tick - ' +
          'the user is meant to land on the message, not keep the card over it.',
      },
    },
  },
};

export const ClearsTheQuery: Story = {
  name: 'Clearing resets the card',
  decorators: [withChannel(found(MATCHES))],
  play: async ({ canvasElement }) => {
    const { canvas, field, panel } = await openSearch(canvasElement);
    await userEvent.type(field, 'suture');
    await waitFor(() => {
      expect(resultRows(panel)).toHaveLength(3);
    });

    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }));

    // Back to the open-and-empty state: rows dropped, no empty-result line, and
    // the clear control removes itself. This reset happens during render via the
    // compare guard, not in an effect, so there is no frame showing stale rows.
    await expect(field).toHaveValue('');
    await expect(resultRows(panel)).toHaveLength(0);
    await expect(canvas.queryByText('No messages found')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    // Whitespace is not a query either - `trim()` gates both the request and the
    // empty-result line, so a space bar leaves the card silent.
    await userEvent.type(field, '   ');
    await expect(canvas.queryByText('Searching…')).not.toBeInTheDocument();
    await expect(canvas.queryByText('No messages found')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The clear glyph inside the field pill. It appears only when there is something to ' +
          'clear, and clearing returns the card to its opened-but-empty form rather than closing ' +
          'it - so the caret stays put and the next query starts immediately.',
      },
    },
  },
};

export const BackdropCloses: Story = {
  name: 'Clicking outside closes it',
  decorators: [withChannel(found(MATCHES))],
  play: async ({ canvasElement }) => {
    const canvasBefore = within(canvasElement);
    const restingBorder = getComputedStyle(
      canvasBefore.getByRole('button', { name: 'Search messages' })
    ).borderTopColor;

    const { canvas, trigger, backdrop } = await openSearch(canvasElement);
    // It really does cover the app rather than just the card: the backdrop fills
    // the whole viewport, which is why the first click anywhere is spent closing.
    // `clientWidth` on the root, not `innerWidth` - a scrollbar would put those
    // ~15px apart and the assertion would be measuring the wrong box.
    await expect(widthOf(backdrop)).toBe(document.documentElement.clientWidth);

    await userEvent.click(backdrop);

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByLabelText('Search in conversation')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Close search' })).not.toBeInTheDocument();
    // The header is back to exactly one control, and that control has repainted
    // to its resting border rather than staying blue. Polled: `transition-colors`.
    await expect(within(canvasElement).getAllByRole('button')).toHaveLength(1);
    await waitFor(() => {
      expect(getComputedStyle(trigger).borderTopColor).toBe(restingBorder);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dismiss path. It is a real full-screen `<button aria-label="Close search">` rather ' +
          'than a document listener, so it is in the tab order and announced - and because it is ' +
          '`fixed inset-0`, the first click anywhere in the app after opening the popover is spent ' +
          'closing it. Escape, by contrast, does nothing here.',
      },
    },
  },
};

export const WithoutAChannel: Story = {
  name: 'Mounted outside a Stream channel',
  // Deliberately no `withChannel` decorator: this is the only story with neither
  // provider, which is what `ChannelHeaderBar` gives it in Storybook.
  play: async ({ canvasElement }) => {
    const { canvas, field, panel } = await openSearch(canvasElement);
    await userEvent.type(field, 'suture');

    /* `useChannelStateContext` returns `{}` after a console warning, so `channel`
       is undefined and `searchKey` stays null. No request is ever scheduled and
       `searching` never flips - and the card answers "No messages found" anyway,
       because that line is gated on `!searching && hasQuery && results.length === 0`
       and `channel` is not one of those three. It appears on the first keystroke,
       with nothing having been asked and nothing to ask. */
    const line = await canvas.findByText('No messages found');
    await expect(canvas.queryByText('Searching…')).not.toBeInTheDocument();
    await expect(resultRows(panel)).toHaveLength(0);

    /* And it is stable rather than a frame before a real search: waiting out the
       300ms debounce plus a margin leaves the same line, because there is no
       timer. `waitFor` would resolve on the first passing check and prove
       nothing here. */
    await settle(500);
    const list = panel.querySelector('ul') as HTMLElement;
    await expect(list.children).toHaveLength(1);
    await expect(line.closest('li')).toBe(list.children[0]);

    /* The chrome is fully alive, which is what makes this silent: the field took
       the text, the clear glyph appeared because `hasQuery` is true, and the card
       is the same 320px surface as a real search. */
    await expect(field).toHaveValue('suture');
    await expect(canvas.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
    await expect(widthOf(panel)).toBe(320);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The degenerate case, and the one that matters for **Chat/ChannelHeaderBar**: that bar ' +
          'embeds this component, and outside a mounted `Channel` the state context has no ' +
          '`channel`. The trigger and the card still render and still open - they just never ' +
          'search.\n\n' +
          'They still answer, though, and that is the finding. `No messages found` is gated on ' +
          '`!searching && hasQuery && results.length === 0`; `channel` is not one of those three, ' +
          'so the line appears on the first keystroke with no request ever scheduled. Same copy ' +
          'as **No matches**, same copy as **Search fails** - three different causes, one ' +
          'sentence, and this one does not even have a channel to search. The play function waits ' +
          'out the debounce to show it is a settled state rather than a frame on the way to one.',
      },
    },
  },
};
