import { useMemo, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { StreamChat } from 'stream-chat';
import {
  ChannelStateProvider,
  ChatProvider,
  MessageInputContextProvider,
  type ChannelStateContextValue,
  type ChatContextValue,
  type MessageInputContextValue,
} from 'stream-chat-react';

import { ChatShareContext } from './chatShareContext';
import ChatComposer from './ChatComposer';

const CHANNEL_ID = 'appointment-poppy-812';

/**
 * A real `StreamChat` client and a real `Channel`, both built offline.
 *
 * `ChatComposer` calls `useMessageComposer()`, which constructs a genuine
 * `MessageComposer` out of the chat and channel contexts - so unlike the other
 * chat stories in this folder, a two-key cast is not enough here: the emoji
 * insert and the quick replies go through `textComposer`, and a stub would prove
 * nothing about either.
 *
 * `client.channel()` refuses to build a channel until a user is connected, and
 * connecting opens a websocket. Setting `userID` directly clears that guard
 * without any network at all - the constructor itself never calls out, and
 * nothing in these stories sends a message.
 */
const buildClient = () => {
  const client = new StreamChat('storybook-no-network');
  client.userID = 'u-vet';
  client.user = { id: 'u-vet', name: 'Dr. Amelia Hart' };
  return client;
};

type HarnessProps = { openShare: (channelId: string) => void; handleSubmit: () => void };

const Harness = ({ openShare, handleSubmit }: HarnessProps) => {
  // Built once: `useMessageComposer` memoises on the channel identity, so a fresh
  // channel each render would throw away the composer (and its text) every time.
  const { client, channel } = useMemo(() => {
    const streamClient = buildClient();
    return {
      client: streamClient,
      channel: streamClient.channel('messaging', CHANNEL_ID),
    };
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chat = { client } as unknown as ChatContextValue;
  const channelState = { channel } as unknown as ChannelStateContextValue;
  /* `textareaRef` is dereferenced by `TextareaComposer` on every keystroke, so it
     has to be a real ref object rather than part of the cast. */
  const messageInput = {
    handleSubmit,
    textareaRef,
    cooldownRemaining: undefined,
  } as unknown as MessageInputContextValue;

  const share = useMemo(() => ({ openShare }), [openShare]);

  return (
    <ChatProvider value={chat}>
      <ChannelStateProvider value={channelState}>
        <MessageInputContextProvider value={messageInput}>
          <ChatShareContext.Provider value={share}>
            <div className="w-full max-w-[560px] bg-[var(--screen)]">
              <ChatComposer />
            </div>
          </ChatShareContext.Provider>
        </MessageInputContextProvider>
      </ChannelStateProvider>
    </ChatProvider>
  );
};

const meta = {
  title: 'Chat/ChatComposer',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The message composer, and the two popovers hanging off it that nothing had ever ' +
          'drawn. Both are plain `useState` booleans on a component that is only mounted as ' +
          "Stream's `<MessageInput Input={ChatComposer} />`, for an open, non-frozen channel - " +
          'so reviewing either one meant running the real app against a real channel.\n\n' +
          'Neither popover is a menu in the accessibility sense. They are `absolute bottom-11` ' +
          'divs with no `role`, no `aria-expanded` on the trigger and no focus management, ' +
          'backed by a `fixed inset-0` transparent button labelled "Close menu" that catches the ' +
          'next click anywhere on the page. That click-catcher is the whole dismissal mechanism: ' +
          'there is no Escape handler and no outside-click listener, so the popovers behave ' +
          'differently from every `Modal` in PIMS.\n\n' +
          'The two are mutually exclusive by construction rather than by state - each trigger ' +
          'calls `closeAll()` before toggling itself - which is why opening one while the other ' +
          'is up closes the first rather than stacking a second `fixed inset-0` catcher over the ' +
          'page.\n\n' +
          'The stories run against a real `MessageComposer` built offline, so the emoji insert ' +
          'and the quick replies actually move text through `textComposer` instead of proving ' +
          'that a click handler fired.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    openShare: fn(),
    handleSubmit: fn(),
  },
  globals: { viewport: { value: 'tablet', isRotated: false } },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The transparent full-screen dismissal button behind whichever popover is open. */
const clickCatcher = (): HTMLElement => {
  const el = document.querySelector('button[aria-label="Close menu"]');
  if (!el) throw new Error('No "Close menu" click-catcher is mounted.');
  return el as HTMLElement;
};

export const Resting: Story = {
  name: 'Resting (both popovers closed)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The five quick replies, by their exact labels. They are a horizontal
    // scroller (`overflow-x-auto`), so on a narrow channel the last two are off
    // screen rather than wrapped onto a second line.
    await expect(canvas.getByText('Quick replies')).toBeInTheDocument();
    for (const label of [
      'Appointment confirmed',
      'Arrive 10 min early',
      'Results ready',
      'Share a photo',
      'We will reply soon',
    ]) {
      await expect(canvas.getByRole('button', { name: label })).toBeInTheDocument();
    }

    /* Exactly five, in the scroller that owns them: a sixth template added
       without widening the row would be invisible off the right edge, and a
       count is the only assertion that notices. */
    const scroller = canvas.getByText('Quick replies').parentElement;
    if (!scroller) throw new Error('The quick-reply row did not render.');
    await expect(scroller.querySelectorAll('button')).toHaveLength(5);
    await expect(getComputedStyle(scroller).overflowX).toBe('auto');

    await expect(canvas.getByPlaceholderText('Write a message…')).toHaveValue('');
    await expect(canvas.getByRole('button', { name: 'Add attachment' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Emoji' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeEnabled();

    /* The mic is permanently disabled and always has been - it is a placeholder
       for a feature that does not exist. It reads as an available control at a
       glance, which is exactly why it belongs in the resting story. */
    await expect(canvas.getByRole('button', { name: 'Voice message' })).toBeDisabled();

    await expect(canvas.queryByText('Share from PIMS')).not.toBeInTheDocument();
    await expect(document.querySelector('button[aria-label="Close menu"]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default state. The field is a 42px-min pill on `--field-bg` holding the textarea, ' +
          'the emoji glyph and the disabled mic; the paperclip sits outside it on the left and ' +
          'the send circle outside it on the right.',
      },
    },
  },
};

export const AttachmentMenu: Story = {
  name: 'Attachment menu (open)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Add attachment' });
    await userEvent.click(trigger);

    // Three rows, in order, each with its own blue glyph.
    const photo = await canvas.findByText('Photo');
    await expect(canvas.getByText('Document')).toBeInTheDocument();
    await expect(canvas.getByText('Share from PIMS')).toBeInTheDocument();

    const panel = photo.closest('div.absolute');
    if (!panel) throw new Error('The attachment panel is not absolutely positioned.');
    await expect(panel.querySelectorAll('button')).toHaveLength(3);

    /* getBoundingClientRect, not getComputedStyle().width: the panel is bordered,
       so the content box reads 174 where `w-44` means 176. */
    await expect(panel.getBoundingClientRect().width).toBe(176);

    /* The catcher is BEHIND the panel and IN FRONT of everything else. If those
       two z-indexes ever equalled each other the rows would stop being clickable
       while still being perfectly visible, which is the kind of regression a
       screenshot cannot show. */
    const catcher = clickCatcher();
    await expect(getComputedStyle(catcher).position).toBe('fixed');
    await expect(getComputedStyle(catcher).zIndex).toBe('10');
    await expect(getComputedStyle(panel).zIndex).toBe('20');

    /* The trigger flips to the `active` tint. Polled: the button carries
       `transition-colors`, so one synchronous read lands mid-interpolation. */
    await waitFor(() => {
      expect(getComputedStyle(trigger).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opens upward from the paperclip (`bottom-11 left-0`), which is the only direction ' +
          'that works - the composer is pinned to the bottom of the window. The panel is not ' +
          'portalled, so it is clipped by any scrolling ancestor the composer is dropped into.',
      },
    },
  },
};

export const AttachmentMenuDismissal: Story = {
  name: 'Attachment menu dismissed by the catcher',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add attachment' }));
    const documentRow = await canvas.findByText('Document');
    await expect(documentRow).toBeInTheDocument();

    /* The catcher is `fixed inset-0`, so it spans the whole viewport and the panel
       sits ON TOP of part of it. `userEvent.click` aims at the element's centre and
       refuses to act when something covers that point, which is a property of the
       harness rather than of the component - `fireEvent` dispatches the click React
       actually listens for without that geometry check. */
    const catcher = clickCatcher();
    const rect = catcher.getBoundingClientRect();
    await expect(rect.width).toBe(globalThis.innerWidth);
    await expect(rect.height).toBe(globalThis.innerHeight);

    fireEvent.click(catcher);
    await waitFor(() => {
      expect(canvas.queryByText('Document')).not.toBeInTheDocument();
    });

    /* Escape does nothing here, and that is the finding rather than an oversight
       in the story: the popover installs no key handler at all, so a keyboard
       user who opens it has no way to dismiss it except by clicking. */
    await userEvent.click(canvas.getByRole('button', { name: 'Add attachment' }));
    const reopened = await canvas.findByText('Document');
    await expect(reopened).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByText('Document')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The catcher covers the whole viewport, so any click outside the three rows closes ' +
          'the panel - including a click on the send button, which therefore needs two presses ' +
          'while the panel is open. Escape is not wired up.',
      },
    },
  },
};

export const EmojiGrid: Story = {
  name: 'Emoji grid (open)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emoji' }));

    const first = await canvas.findByRole('button', { name: '👍' });
    const grid = first.closest('div.absolute');
    if (!grid) throw new Error('The emoji panel is not absolutely positioned.');

    // Ten emoji, and the set itself is the design - clinic-specific glyphs (paw,
    // pill, clock) sit alongside the generic ones.
    await expect(grid.querySelectorAll('button')).toHaveLength(10);
    await expect([...grid.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      '👍',
      '🙏',
      '❤️',
      '😊',
      '🎉',
      '✅',
      '⏰',
      '🐾',
      '💊',
      '📎',
    ]);

    // `w-56` with `flex-wrap`: five per row at 36px plus the 4px gaps.
    await expect(grid.getBoundingClientRect().width).toBe(224);
    await expect(getComputedStyle(grid).flexWrap).toBe('wrap');
    await expect(getComputedStyle(grid).zIndex).toBe('20');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Anchored to the right edge of the field (`bottom-11 right-0`) rather than to the ' +
          'emoji button itself, so it hangs over the send circle. Ten glyphs, no search, no ' +
          'categories - it is a shortcut row, not a picker.',
      },
    },
  },
};

export const EmojiInsertsIntoTheDraft: Story = {
  name: 'Emoji inserts into the draft',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emoji' }));
    await userEvent.click(await canvas.findByRole('button', { name: '🐾' }));

    /* The real `textComposer`, not a spy: `insertText` is async (it runs the
       composition middleware), so the value lands a tick after the click and a
       synchronous read would find the field still empty. */
    const textarea = canvas.getByPlaceholderText('Write a message…');
    await waitFor(() => {
      expect(textarea).toHaveValue('🐾');
    });

    // Picking one closes the grid; there is no multi-select.
    await waitFor(() => {
      expect(canvas.queryByRole('button', { name: '💊' })).not.toBeInTheDocument();
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Insertion goes through `textComposer.insertText`, which respects the current cursor ' +
          'position, so an emoji picked mid-sentence lands at the caret rather than being ' +
          'appended.',
      },
    },
  },
};

export const OnePopoverAtATime: Story = {
  name: 'Opening one closes the other',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add attachment' }));
    const shareRow = await canvas.findByText('Share from PIMS');
    await expect(shareRow).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Emoji' }));
    const thumbsUp = await canvas.findByRole('button', { name: '👍' });
    await expect(thumbsUp).toBeInTheDocument();

    /* Both `closeAll()` calls matter. Without them the page would carry two
       `fixed inset-0` catchers, and the lower one would keep swallowing clicks
       after the visible panel had gone. */
    await expect(canvas.queryByText('Share from PIMS')).not.toBeInTheDocument();
    await expect(document.querySelectorAll('button[aria-label="Close menu"]')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The exclusivity is enforced in the two click handlers, not by a single "which panel" ' +
          'state, so any third popover added to this row has to remember to call `closeAll` too.',
      },
    },
  },
};

export const ShareFromPims: Story = {
  name: 'Share from PIMS',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add attachment' }));
    await userEvent.click(await canvas.findByText('Share from PIMS'));

    /* The row hands the CHANNEL id up to ChatContainer, which owns the picker
       modal - the composer itself never renders it. Asserting the id rather than
       "it was called" is what proves the right conversation gets the shared
       record attached to it. */
    await expect(args.openShare).toHaveBeenCalledWith(CHANNEL_ID);

    await waitFor(() => {
      expect(canvas.queryByText('Photo')).not.toBeInTheDocument();
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The third attachment row is the only one that is not a file picker: it opens the ' +
          'PIMS entity picker through `ChatShareContext`. If the channel has no `id` the row ' +
          'silently closes the panel and does nothing at all.',
      },
    },
  },
};

export const QuickReplyReplacesTheDraft: Story = {
  name: 'Quick reply replaces the draft',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Write a message…');

    /* Two templates rather than typed text: `textComposer.handleChange` is async,
       so `userEvent.type` races the controlled value character by character and a
       garbled draft would fail this story for a reason that has nothing to do with
       the behaviour under test. */
    await userEvent.click(canvas.getByRole('button', { name: 'Appointment confirmed' }));
    await waitFor(() => {
      expect(textarea).toHaveValue('Your appointment is confirmed.');
    });

    await userEvent.click(canvas.getByRole('button', { name: 'Results ready' }));

    /* `setText`, not `insertText`: a quick reply DISCARDS whatever was typed
       rather than appending to it, with no confirmation and no undo. That is the
       behaviour worth seeing before deciding whether it is the intended one.
       The em dash in the expected string is the one `TEMPLATES` ships in
       ChatComposer.tsx - it is copied, not written here, so do not "fix" it to a
       hyphen without changing the source first. */
    await waitFor(() => {
      expect(textarea).toHaveValue('Your results are ready — let us discuss them.');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Templates are pills above the field, always visible rather than behind a menu. A ' +
          'second press overwrites the first without a confirmation, so the pills are a ' +
          'starting point rather than a snippet library.',
      },
    },
  },
};
