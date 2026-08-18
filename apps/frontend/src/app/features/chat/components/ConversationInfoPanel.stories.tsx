import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Channel as StreamChannel } from 'stream-chat';

import { ConversationInfoPanel } from './ConversationInfoPanel';
import './ChatContainer.css';

/**
 * The three derive helpers only ever touch `channel.state.members`,
 * `channel.state.messages[].attachments` and `channel.state.pinnedMessages`, and
 * each one defaults its slice when it is missing. A plain object with that shape
 * is therefore a complete stand-in - no Stream client, no socket, no tokens.
 */
type FakeChannelState = {
  members?: Record<
    string,
    { user_id?: string; user?: { id?: string; name?: string }; role?: string }
  >;
  messages?: Array<{
    id?: string;
    attachments?: Array<{ type?: string; title?: string; fallback?: string; file_size?: number }>;
  }>;
  pinnedMessages?: Array<{ id?: string; text?: string }>;
};

const asChannel = (state: FakeChannelState): StreamChannel =>
  ({ state }) as unknown as StreamChannel;

const FULL_CHANNEL = asChannel({
  members: {
    'user-vet': {
      user_id: 'user-vet',
      user: { id: 'user-vet', name: 'Dr. Amelia Hart' },
      role: 'owner',
    },
    'user-nurse': { user_id: 'user-nurse', user: { id: 'user-nurse', name: 'Tomas Vidal' } },
    'user-client': { user_id: 'user-client', user: { id: 'user-client', name: 'Marta Alvarez' } },
  },
  messages: [
    {
      id: 'm1',
      attachments: [
        { type: 'image' },
        { type: 'image' },
        { type: 'video' },
        { type: 'file', title: 'Radiograph-left-stifle.pdf', file_size: 184_320 },
      ],
    },
    {
      id: 'm2',
      attachments: [
        { type: 'image' },
        { type: 'image' },
        { type: 'image' },
        { type: 'image' },
        { type: 'file', title: 'Bloodwork-panel-March.csv', file_size: 2_310 },
        { type: 'file', fallback: 'discharge-instructions', file_size: 1_572_864 },
      ],
    },
  ],
  pinnedMessages: [
    { id: 'p1', text: 'Recheck booked for 26 March at 10:15 - bring the current medication box.' },
    { id: 'p2', text: 'Owner prefers WhatsApp for reminders, phone only for urgent calls.' },
    // Attachment-only pin: no text, so `deriveConversationPinned` drops it entirely.
    { id: 'p3', text: '   ' },
  ],
});

/**
 * `.chat-conversation-info` is `position: absolute; inset-block: 0; right: 0`, so
 * it only has a size inside a positioned box. In the app that box is the thread
 * column; here it is this frame, sized to the design's 390px drawer plus the
 * thread it overlays.
 */
const ThreadFrame = (Story: React.ComponentType) => (
  <div className="relative h-[720px] w-[640px] overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--screen-2)]">
    <div className="p-5 text-[12.5px] text-[var(--ink-faint)]">
      Thread column - the drawer overlays it rather than pushing it.
    </div>
    <Story />
  </div>
);

const meta = {
  title: 'Chat/ConversationInfoPanel',
  component: ConversationInfoPanel,
  decorators: [ThreadFrame],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The 390px conversation-info drawer. `ChatContainer` renders it behind `{infoOpen && ...}` ' +
          'and only for a client chat, so the entire panel is unmounted until someone flips the info ' +
          'toggle in the channel header - the whole tree had never been drawn anywhere.\n\n' +
          'That matters more here than in most panels because almost nothing in it is static: five ' +
          'of the six blocks are gated on derived data being non-empty. Members, Shared media, ' +
          'Files and Pinned each render only when their derive helper returns a non-empty array, ' +
          'and each heading carries a live count (`Members · 3`). A panel that renders with a ' +
          'section silently missing looks identical to one where the derive is broken, so the ' +
          'stories drive the full panel and the bare one separately.\n\n' +
          'The media block is the one that most needs drawing: it is a ' +
          '`grid grid-cols-3 gap-[7px]` of 74px tiles, `slice(0, 6)`-capped. A grid template that ' +
          'never rendered is precisely the bug class this work exists for - a popover on this ' +
          'branch shipped a comma in its `grid-template-columns`, which browsers drop entirely, ' +
          'collapsing six children into one column. Seven media attachments here prove both the ' +
          'three-column shape and the six-tile cap.\n\n' +
          'Files are capped at four and pinned at three, and `deriveConversationPinned` drops any ' +
          'pin whose text is empty or whitespace-only - so the `Pinned · N` count is the count ' +
          'after filtering, not the raw channel count. The mute control is a ' +
          '`role="switch"` with `aria-checked`, whose 16px knob slides between `left-[3px]` and ' +
          '`left-[17px]` on a 36x22 track; the on state is `--cta`, and only a story can show it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    channel: FULL_CHANNEL,
    name: 'Marta Alvarez',
    subtitle: 'Kiko · Consultation in progress',
    online: true,
    clientRecordHref: '/companions/companion-1/overview',
    muted: false,
    onToggleMute: fn(),
    onArchive: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof ConversationInfoPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullPanel: Story = {
  name: 'Full panel (every section)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Assert each gated section is present AND populated - a heading with an empty
    // body would pass a "did the section render" check on its own.
    await expect(canvas.getByText('Members · 3')).toBeInTheDocument();
    await expect(canvas.getByText('Dr. Amelia Hart')).toBeInTheDocument();
    await expect(canvas.getByText('Owner')).toBeInTheDocument();

    // 7 media attachments derived, 6 tiles drawn (`slice(0, 6)`), across 3 columns.
    await expect(canvas.getByText('Shared media · 7')).toBeInTheDocument();
    const tiles = [
      ...canvas.getAllByLabelText('Shared image'),
      ...canvas.getAllByLabelText('Shared video'),
    ];
    await expect(tiles).toHaveLength(6);

    await expect(canvas.getByText('Files · 3')).toBeInTheDocument();
    await expect(canvas.getByText('Radiograph-left-stifle.pdf')).toBeInTheDocument();
    // 184320 bytes -> "180 KB"; 1572864 -> "1.5 MB"; the fallback title is used when no title.
    await expect(canvas.getByText('180 KB')).toBeInTheDocument();
    await expect(canvas.getByText('discharge-instructions')).toBeInTheDocument();

    // The whitespace-only pin is dropped, so the count is 2 rather than 3.
    await expect(canvas.getByText('Pinned · 2')).toBeInTheDocument();
    await expect(canvas.getByRole('switch', { name: 'Mute notifications' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Everything on at once: three members with the creator labelled Owner, a six-tile media ' +
          'grid capped from seven attachments, three files with humanised sizes, and two surviving ' +
          'pins out of three.',
      },
    },
  },
};

export const Muted: Story = {
  name: 'Muted (switch on)',
  args: { muted: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Mute notifications' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    // The knob is a plain span, so assert the class that moves it rather than a role.
    await expect(toggle.firstElementChild).toHaveClass('left-[17px]');
    await userEvent.click(toggle);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The on state of the 36x22 switch: `--cta` track and the knob at `left-[17px]`. Clicking ' +
          'it fires `onToggleMute` - the panel is presentational, so the checked state stays where ' +
          'the prop put it rather than moving on its own.',
      },
    },
  },
};

export const NoAttachments: Story = {
  name: 'Members only (no media, files or pins)',
  args: {
    channel: asChannel({
      members: {
        'user-vet': { user_id: 'user-vet', user: { name: 'Dr. Amelia Hart' }, role: 'owner' },
        'user-client': { user_id: 'user-client', user: { name: 'Marta Alvarez' } },
      },
      messages: [{ id: 'm1' }],
      pinnedMessages: [],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Members · 2')).toBeInTheDocument();
    // The three empty sections are absent, not rendered as empty headings.
    await expect(canvas.queryByText(/^Shared media/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/^Files/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/^Pinned/)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A conversation with nothing shared yet. Each empty section drops out entirely, so the ' +
          'panel collapses to the header, the mute row, the member list and the archive footer ' +
          'rather than showing three headings over nothing.',
      },
    },
  },
};

export const NoChannel: Story = {
  name: 'No channel yet (null)',
  args: { channel: null, subtitle: undefined, clientRecordHref: undefined, online: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Every derive returns [] for a null channel, so only the fixed chrome remains.
    await expect(canvas.getByText('Conversation info')).toBeInTheDocument();
    await expect(canvas.getByRole('switch', { name: 'Mute notifications' })).toBeInTheDocument();
    await expect(canvas.getByText('Archive conversation')).toBeInTheDocument();
    await expect(canvas.queryByText(/^Members/)).not.toBeInTheDocument();
    // No deep link without a patient id - the row is omitted, not rendered dead.
    await expect(canvas.queryByText('View client record')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel opened before the Stream channel resolves. Every helper is defensive about a ' +
          'null channel, so this must be the bare chrome - header, mute row, footer - and never a ' +
          'crash or a run of empty sections.',
      },
    },
  },
};

export const LongName: Story = {
  name: 'Long name and file names',
  args: {
    name: 'Bartholomew Wigglesworth-Christiansen',
    subtitle: 'Bartholomew Wigglesworth III · Post-operative recheck and bandage change',
    channel: asChannel({
      members: {
        'user-vet': {
          user_id: 'user-vet',
          user: { name: 'Dr. Amelia Hart-Fitzgerald' },
          role: 'owner',
        },
      },
      messages: [
        {
          id: 'm1',
          attachments: [
            {
              type: 'file',
              title: 'Post-operative-discharge-instructions-and-medication-schedule-v3.pdf',
              file_size: 942_000,
            },
          ],
        },
      ],
      pinnedMessages: [
        {
          id: 'p1',
          text: 'Owner is travelling until the 30th; the co-parent listed on the record is the contact for anything urgent before then.',
        },
      ],
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every text run in this panel is `truncate` or single-line: the header name, member names, ' +
          'file names and the pinned line. At 390px that is the difference between a clipped row and ' +
          'a drawer that grows sideways out of the thread column.',
      },
    },
  },
};
