import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  ChannelActionProvider,
  MessageProvider,
  type ChannelActionContextValue,
  type MessageContextValue,
} from 'stream-chat-react';

import { ChatMessage } from './ChatMessage';
import type { SharedEntityData } from './SharedEntityCard';

/**
 * Everything `ChatMessage` renders comes out of two Stream contexts, so the fixture is
 * those two contexts and nothing else - no client, no channel, no socket, no token.
 * The component reads five keys off `MessageContext` (`message`, `isMyMessage`,
 * `handleReaction`, `handleOpenThread`, `readBy`) and two off `ChannelActionContext`
 * (`editMessage`, `deleteMessage`); the rest of both types is required by Stream and
 * never touched here, which is why each value is cast rather than filled in.
 */
type HarnessProps = {
  mine: boolean;
  text: string;
  senderName: string;
  createdAt: string;
  firstOfGroup?: boolean;
  deleted?: boolean;
  seen?: boolean;
  reactionGroups?: Record<string, { count?: number }>;
  ownReactions?: { type?: string }[];
  sharedEntity?: SharedEntityData;
  handleReaction: (emoji: string, event: unknown) => void;
  handleOpenThread: (event: unknown) => void;
  editMessage: (message: unknown) => void;
  deleteMessage: (message: unknown) => void;
};

const Harness = ({
  mine,
  text,
  senderName,
  createdAt,
  firstOfGroup,
  deleted,
  seen,
  reactionGroups,
  ownReactions,
  sharedEntity,
  handleReaction,
  handleOpenThread,
  editMessage,
  deleteMessage,
}: HarnessProps) => {
  const message = {
    id: 'msg-1',
    text,
    type: deleted ? 'deleted' : 'regular',
    created_at: new Date(createdAt),
    user: { id: mine ? 'me' : 'them', name: senderName },
    attachments: [],
    reaction_groups: reactionGroups,
    own_reactions: ownReactions,
    ...(deleted ? { deleted_at: createdAt } : {}),
    ...(sharedEntity ? { sharedEntity } : {}),
  };

  return (
    <ChannelActionProvider
      value={{ editMessage, deleteMessage } as unknown as ChannelActionContextValue}
    >
      <MessageProvider
        value={
          {
            message,
            isMyMessage: () => mine,
            handleReaction,
            handleOpenThread,
            readBy: seen ? [{ id: 'them' }] : [],
          } as unknown as MessageContextValue
        }
      >
        <ChatMessage firstOfGroup={firstOfGroup} />
      </MessageProvider>
    </ChannelActionProvider>
  );
};

/**
 * The popovers are `createPortal`ed to `document.body`, so nothing they render is inside
 * `canvasElement` and a canvas-scoped query finds nothing however long it retries. They
 * are also the only direct `<body>` children carrying these two classes, which makes a
 * count of them the honest way to assert "exactly one popover is open".
 */
const openPanels = (): HTMLElement[] =>
  [...document.body.children].filter((el): el is HTMLElement =>
    el.matches('div.rounded-full, div.w-36')
  );

const body = () => within(document.body);

/**
 * The meta line is formatted through `formatDateInPreferredTimeZone`, which reads a
 * localStorage token and falls back to Europe/Berlin. Cleared for the story and restored
 * afterwards so the clock does not depend on which story ran before this one: 09:15Z is
 * 10:15 in Berlin on 26 March 2026.
 */
const pinnedTimeZone = () => {
  const key = 'yc_preferred_timezone';
  const previous = window.localStorage.getItem(key);
  window.localStorage.removeItem(key);
  return () => {
    if (previous !== null) window.localStorage.setItem(key, previous);
  };
};

const meta = {
  title: 'Chat/ChatMessage',
  component: Harness,
  decorators: [
    (Story) => (
      <div className="w-[560px] bg-[var(--screen)] p-4 pb-32">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One row of the message thread, and the three surfaces hanging off it that nothing had ' +
          'ever drawn: the **reaction picker**, the **edit/delete menu** and the **inline ' +
          'editor**.\n\n' +
          'All three are module-private (`MessageActions`, `AnchoredPopover`, `MessageEditor` are ' +
          'not exported), so they are driven through the real `ChatMessage` rather than exported ' +
          'for the sake of a story. That costs two context providers and nothing else.\n\n' +
          'They are hidden three times over, which is why they had never been reviewed. The whole ' +
          'action strip is `opacity-0` until `group-hover`, so at rest the row shows no ' +
          'affordance at all. The picker and the menu are then gated on their own state. And ' +
          'both panels are **portalled to `document.body`** - deliberately, because Stream’s ' +
          'message list is `overflow: auto` and would clip them - which means they are outside ' +
          '`canvasElement` and outside every snapshot ever taken of this component.\n\n' +
          'The positioning is measured, not declared. `useAnchoredPopoverStyle` renders the panel ' +
          'hidden at 0,0 first, measures it, then places it 6px below the trigger - flipping it ' +
          '6px **above** when there is no room before the viewport bottom, which is the ' +
          'last-message case that used to crop the picker. It also aligns left for incoming ' +
          'messages and right for outgoing ones, and clamps to an 8px viewport margin. Every one ' +
          'of those numbers is asserted below, because a measurement pass that silently fails ' +
          'leaves the panel at 0,0 - top-left of the screen, still "rendered", still passing any ' +
          'test that only checks it appeared.\n\n' +
          '`closeAll()` before each open is what keeps the picker and the menu mutually ' +
          'exclusive; there is a story for that too, since two open panels overlap each other ' +
          'exactly.\n\n' +
          'The editor is the one piece with a commit rule: `save()` fires `editMessage` **only** ' +
          'when the trimmed text differs from the original, and otherwise cancels. Enter saves, ' +
          'Escape cancels. Because the message here is a static fixture rather than a live Stream ' +
          'message, a successful save closes the editor and the bubble shows the original text ' +
          'again - in the app the Stream state update is what puts the new text back.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    mine: false,
    text: 'Bloodwork is back and the panel is clean.',
    senderName: 'Dr. Amelia Hart',
    createdAt: '2026-03-26T09:15:00.000Z',
    handleReaction: fn(),
    handleOpenThread: fn(),
    editMessage: fn(),
    deleteMessage: fn(),
  },
  beforeEach: pinnedTimeZone,
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Incoming: Story = {
  name: 'Incoming (actions invisible at rest)',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Bloodwork is back and the panel is clean.')).toBeInTheDocument();
    await expect(canvas.getByText('10:15 AM')).toBeInTheDocument();

    // Two actions for someone else's message, and no third one.
    const react = canvas.getByRole('button', { name: 'React' });
    await expect(canvas.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();

    // The strip is in the DOM and fully transparent - present to the accessibility tree
    // and to the keyboard, invisible to the eye until the row is hovered. Nothing else
    // in this component depends on hover, so this is the one thing a static review of
    // the row cannot see.
    const strip = react.parentElement as HTMLElement;
    await waitFor(() => {
      expect(getComputedStyle(strip).opacity).toBe('0');
    });

    await userEvent.click(canvas.getByRole('button', { name: 'Reply' }));
    await expect(args.handleOpenThread).toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting row: avatar gutter, `--inset` bubble with a `--divider` edge and a 4px ' +
          'bottom-left corner, and the time under it. The React and Reply buttons occupy their ' +
          'space at zero opacity, which is why the bubble does not shift sideways when the row ' +
          'is hovered.',
      },
    },
  },
};

export const ReactionPicker: Story = {
  name: 'Reaction picker',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'React' });
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(openPanels()).toHaveLength(1);
    });
    const [panel] = openPanels();

    // Portalled: querying the canvas for it would retry forever.
    await expect(canvasElement.contains(panel)).toBe(false);

    // Six emoji, in the order `REACTION_EMOJIS` declares them. Asserting the sequence
    // rather than the count catches a reordering, which changes muscle memory for every
    // user of the thread.
    const emoji = within(panel)
      .getAllByRole('button')
      .map((button) => button.textContent);
    await expect(emoji).toEqual(['👍', '❤️', '😂', '🎉', '🙏', '✅']);

    // The measurement pass ran: the panel is visible (it renders hidden first), sits 6px
    // under the trigger, and is left-aligned to it because this is an incoming message.
    // A failed measure leaves it hidden at 0,0 while still being "in the document".
    const panelRect = panel.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    await expect(getComputedStyle(panel).visibility).toBe('visible');
    await expect(panelRect.top).toBeCloseTo(triggerRect.bottom + 6, 0);
    await expect(panelRect.left).toBeCloseTo(triggerRect.left, 0);

    await userEvent.click(within(panel).getByRole('button', { name: '🎉' }));
    await expect(args.handleReaction).toHaveBeenCalledWith('🎉', expect.anything());
    // Picking closes it - the picker is not a palette you stay in.
    await waitFor(() => {
      expect(openPanels()).toHaveLength(0);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The picker open under the React button: a `rounded-full` bar of six 32px emoji ' +
          'buttons on `--screen` with a two-layer shadow. The emoji **is** the Stream reaction ' +
          'type - there is no code mapping in between - so this list is also the vocabulary the ' +
          'API stores.',
      },
    },
  },
};

export const ReactionPickerFlipsUp: Story = {
  name: 'Reaction picker flips above the trigger',
  decorators: [
    // Pins the row to the bottom of the VIEWPORT, which is where the last message in a
    // real thread sits and the only place the flip happens. `fixed` rather than a tall
    // spacer on purpose: the meta decorator wraps this one, so an in-flow height would
    // still leave the row 100+px clear of the bottom edge and the flip would never fire -
    // the story would pass while proving the opposite of its name.
    (Story) => (
      <div className="fixed inset-x-0 bottom-0 flex justify-center bg-[var(--screen)] p-3">
        <div className="w-[560px]">
          <Story />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'React' });
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(openPanels()).toHaveLength(1);
    });
    const [panel] = openPanels();
    const panelRect = panel.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    // Flipped: 6px ABOVE the trigger rather than below it, and still fully on screen.
    await expect(panelRect.bottom).toBeCloseTo(triggerRect.top - 6, 0);
    await expect(panelRect.top).toBeGreaterThanOrEqual(8);
    await expect(panelRect.bottom).toBeLessThanOrEqual(window.innerHeight);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same picker on the last message in a thread. Without the flip the panel is drawn ' +
          'below the viewport edge and the bottom two rows of a conversation cannot be reacted ' +
          'to at all - a bug that only exists at one scroll position, which is why it survived ' +
          'until it was drawn deliberately.',
      },
    },
  },
};

export const OwnMessageMenu: Story = {
  name: 'Edit/delete menu (own message)',
  args: { mine: true, senderName: 'Dr. Weber', text: 'Sending the discharge notes now.' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Own messages get the meta line with the sender appended, and a read receipt.
    await expect(canvas.getByText('10:15 AM · Dr. Weber')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Sent')).toBeInTheDocument();

    const trigger = canvas.getByRole('button', { name: 'More' });
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(openPanels()).toHaveLength(1);
    });
    const [panel] = openPanels();

    // Exactly two rows. A menu that grew a third item silently would still satisfy a
    // "the menu opened" assertion.
    const items = within(panel).getAllByRole('button');
    await expect(items.map((item) => item.textContent)).toEqual(['Edit', 'Delete']);

    // Right-aligned to the trigger, because this is an outgoing message and the panel
    // would otherwise hang off the right edge of the thread column.
    const panelRect = panel.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    await expect(panelRect.right).toBeCloseTo(triggerRect.right, 0);

    // Delete is the only destructive row in the thread and carries `--danger-text`.
    // Polled and resolved through a probe: the token differs between themes, and the
    // row has `transition-colors`, so one synchronous read can catch a mid-transition
    // value.
    const deleteRow = items[1];
    const probe = document.createElement('span');
    probe.style.color = 'var(--danger-text)';
    panel.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    await waitFor(() => {
      expect(getComputedStyle(within(deleteRow).getByText('Delete')).color).toBe(danger);
    });

    await userEvent.click(deleteRow);
    await expect(args.deleteMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg-1', text: 'Sending the discharge notes now.' })
    );
    // Choosing a row closes the menu; deletion is not confirmed anywhere in this
    // component, so the press is the commit.
    await waitFor(() => {
      expect(openPanels()).toHaveLength(0);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The `w-36` menu under the kebab, which only exists for your own messages. Worth ' +
          'noting what is *not* here: no confirmation step for Delete, and no "delete for ' +
          'everyone" distinction - one press calls `deleteMessage` and Stream tombstones the ' +
          'message for the whole channel.',
      },
    },
  },
};

export const EditFlow: Story = {
  name: 'Inline editor (commits a change)',
  args: { mine: true, senderName: 'Dr. Weber', text: 'Recheck on Tuesday.' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'More' }));
    await userEvent.click(await body().findByRole('button', { name: 'Edit' }));

    // The editor REPLACES the bubble rather than overlaying it, so the original text is
    // gone from the row and lives only in the field.
    const field = await canvas.findByLabelText<HTMLInputElement>('Edit message');
    await expect(field.value).toBe('Recheck on Tuesday.');
    await expect(canvas.queryByText('Recheck on Tuesday.')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save edit' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel edit' })).toBeInTheDocument();

    await userEvent.clear(field);
    await userEvent.type(field, 'Recheck on Wednesday.{Enter}');

    await expect(args.editMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg-1', text: 'Recheck on Wednesday.' })
    );
    // Enter closes the editor. The bubble comes back carrying the ORIGINAL text, because
    // the message object is a fixture here - in the app the Stream state update that
    // follows `editMessage` is what replaces it.
    await waitFor(() => {
      expect(canvas.queryByLabelText('Edit message')).not.toBeInTheDocument();
    });
    await expect(canvas.getByText('Recheck on Tuesday.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The editor is a `--blue`-bordered pill with a fixed `w-48` field and the two icon ' +
          'buttons the rest of the row uses. It is narrower than most bubbles, so a long message ' +
          'edits inside a field that scrolls rather than growing - which is the thing to judge ' +
          'here.',
      },
    },
  },
};

export const EditCommitsOnlyRealChanges: Story = {
  name: 'Inline editor (no-op saves)',
  args: { mine: true, senderName: 'Dr. Weber', text: 'Recheck on Tuesday.' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const openEditor = async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'More' }));
      await userEvent.click(await body().findByRole('button', { name: 'Edit' }));
      return canvas.findByLabelText<HTMLInputElement>('Edit message');
    };

    // 1. Enter on untouched text: `save()` compares against the original and cancels.
    let field = await openEditor();
    await userEvent.type(field, '{Enter}');
    await waitFor(() => {
      expect(canvas.queryByLabelText('Edit message')).not.toBeInTheDocument();
    });
    await expect(args.editMessage).not.toHaveBeenCalled();

    // 2. Emptied field: the trimmed value is falsy, so it cancels rather than posting an
    // empty message. This is the only guard against blanking a message by accident.
    field = await openEditor();
    await userEvent.clear(field);
    await userEvent.click(canvas.getByRole('button', { name: 'Save edit' }));
    await expect(args.editMessage).not.toHaveBeenCalled();

    // 3. Escape abandons a real change - typed text is discarded, not committed.
    field = await openEditor();
    await userEvent.type(field, ' Bring the medication box.');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(canvas.queryByLabelText('Edit message')).not.toBeInTheDocument();
    });
    await expect(args.editMessage).not.toHaveBeenCalled();
    await expect(canvas.getByText('Recheck on Tuesday.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three ways out of the editor that must all leave the message alone: saving without ' +
          'typing, saving an emptied field, and Escape after a real edit. All three take the ' +
          '`onCancel` path, so none of them shows an "edited" marker or fires a request - which ' +
          'matters because Stream stamps `message_updated` on every edit and clinics read that ' +
          'as a record change.',
      },
    },
  },
};

export const OnePopoverAtATime: Story = {
  name: 'Picker and menu are mutually exclusive',
  args: { mine: true, senderName: 'Dr. Weber' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'React' }));
    await waitFor(() => {
      expect(openPanels()).toHaveLength(1);
    });
    await expect(body().getByRole('button', { name: '👍' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'More' }));
    // Still one panel, and it is the menu: `closeAll()` runs before the open, and the
    // outside-mousedown dismissal on the picker fires for the same click. Two panels
    // here would overlap each other exactly, since both anchor to the same row.
    await waitFor(() => {
      expect(openPanels()).toHaveLength(1);
    });
    await expect(body().getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    await expect(body().queryByRole('button', { name: '👍' })).not.toBeInTheDocument();

    // And back the other way.
    await userEvent.click(canvas.getByRole('button', { name: 'React' }));
    await waitFor(() => {
      expect(openPanels()).toHaveLength(1);
    });
    await expect(body().queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both popovers anchor to buttons 28px apart and are placed by the same hook, so if ' +
          'both could be open they would sit on top of each other with the second one winning on ' +
          'z-order alone. Two independent mechanisms prevent it and this story exercises both at ' +
          'once.',
      },
    },
  },
};

export const PopoverDismissal: Story = {
  name: 'Dismissing the picker',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'React' });

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(openPanels()).toHaveLength(1);
    });
    // The panel that opened is the picker, with its six emoji in it. Counting body
    // children alone would be satisfied by any stray portal a neighbouring story left
    // behind, and the dismissal assertions below would then be about the wrong node.
    await expect(
      within(openPanels()[0])
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['👍', '❤️', '😂', '🎉', '🙏', '✅']);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(openPanels()).toHaveLength(0);
    });

    // A pointer-down anywhere outside the panel and the trigger closes it too. The
    // listener is on `mousedown`, not `click`, so the press closes the panel before the
    // element under the pointer gets its click.
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(openPanels()).toHaveLength(1);
    });
    await userEvent.click(canvas.getByText('Bloodwork is back and the panel is clean.'));
    await waitFor(() => {
      expect(openPanels()).toHaveLength(0);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Escape and an outside press both close the panel, and so do scroll and resize - the ' +
          'panel is positioned once in fixed coordinates and never re-measured, so it dismisses ' +
          'rather than drifting away from its trigger.',
      },
    },
  },
};

export const WithReactions: Story = {
  name: 'Reactions on the bubble',
  args: {
    mine: false,
    reactionGroups: { '👍': { count: 2 }, '❤️': { count: 1 } },
    ownReactions: [{ type: '👍' }],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // One combined pill, each emoji individually toggleable, then the running total.
    const thumbs = canvas.getByRole('button', { name: '2 👍 reaction' });
    await expect(canvas.getByRole('button', { name: '1 ❤️ reaction' })).toBeInTheDocument();
    const pill = thumbs.parentElement as HTMLElement;
    await expect(pill.lastElementChild?.textContent).toBe('3');

    // Own reactions are marked by saturation rather than by a second colour, so the pill
    // stays one shape whoever reacted.
    await expect(thumbs).toHaveClass('saturate-150');
    await expect(canvas.getByRole('button', { name: '1 ❤️ reaction' })).not.toHaveClass(
      'saturate-150'
    );

    // The pill straddles the bubble's bottom edge (`-bottom-3`) rather than sitting under
    // it, which is what the extra `mt-2.5` on the meta line below compensates for.
    // Measured against the bubble BOX, not the paragraph inside it - the bubble's own
    // 10px block padding is enough to make the overlap look like a gap.
    const bubble = canvas.getByText('Bloodwork is back and the panel is clean.')
      .parentElement as HTMLElement;
    const pillRect = pill.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    await expect(pillRect.top).toBeLessThan(bubbleRect.bottom);
    await expect(pillRect.bottom).toBeGreaterThan(bubbleRect.bottom);

    await userEvent.click(thumbs);
    await expect(args.handleReaction).toHaveBeenCalledWith('👍', expect.anything());
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reactions read from `reaction_groups` (Stream v13) with `reaction_counts` as the older ' +
          'fallback, so a payload from either shape renders. Zero-count entries are dropped ' +
          'rather than rendered as empty chips - Stream leaves a group behind when the last ' +
          'reaction is removed.',
      },
    },
  },
};

export const Deleted: Story = {
  name: 'Deleted message',
  args: { deleted: true, text: 'Wrong thread, sorry.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This message was deleted')).toBeInTheDocument();
    await expect(canvas.queryByText('Wrong thread, sorry.')).not.toBeInTheDocument();
    // The early return happens before the action strip is built, so a tombstone has no
    // React, no Reply and no menu - not even hidden ones.
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The tombstone: italic `--ink-faint`, no bubble, no avatar, indented `ml-11` on the ' +
          'incoming side so it still lines up with the column above it. Reacting to or replying ' +
          'to a deleted message is impossible because the controls are never rendered.',
      },
    },
  },
};

export const SharedRecord: Story = {
  name: 'Shared record instead of a bubble',
  args: {
    mine: true,
    senderName: 'Dr. Weber',
    seen: true,
    sharedEntity: {
      entityType: 'INVOICE',
      entityId: 'inv-2043',
      title: 'Invoice INV-2043',
      snapshot: { subtitle: 'Marta Alvarez · 12 Mar 2026', amount: '€248.50', status: 'PAID' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The card takes the place of the bubble entirely - `message.text` is not rendered
    // alongside it.
    await expect(
      canvas.queryByText('Bloodwork is back and the panel is clean.')
    ).not.toBeInTheDocument();

    // The whole card came through, not just its title: header row plus value row, with
    // the deep link live inside the thread.
    const card = canvas.getByText('Invoice INV-2043').closest('div.rounded-2xl') as HTMLElement;
    await expect(card.children).toHaveLength(2);
    await expect(canvas.getByText('€248.50')).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'View in Finance' })).toHaveAttribute(
      'href',
      '/finance'
    );

    // Outgoing, so the column is `items-end` and the card must sit flush against the
    // right edge of the 460px bubble column rather than stretching across it or hugging
    // the left. The card brings its own fixed width, which is the thing that could get
    // this wrong without any visible error.
    const column = card.closest('div.flex-col') as HTMLElement;
    const cardRect = card.getBoundingClientRect();
    const columnRect = column.getBoundingClientRect();
    await expect(cardRect.right).toBeCloseTo(columnRect.right, 0);
    await expect(cardRect.width).toBeLessThan(columnRect.width);

    // Everything around the body still applies: the actions, the meta line and the read
    // receipt, which is `Seen` here rather than `Sent`.
    await expect(canvas.getByRole('button', { name: 'React' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Seen')).toBeInTheDocument();
    await expect(canvas.getByText('10:15 AM · Dr. Weber')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A shared PIMS record as it actually lands in a thread: the `SharedEntityCard` sits ' +
          'where the bubble would be, inside the same `max-w-[460px]` column and under the same ' +
          'meta line. Worth seeing here rather than only in the card’s own stories, because the ' +
          'card brings its own `--screen` background and border into a column designed around ' +
          '`--cta` bubbles.',
      },
    },
  },
};
