import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Channel, ChannelFilters, StreamChat } from 'stream-chat';

import ChatCommandPalette from './ChatCommandPalette';

const ME = 'u-me';

/**
 * The palette touches four things on a channel - `id`, `cid`, `data.name` and
 * `state.members` - and one thing on the client: `queryChannels`. Objects with
 * that shape are a complete stand-in, so these stories run with no Stream
 * client, no token and no socket.
 */
type FakeChannel = {
  id: string;
  cid: string;
  data?: { name?: string; organisationId?: string };
  state?: { members?: Record<string, { user?: { id: string; name?: string } }> };
};

const CHANNELS: FakeChannel[] = [
  {
    id: 'c-ward',
    cid: 'messaging:c-ward',
    data: { name: 'Ward round · ICU', organisationId: 'org-mine' },
  },
  {
    id: 'c-triage',
    cid: 'messaging:c-triage',
    data: { name: 'Ward triage · front desk', organisationId: 'org-mine' },
  },
  {
    id: 'c-lab',
    cid: 'messaging:c-lab',
    data: { name: 'Lab results', organisationId: 'org-mine' },
  },
  {
    // No `data.name`: a direct message, whose title is derived from the member
    // who is not the signed-in user.
    id: 'c-dm-marta',
    cid: 'messaging:c-dm-marta',
    data: { organisationId: 'org-mine' },
    state: {
      members: {
        [ME]: { user: { id: ME, name: 'Yara Osman' } },
        'u-marta': { user: { id: 'u-marta', name: 'Marta Alvarez' } },
      },
    },
  },
  {
    // A direct message with a member who has no display name at all: the title
    // falls back to the raw user id rather than rendering blank.
    id: 'c-dm-anon',
    cid: 'messaging:c-dm-anon',
    data: { organisationId: 'org-mine' },
    state: {
      members: {
        [ME]: { user: { id: ME, name: 'Yara Osman' } },
        'u-8814': { user: { id: 'u-8814' } },
      },
    },
  },
];

const FOREIGN: FakeChannel = {
  id: 'c-other-org',
  cid: 'messaging:c-other-org',
  data: { name: 'Ward round · Riverbend', organisationId: 'org-somebody-else' },
};

const clientWith = (channels: FakeChannel[]) =>
  ({
    userID: ME,
    queryChannels: () => Promise.resolve(channels),
  }) as unknown as StreamChat;

const FILTERS: ChannelFilters = { type: 'messaging' };

const belongsToMyOrg = (channel: Channel) =>
  (channel.data as { organisationId?: string } | undefined)?.organisationId === 'org-mine';

/** A real wait, for the assertion that has to prove a keystroke did nothing. */
const settle = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** The palette unmounts when closed, so this is null rather than a hidden node. */
const paletteOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('dialog[open]') as HTMLElement | null;

/**
 * Opens the palette with the real shortcut, re-sending it until it lands.
 *
 * The ⌘K listener is registered inside an effect, and a play function can start
 * before that effect has flushed - the failure mode that left every GlassTooltip
 * story green while proving nothing. `findBy*` retries the QUERY, never the
 * KEYSTROKE, so one lost dispatch would be permanent and invisible. Re-sending
 * is safe because a lost dispatch toggles nothing: each attempt checks before
 * pressing again.
 */
const openPalette = async (canvasElement: HTMLElement) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (paletteOf(canvasElement)) break;
    await userEvent.keyboard('{Meta>}k{/Meta}');
    await settle(100);
  }
  const palette = paletteOf(canvasElement);
  if (!palette) throw new Error('The palette never opened after 5 Cmd+K presses.');
  return palette;
};

/** The jump rows, scoped to the palette's own list. */
const rowsOf = (palette: HTMLElement) =>
  within(palette.querySelector('ul') as HTMLElement).queryAllByRole('button');

/**
 * A row's `textContent` starts with the avatar monogram ("WR" before "Ward round
 * · ICU"), so the title is read off the `flex-1` span instead of the whole row.
 */
const rowTitles = (palette: HTMLElement) =>
  rowsOf(palette).map((row) => row.querySelector('.flex-1')?.textContent);

const PageBehind = (Story: React.ComponentType) => (
  <div className="min-h-[620px] bg-[var(--screen-2)] p-6">
    <p className="text-[13px] text-[var(--ink-muted)]">
      The chat shell. The palette is `fixed inset-0`, so it covers this whole surface - the tint and
      the 96px top offset are only judgeable with something behind them.
    </p>
    <Story />
  </div>
);

const meta = {
  title: 'Chat/ChatCommandPalette',
  component: ChatCommandPalette,
  decorators: [PageBehind],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The ⌘K / Ctrl-K jump-to-conversation palette. `ChatContainer` mounts it once, and it ' +
          'returns `null` until the shortcut fires - so there is no closed state to capture and ' +
          'nothing had ever drawn it. Every story here opens it with the real key combination ' +
          'rather than a prop, because there is no prop.\n\n' +
          'It is also the only place in the product that resolves a conversation title without ' +
          'Stream doing it: `titleOf` prefers `data.name`, and for a direct message falls back to ' +
          "the first member who is not the signed-in user, then to that member's raw user id, " +
          'then to the literal "Conversation". Two of the fixtures below are DMs for that reason - ' +
          "one named, one with no display name - because a title bug here shows the operator's own " +
          'name back at them and nothing else in the UI would look wrong.\n\n' +
          'The filtering is client-side and substring-only over the resolved title, on the 30 most ' +
          'recent channels. There is no fuzzy matching despite the shape of the control, no ' +
          'highlighting of the matched span, and no keyboard traversal of the list: arrow keys do ' +
          'nothing, and Enter always jumps to `results[0]` whatever the pointer is over.\n\n' +
          'The organisation filter is the part worth reviewing carefully. Stream has no ' +
          'server-side org scope, so `queryChannels` genuinely returns conversations from other ' +
          'clinics and `channelBelongsToOrg` drops them in the client. The **Cross-org channel ' +
          'dropped** story feeds one in to show it never reaches a row - without that predicate ' +
          'the palette would open a channel the active organisation cannot otherwise see.\n\n' +
          'One more thing this component does that is invisible from the outside: its keydown ' +
          'listener is registered on the capture phase and calls `stopImmediatePropagation`, so ' +
          'while chat is mounted ⌘K opens this palette instead of the app-wide UniversalSearch. ' +
          'Two palettes on one shortcut, and the winner is decided by listener phase.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    client: clientWith(CHANNELS),
    filters: FILTERS,
    onJump: fn(),
  },
} satisfies Meta<typeof ChatCommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  name: 'Open (⌘K)',
  play: async ({ canvasElement }) => {
    const palette = await openPalette(canvasElement);
    const canvas = within(palette);

    await expect(palette).toHaveAttribute('aria-label', 'Jump to conversation');
    await expect(canvas.getByLabelText('Search conversations')).toHaveAttribute(
      'placeholder',
      'Jump to a conversation…'
    );
    // The caret is already in the field: ⌘K then type, with no click in between.
    await expect(document.activeElement).toBe(canvas.getByLabelText('Search conversations'));

    /* All five, in the order `queryChannels` returned them - the palette does not
       re-sort, so this is `last_message_at` descending straight from Stream. The
       last two are the derived DM titles: the other member's name, then their id.
       Polled, because the channels arrive from a promise after the open. */
    await waitFor(() => {
      expect(rowTitles(palette)).toEqual([
        'Ward round · ICU',
        'Ward triage · front desk',
        'Lab results',
        'Marta Alvarez',
        'u-8814',
      ]);
    });
    // The signed-in user is never the title of their own DM.
    await expect(canvas.queryByText('Yara Osman')).not.toBeInTheDocument();

    // The card, measured: 512px (`max-w-lg`) over a 320px (`max-h-80`) scroller.
    const card = palette.querySelector('ul')?.parentElement as HTMLElement;
    await expect(getComputedStyle(card).maxWidth).toBe('512px');
    await expect(getComputedStyle(palette.querySelector('ul') as HTMLElement).maxHeight).toBe(
      '320px'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The palette as it opens: a 512px card 96px down from the top of a `neutral-900/30` ' +
          'wash, a search row with a ⌘K chip on the right, and the 30 most recent conversations ' +
          'below it. Each row is avatar, title, and a return-arrow glyph that is decoration only - ' +
          'the whole row is the button.',
      },
    },
  },
};

export const FiltersAsYouType: Story = {
  name: 'Filtering the list',
  play: async ({ canvasElement }) => {
    const palette = await openPalette(canvasElement);
    const canvas = within(palette);
    const field = canvas.getByLabelText('Search conversations');
    await waitFor(() => {
      expect(rowsOf(palette)).toHaveLength(5);
    });

    await userEvent.type(field, 'ward');

    // Substring, case-insensitive, over the RESOLVED title - so it matches the
    // derived DM names too, not only `data.name`.
    await waitFor(() => {
      expect(rowTitles(palette)).toEqual(['Ward round · ICU', 'Ward triage · front desk']);
    });

    await userEvent.clear(field);
    await userEvent.type(field, 'marta');
    await waitFor(() => {
      expect(rowTitles(palette)).toEqual(['Marta Alvarez']);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing narrows the list in place - no request, no spinner, no debounce, because the ' +
          'channels were fetched once when the palette opened. Nothing marks which part of the ' +
          'title matched, which is most noticeable on a query like "ward" that hits two very ' +
          'different conversations.',
      },
    },
  },
};

export const NoMatches: Story = {
  name: 'No matches',
  play: async ({ canvasElement }) => {
    const palette = await openPalette(canvasElement);
    const canvas = within(palette);
    const field = canvas.getByLabelText('Search conversations');
    await waitFor(() => {
      expect(rowsOf(palette)).toHaveLength(5);
    });
    await userEvent.type(field, 'zzz');

    const line = await canvas.findByText('No conversations found');
    await expect(rowsOf(palette)).toHaveLength(0);

    /* The line replaces the whole list - it is the only `<li>` in the scroller,
       centred - and the query stays in the field, so the card is a search box
       over one grey sentence. */
    const list = palette.querySelector('ul') as HTMLElement;
    await expect(list.children).toHaveLength(1);
    await expect(line.closest('li')).toBe(list.children[0]);
    await expect(getComputedStyle(list.children[0] as HTMLElement).textAlign).toBe('center');
    await expect(field).toHaveValue('zzz');
    // No "create a conversation" escape hatch appears with the empty arm: the
    // scrim button is still the only other control in the dialog.
    await expect(
      within(palette)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Close palette']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The empty arm: a single centred `body-4` line in `--ink-faint` with `py-6`, so the card ' +
          'collapses to about a third of its height. There is no "create a conversation" action ' +
          'from here - the palette only jumps to what already exists.',
      },
    },
  },
};

export const EmptyDirectory: Story = {
  name: 'No conversations at all',
  args: { client: clientWith([]) },
  play: async ({ canvasElement }) => {
    const palette = await openPalette(canvasElement);
    const canvas = within(palette);
    // Same line as a failed query, reached without typing anything.
    const line = canvas.getByText('No conversations found');
    await expect(rowsOf(palette)).toHaveLength(0);
    await expect(line.textContent).toBe('No conversations found');

    /* Which is the finding: with an empty field the card is indistinguishable
       from the No-matches story - same single centred `<li>`, same copy - so a
       first-run account is told its search failed. */
    const list = palette.querySelector('ul') as HTMLElement;
    await expect(list.children).toHaveLength(1);
    await expect(canvas.getByLabelText('Search conversations')).toHaveValue('');
    // The chrome above it is fully drawn, so nothing hints at "nothing here yet".
    await expect(canvas.getByLabelText('Search conversations')).toHaveAttribute(
      'placeholder',
      'Jump to a conversation…'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A brand-new account opening the palette. Identical copy to a query that matched ' +
          'nothing, which is worth seeing: the first-run case reads as though the search failed ' +
          'rather than as though there is nothing to search yet.',
      },
    },
  },
};

export const CrossOrgChannelDropped: Story = {
  name: 'Cross-org channel dropped',
  args: {
    client: clientWith([FOREIGN, ...CHANNELS]),
    channelBelongsToOrg: belongsToMyOrg,
  },
  play: async ({ canvasElement }) => {
    const palette = await openPalette(canvasElement);
    const canvas = within(palette);

    // `queryChannels` returned six; the predicate keeps five.
    await waitFor(() => {
      expect(rowsOf(palette)).toHaveLength(5);
    });
    await expect(canvas.queryByText('Ward round · Riverbend')).not.toBeInTheDocument();
    await expect(canvas.getByText('Ward round · ICU')).toBeInTheDocument();

    // It stays dropped under a query that would otherwise match it - the filter
    // runs on the already-scoped list, not on the raw response.
    await userEvent.type(canvas.getByLabelText('Search conversations'), 'ward');
    await waitFor(() => {
      expect(rowTitles(palette)).toEqual(['Ward round · ICU', 'Ward triage · front desk']);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The security-relevant case. Stream has no server-side organisation scope, so the ' +
          "foreign clinic's channel really is in the response; `channelBelongsToOrg` is the only " +
          'thing keeping it off the list. Note the two remaining rows both match the query, so a ' +
          'reviewer cannot tell from the picture alone that a third one was removed - which is why ' +
          'this is asserted rather than eyeballed.',
      },
    },
  },
};

export const EnterJumpsToFirst: Story = {
  name: 'Enter jumps to the first result',
  play: async ({ args, canvasElement }) => {
    const palette = await openPalette(canvasElement);
    const canvas = within(palette);
    await userEvent.type(canvas.getByLabelText('Search conversations'), 'lab');
    // Waited for on purpose: Enter reads `results[0]`, so pressing it before the
    // filter has applied would jump to the wrong conversation and still pass a
    // "was called" assertion.
    await waitFor(() => {
      expect(rowTitles(palette)).toEqual(['Lab results']);
    });

    await userEvent.keyboard('{Enter}');

    await expect(args.onJump).toHaveBeenCalledTimes(1);
    await expect(args.onJump).toHaveBeenCalledWith('c-lab');
    // Closing unmounts the whole dialog rather than dropping the `open`
    // attribute, so there is nothing left in the DOM to query.
    await expect(paletteOf(canvasElement)).toBeNull();
    await expect(canvasElement.querySelector('dialog')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Enter always takes `results[0]`, and there is no visible selection to tell the user ' +
          'which row that is - the first row is not highlighted, and arrow keys do not move ' +
          'anything. With one match it is unambiguous; the risk is a two-word query that leaves ' +
          'several rows, where Enter picks silently.',
      },
    },
  },
};

export const ClickingARowJumps: Story = {
  name: 'Clicking a row jumps',
  play: async ({ args, canvasElement }) => {
    const palette = await openPalette(canvasElement);
    await waitFor(() => {
      expect(rowsOf(palette)).toHaveLength(5);
    });
    // The fourth row is the derived-title DM, so this also proves the row's id
    // survived the title derivation.
    await userEvent.click(rowsOf(palette)[3]);

    await expect(args.onJump).toHaveBeenCalledWith('c-dm-marta');
    await expect(paletteOf(canvasElement)).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pointer path. `onJump` is `activateChannelById` in the app, which watches the ' +
          'channel and makes it active - so the palette closes immediately and the thread behind ' +
          'it changes under the fading scrim.',
      },
    },
  },
};

export const EscapeCloses: Story = {
  name: 'Escape closes it',
  play: async ({ args, canvasElement }) => {
    const palette = await openPalette(canvasElement);
    // Five rows and a field were on screen a moment ago, so the disappearance
    // below is a real teardown rather than a story that never opened.
    await waitFor(() => {
      expect(rowsOf(palette)).toHaveLength(5);
    });

    await userEvent.keyboard('{Escape}');
    await settle(100);

    await expect(paletteOf(canvasElement)).toBeNull();
    /* Unmounted, not merely un-`open`ed: `if (!open) return null` removes the
       whole dialog, so a `dialog[open]` check and a bare `dialog` check agree.
       A component that dropped only the attribute would leave the card in the
       accessibility tree. */
    await expect(canvasElement.querySelector('dialog')).toBeNull();
    await expect(
      within(canvasElement).queryByLabelText('Search conversations')
    ).not.toBeInTheDocument();
    // Dismissing is not jumping: nothing was activated on the way out.
    await expect(args.onJump).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Escape is handled by the same window-level listener as ⌘K, not by the `<dialog>` ' +
          'element - the dialog is rendered with the `open` attribute rather than shown as a modal, ' +
          'so the browser gives it neither the top layer nor its built-in Escape behaviour. That ' +
          'is also why focus is not trapped inside the card.',
      },
    },
  },
};

export const BackdropCloses: Story = {
  name: 'Clicking the scrim closes it',
  play: async ({ args, canvasElement }) => {
    const palette = await openPalette(canvasElement);
    const backdrop = within(palette).getByRole('button', { name: 'Close palette' });
    const card = palette.querySelector('ul')?.parentElement as HTMLElement;
    await waitFor(() => {
      expect(rowsOf(palette)).toHaveLength(5);
    });

    /* Full-bleed and BENEATH the card, which is the whole reason the rows stay
       clickable: the card is `relative z-10`, the scrim is a plain `absolute`
       with no z-index of its own. Level those out and the palette looks perfect
       and dismisses itself on the first row click. */
    await expect(getComputedStyle(backdrop).position).toBe('absolute');
    await expect(getComputedStyle(backdrop).zIndex).toBe('auto');
    await expect(getComputedStyle(card).zIndex).toBe('10');
    await expect(backdrop.getBoundingClientRect().width).toBeGreaterThan(
      card.getBoundingClientRect().width
    );
    // It is also first in the dialog, so the first Tab out of the field lands on
    // "Close palette" rather than on a conversation.
    await expect(palette.firstElementChild).toBe(backdrop);

    await userEvent.click(backdrop);

    await expect(paletteOf(canvasElement)).toBeNull();
    await expect(canvasElement.querySelector('dialog')).toBeNull();
    await expect(args.onJump).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The scrim is a real labelled button rather than a click handler on the wash, so it is ' +
          'reachable by keyboard - it is also the first thing in the dialog, which means the very ' +
          'first Tab from the search field lands on "Close palette".',
      },
    },
  },
};

export const QueryResetsOnReopen: Story = {
  name: 'Reopening starts empty',
  play: async ({ canvasElement }) => {
    const palette = await openPalette(canvasElement);
    await userEvent.type(within(palette).getByLabelText('Search conversations'), 'lab');
    await waitFor(() => {
      expect(rowsOf(palette)).toHaveLength(1);
    });

    await userEvent.keyboard('{Escape}');
    await settle(100);
    await expect(paletteOf(canvasElement)).toBeNull();

    const reopened = await openPalette(canvasElement);
    const field = within(reopened).getByLabelText('Search conversations');
    /* Cleared during render by the `prevOpen` compare guard rather than in an
       effect, so the reopened palette never paints one frame of the old query or
       of the single row it had filtered to. */
    await expect(field).toHaveValue('');
    await waitFor(() => {
      expect(rowsOf(reopened)).toHaveLength(5);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Open, filter, dismiss, reopen. The palette is a jump tool rather than a search page, so ' +
          'it deliberately forgets - and the reset is computed during render, which is the ' +
          'difference between reopening on a clean list and reopening on a stale one that blinks.',
      },
    },
  },
};
