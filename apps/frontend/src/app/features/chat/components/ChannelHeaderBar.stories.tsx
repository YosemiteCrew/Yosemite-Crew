import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import ChannelHeaderBar from './ChannelHeaderBar';
import './ChatContainer.css';

/** The bar is the only `<header>` in the canvas, so this is unambiguous. */
const headerOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('header') as HTMLElement;

/**
 * The trailing cluster in order. Named controls report their `aria-label`; the
 * `--cta` pills have none, so they fall back to their label text.
 */
const actionNames = (header: HTMLElement) =>
  within(header)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent);

/** Circle controls are `box-sizing: border-box`, and `getComputedStyle().width` resolves to the
 *  CONTENT box - a 34px bordered circle reads back as 32px. Measured off the border box instead,
 *  which is what the design specifies and what the house stories use. */
const widthOf = (el: HTMLElement) => Math.round(el.getBoundingClientRect().width);

const HeaderFrame = (Story: React.ComponentType) => (
  <div className="w-[640px] max-w-full overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--screen)]">
    <Story />
    <div className="p-5 text-[12.5px] text-[var(--ink-faint)]">
      Thread body - here only so the bar sits on its hairline the way it does over the message list.
    </div>
  </div>
);

const meta = {
  title: 'Chat/ChannelHeaderBar',
  component: ChannelHeaderBar,
  decorators: [HeaderFrame],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The thread header: back control, avatar, name over a status subtitle, then the trailing ' +
          'action cluster. It is presentational - every branch is a prop - but it had never been ' +
          'drawn, because in the app it only exists inside a mounted Stream `Channel`, which needs ' +
          'a live client and a real channel.\n\n' +
          'Five props decide what the right-hand cluster contains, and the combinations do not ' +
          'overlap: a client chat gets the info toggle plus either a Close session pill or a ' +
          '"Session closed" badge; a group chat gets a Group Info pill and no info toggle at all; ' +
          'the back control exists only on a phone. So the bar has no single canonical form, and ' +
          'the four shapes below are the ones that actually ship.\n\n' +
          'The status line is two different elements rather than one line with two colours. With ' +
          '`showPresence` it is a flex row carrying a 6px `--success` dot that pulses through the ' +
          '`.chat-presence-dot` keyframes in `ChatContainer.css` (imported here for that reason, ' +
          'and honoured only when the viewer has not asked for reduced motion); without it, it is ' +
          'a plain `caption-2` in `--ink-faint`. Presence also lights the halo on the avatar, so ' +
          'the online bar has two pulsing dots, not one.\n\n' +
          'Three things a reviewer should look at rather than take on trust. First, the circular ' +
          'controls are three different diameters in one 44px row - back 34px, search 36px, info ' +
          '30px - which the Phone story measures. Second, the offline subtitle asks for 11px and ' +
          'renders at 12px: `globals.css` redefines `.text-caption-2` outside any `@layer` with ' +
          '`font-size: 0.75rem !important`, so the `text-[11px]` utility on that element loses and ' +
          'the "quiet" offline line ends up bigger than the 11.5px online one (**Client chat, ' +
          'offline** measures it). Third, the embedded `MessageSearch` reads ' +
          "Stream's channel contexts, and outside a `Channel` those hooks return `{}` after a " +
          'console warning. The trigger still renders, still opens, and - because its empty-state ' +
          'line is gated on the query rather than on the response - still answers "No messages ' +
          'found" to anything typed into it, with no request ever made. So the popover you can ' +
          'open from these stories is chrome around a dead query. It is storied properly under ' +
          '**Chat/MessageSearch**, whose last story measures exactly that.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Marta Alvarez',
    statusText: 'Online',
    chat: { isClientChat: true, isGroupChat: false, sessionClosed: false, showPresence: true },
    info: { open: false, onToggle: fn() },
    session: { closing: false, onClose: fn() },
    onOpenGroupInfo: fn(),
  },
} satisfies Meta<typeof ChannelHeaderBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClientOnline: Story = {
  name: 'Client chat, online',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = headerOf(canvasElement);

    await expect(canvas.getByText('Marta Alvarez')).toBeInTheDocument();
    // Deterministic monogram from the same name - a wrong avatar here means the
    // header and the sidebar row disagree about who this thread is with.
    await expect(canvas.getByText('MA')).toBeInTheDocument();

    // Two dots when online: the avatar halo and the one in the status line.
    const dots = canvasElement.querySelectorAll('.chat-presence-dot');
    await expect(dots).toHaveLength(2);
    // Proves the keyframes actually reached the element rather than the class
    // merely being present. Reduced motion legitimately switches it off, so the
    // expectation follows the media query rather than assuming a value.
    const reduced = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await expect(getComputedStyle(dots[0]).animationName).toBe(reduced ? 'none' : 'ycPulseDot');

    // Search, info, Close session - and nothing else.
    await expect(actionNames(header)).toEqual([
      'Search messages',
      'Conversation info',
      'Close session',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday client thread. The name is `min-w-0 flex-1 truncate` at 13.5px bold, the ' +
          'status is 11.5px `--success-text`, and the whole bar is 44-48px tall depending on ' +
          'breakpoint - the actions are `shrink-0`, so the name is the only thing that gives way.',
      },
    },
  },
};

export const ClientOffline: Story = {
  name: 'Client chat, offline',
  args: {
    statusText: 'Last seen 2 hours ago',
    chat: { isClientChat: true, isGroupChat: false, sessionClosed: false, showPresence: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const subtitle = canvas.getByText('Last seen 2 hours ago');
    // A different ELEMENT, not a recoloured one - the offline line is a
    // `caption-2` Text, the online line a green flex row with a dot.
    await expect(subtitle.querySelector('.chat-presence-dot')).toBeNull();

    /* And it renders at 12px, not the 11px the component asks for. `globals.css`
       defines `.text-caption-2` a SECOND time outside any @layer, with
       `font-size: 0.75rem !important`, and an unlayered important rule beats the
       `text-[11px]` utility no matter the specificity. So the offline subtitle -
       meant to be the quietest line in the bar - is actually LARGER than the
       11.5px online one. Asserted as it really renders, because a story that
       asserted the intent would be red on shipping code and tell a reviewer
       nothing about what is on screen. */
    await expect(getComputedStyle(subtitle).fontSize).toBe('12px');
    await expect(subtitle).toHaveClass('text-[11px]');
    // No presence anywhere: the avatar halo goes with the status dot, since both
    // read the same `showPresence` flag.
    await expect(canvasElement.querySelectorAll('.chat-presence-dot')).toHaveLength(0);
    // The action cluster is unchanged - same controls, same order, only the
    // subtitle differs. Asserted by name rather than by count, because three
    // buttons in the wrong order would satisfy a count.
    await expect(actionNames(headerOf(canvasElement))).toEqual([
      'Search messages',
      'Conversation info',
      'Close session',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same thread with the counterpart offline. `statusText` carries a last-seen string ' +
          'instead of "Online", and the line is meant to drop to 11px `--ink-faint`.\n\n' +
          'It does not. The play function measures 12px, because `globals.css` redefines ' +
          '`.text-caption-2` outside any `@layer` with `font-size: 0.75rem !important`, which the ' +
          '`text-[11px]` utility on the same element cannot outrank. The offline subtitle is ' +
          'therefore the LARGEST status line in this bar - bigger than the 11.5px online one it is ' +
          'supposed to be quieter than. Nothing about the rendered bar reveals that; only the ' +
          'measurement does.',
      },
    },
  },
};

export const PresenceComparison: Story = {
  name: 'Online vs offline, side by side',
  render: (args) => (
    <div className="flex flex-col">
      <ChannelHeaderBar {...args} statusText="Online now" />
      <ChannelHeaderBar
        {...args}
        statusText="Last seen yesterday"
        chat={{ ...args.chat, showPresence: false }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const online = canvas.getByText('Online now');
    const offline = canvas.getByText('Last seen yesterday');

    /* The two subtitles are different elements, not one element with a swapped
       class, so this compares live computed colour rather than class names.
       Read inside waitFor: both lines sit in a `transition-colors` subtree and a
       synchronous read can land mid-interpolation. */
    await waitFor(() => {
      expect(getComputedStyle(online).color).not.toBe(getComputedStyle(offline).color);
    });
    // One presence dot in the status row plus one avatar halo, from the top bar only.
    await expect(canvasElement.querySelectorAll('.chat-presence-dot')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both presence states stacked, which is the only way to see how far apart the two ' +
          'subtitles really are. The online line is a green flex row with a dot; the offline line ' +
          'is a plain faint caption. Nothing else in the bar changes, so any visible difference in ' +
          'bar height between the two rows is a bug in the status block.',
      },
    },
  },
};

export const SessionClosed: Story = {
  name: 'Client chat, session closed',
  args: {
    statusText: 'Session ended 14:20',
    chat: { isClientChat: true, isGroupChat: false, sessionClosed: true, showPresence: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The badge replaces the action rather than sitting beside a disabled one -
    // and it is a static label, not a control, so it carries no button role.
    const badge = canvas.getByText('Session closed');
    await expect(badge.closest('button')).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Close session' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Closing…' })).not.toBeInTheDocument();
    // Search and info survive: a closed session is still readable and still has
    // a conversation-info drawer. Named, so a reordered cluster fails.
    await expect(actionNames(headerOf(canvasElement))).toEqual([
      'Search messages',
      'Conversation info',
    ]);
    // The subtitle carries the closing time; the badge says nothing about when.
    await expect(canvas.getByText('Session ended 14:20')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'After the vet closes the consultation. The `neutral` badge is a 10px uppercase ' +
          'micro-pill, so the trailing cluster loses its only `--cta` element and the bar goes ' +
          'visually flat - which is the intended signal that nothing here is actionable any more.',
      },
    },
  },
};

export const ClosingSession: Story = {
  name: 'Client chat, closing in flight',
  args: {
    session: { closing: true, onClose: fn() },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = canvas.getByRole('button', { name: 'Closing…' });
    // Really disabled, not just repainted: `isDisabled` reaches the DOM attribute.
    await expect(pill).toBeDisabled();
    await expect(pill).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.queryByRole('button', { name: 'Close session' })).not.toBeInTheDocument();
    // The dimming treatment, measured - `pointer-events-none opacity-60` is what
    // stops a second click reaching an in-flight request.
    const style = getComputedStyle(pill);
    await expect(style.opacity).toBe('0.6');
    await expect(style.pointerEvents).toBe('none');
    // Only the label swapped. The cluster keeps its members and its order, which
    // is why the row does not reflow while the request is out.
    await expect(actionNames(headerOf(canvasElement))).toEqual([
      'Search messages',
      'Conversation info',
      'Closing…',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The in-flight state of the close-session call, which lasts exactly as long as one API ' +
          'round trip and is therefore invisible in normal use. The label swaps to "Closing…" and ' +
          'the pill takes `pointer-events-none opacity-60` - so it dims in place rather than ' +
          'resizing, and the cluster does not reflow while the request is out.',
      },
    },
  },
};

export const GroupChat: Story = {
  name: 'Group chat',
  args: {
    title: 'Ward round · ICU',
    statusText: '6 members',
    chat: { isClientChat: false, isGroupChat: true, sessionClosed: false, showPresence: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = headerOf(canvasElement);

    // Search plus Group Info, in that order, and no client-chat controls.
    await expect(actionNames(header)).toEqual(['Search messages', 'Group Info']);
    await expect(
      canvas.queryByRole('button', { name: 'Conversation info' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText('Session closed')).not.toBeInTheDocument();

    // A group avatar is the people glyph, not initials - so "WR" must not appear.
    await expect(canvas.queryByText('WR')).not.toBeInTheDocument();
    await expect(canvas.getByText('Ward round · ICU')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A team group thread. The conversation-info drawer is client-only, so a group gets a ' +
          '`--cta` Group Info pill opening the member editor instead - two different surfaces ' +
          'behind two controls that occupy the same slot in the row.',
      },
    },
  },
};

export const InfoOpen: Story = {
  name: 'Info toggle pressed',
  args: { info: { open: true, onToggle: fn() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Conversation info' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    /* And nothing else changed, which is the finding rather than an aside. The
       open toggle is measured against the neighbouring search control, which is
       in its own resting state: same border colour, same transparent fill. If a
       pressed treatment is ever added, this is the assertion that fails. */
    const search = canvas.getByRole('button', { name: 'Search messages' });
    await waitFor(() => {
      const pressed = getComputedStyle(toggle);
      expect(pressed.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(pressed.borderTopColor).toBe(getComputedStyle(search).borderTopColor);
    });
    // Its geometry is untouched too - still the 30px circle, still last of the
    // three round controls in size.
    await expect(widthOf(toggle)).toBe(30);
    await expect(toggle.querySelector('svg')).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`aria-expanded` is the only thing that changes while the info drawer is open - the ' +
          'button keeps its resting border and ink. Worth flagging: a sighted user gets no ' +
          'indication from this control that the drawer they are looking at belongs to it.',
      },
    },
  },
};

export const InfoToggleFires: Story = {
  name: 'Info toggle fires',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Conversation info' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    // The bar is controlled, so the state lives in ChatContainer; the callback is
    // the whole contract this component owes it.
    await expect(args.info.onToggle).toHaveBeenCalledTimes(1);
    await expect(args.session.onClose).not.toHaveBeenCalled();
    /* And the bar does NOT update itself: `info.open` is still false, so
       aria-expanded is still false after a click that visibly "worked". A
       component that flipped it locally would drift out of step with the drawer
       ChatContainer actually renders. */
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // The click changed no other part of the row.
    await expect(actionNames(headerOf(canvasElement))).toEqual([
      'Search messages',
      'Conversation info',
      'Close session',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Confirms the two adjacent circular controls are wired to different handlers. They are ' +
          '6px apart and similar in size, so a swapped callback would close the consultation ' +
          'instead of opening a drawer and nothing on screen would look wrong.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: back control and three circle sizes',
  args: { back: { onBack: fn() } },
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and silently renders at full panel width instead.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const header = headerOf(canvasElement);

    const back = canvas.getByRole('button', { name: 'Back to conversations' });
    // First child of the header, ahead of the avatar - the design merged the old
    // separate back strip into this row.
    await expect(header.firstElementChild).toBe(back);

    await expect(actionNames(header)).toEqual([
      'Back to conversations',
      'Search messages',
      'Conversation info',
      'Close session',
    ]);

    /* Three round controls, three diameters, in one row. Measured rather than
       asserted from the class names, because that is the discrepancy: the design
       has one circular control size and this bar ships 34 / 36 / 30. */
    const search = canvas.getByRole('button', { name: 'Search messages' });
    const infoToggle = canvas.getByRole('button', { name: 'Conversation info' });
    await expect(widthOf(back)).toBe(34);
    await expect(widthOf(search)).toBe(36);
    await expect(widthOf(infoToggle)).toBe(30);
    // Square, not merely wide: an oval here would still satisfy the widths.
    await expect(Math.round(back.getBoundingClientRect().height)).toBe(34);

    await userEvent.click(back);
    await expect(args.back?.onBack).toHaveBeenCalledTimes(1);
  },
  parameters: {
    /* The viewport global alone is not enough - see the long note on **Phone:
       long name truncates**. Under `layout: 'centered'` the 640px `HeaderFrame`
       keeps `#storybook-root` 672px wide inside the 375px window, so both phone
       stories were drawing the DESKTOP bar. These three circles happen to be
       fixed sizes and measured the same either way, which is precisely why
       nothing here caught it. */
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'The phone bar. `back` is passed only below the `md` breakpoint, so on desktop this ' +
          'control does not exist at all. At 375px the row is back + avatar + name + three ' +
          'trailing controls, and the padding drops from `px-4 py-3` to `px-3.5 py-2.5`.',
      },
    },
  },
};

export const PhoneLongTitle: Story = {
  name: 'Phone: long name truncates',
  args: {
    title: 'Konstantina Papadopoulou-Fitzgerald',
    statusText: 'Last seen 3 days ago',
    chat: { isClientChat: true, isGroupChat: false, sessionClosed: false, showPresence: false },
    back: { onBack: fn() },
  },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText('Konstantina Papadopoulou-Fitzgerald');
    const header = headerOf(canvasElement);

    /* THE PREMISE, asserted rather than assumed - everything below is a claim
       about a row that is too narrow, so a frame that quietly rendered at
       desktop width would make all of it vacuous.

       Which is what was happening. The mobile viewport global is honoured, but
       `layout: 'centered'` sizes `#storybook-root` shrink-to-fit and
       `HeaderFrame`'s `w-[640px]` is a min-content floor the root cannot go
       below: root stayed 672px wide inside the 375px window, `max-w-full` never
       bit, and this "phone" story drew the 640px DESKTOP bar. The name then got
       a 317px column, its 260px of text fitted, and the overflow assertion
       below compared 317 to 317 - a story that read as an off-by-one but was
       really the viewport never reaching the component. `layout: 'fullscreen'`
       on this story is the fix; this line is what fails loudly if it regresses. */
    await expect(widthOf(header)).toBeLessThanOrEqual(375);

    /* `truncate` is three declarations, and it no-ops whenever an unlayered
       plain-CSS rule wins over the utility - which has bitten this codebase
       before, and `ChatContainer.css` is exactly that kind of unlayered sheet.
       So this reads the computed values rather than trusting the class. */
    const style = getComputedStyle(title);
    await expect(style.textOverflow).toBe('ellipsis');
    await expect(style.overflow).toBe('hidden');
    await expect(style.whiteSpace).toBe('nowrap');

    /* And the name is genuinely clipped, not merely styled to clip. Measured
       against the text's OWN laid-out width - a Range over the text node
       reports the ~260px the name needs against the ~52px column it is given -
       because `scrollWidth` and `clientWidth` are integers, so a real overflow
       under a pixel reads back as equal and a truncation bug would pass. */
    const laidOut = document.createRange();
    laidOut.selectNodeContents(title);
    await expect(laidOut.getBoundingClientRect().width).toBeGreaterThan(
      title.getBoundingClientRect().width
    );
    await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);

    /* Pinned to CURRENT behaviour, not to intent (issue #2297). The name asks
       for 13.5px/700 through `text-[13.5px] font-bold`; at <=768px `globals.css`
       redefines `.text-body-3-emphasis` outside any `@layer` with
       `font-size: 1rem !important; font-weight: 500 !important`, and an
       unlayered important rule beats any utility. So the PHONE header draws the
       name at 16px/500 - larger and lighter than the 14.5px bold desktop one it
       is supposed to be a compact version of, and 3px of extra type in the row
       that has the least width to give. The losing classes are asserted next to
       the measured values so the contradiction is in the failure output. */
    await expect(title).toHaveClass('text-body-3-emphasis', 'text-[13.5px]', 'font-bold');
    await expect(style.fontSize).toBe('16px');
    await expect(style.fontWeight).toBe('500');

    // The controls kept their size instead of being squeezed by the long name.
    const search = canvas.getByRole('button', { name: 'Search messages' });
    await expect(widthOf(search)).toBe(36);
    await expect(widthOf(canvas.getByRole('button', { name: 'Back to conversations' }))).toBe(34);
    // And the whole cluster still fits inside the 375px bar rather than
    // overflowing it, which is the failure a long name would cause.
    await expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth + 1);
  },
  /* Not decoration: `centered` centres by making `#storybook-root` shrink-to-fit,
     and a fixed-width child then sets a min-content floor that the mobile
     viewport cannot push it below. `fullscreen` is what lets `max-w-full` on
     `HeaderFrame` actually collapse the frame to 375px. */
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'The worst case for this row: a long double-barrelled name, a back control and the full ' +
          'client cluster on a 375px screen. The name is the only `min-w-0 flex-1` element, so it ' +
          'is what clips; everything else is `shrink-0`. If a control ever appears squashed here, ' +
          'the flex minimums are wrong rather than the name being too long.\n\n' +
          'The bar itself is sound: given a real 375px row the name takes a 52px column and lays ' +
          'out 260px of text behind an ellipsis, and the cluster still fits. Two things this story ' +
          'measures are not.\n\n' +
          "First, the story was not a phone. `layout: 'centered'` plus the 640px `HeaderFrame` " +
          'held `#storybook-root` at 672px inside the 375px window, so the mobile viewport never ' +
          'reached the component and the "phone" bar was the desktop bar. The play function now ' +
          'asserts its own premise before measuring anything.\n\n' +
          'Second, the name renders at 16px/500 here, not the 13.5px/700 it asks for: below 768px ' +
          '`globals.css` redefines `.text-body-3-emphasis` outside any `@layer` with ' +
          '`font-size: 1rem !important; font-weight: 500 !important` (issue #2297). The phone ' +
          'header therefore sets the name LARGER and lighter than the desktop one, in the row with ' +
          'the least width to spare - which is also why it clips this early.',
      },
    },
  },
};
