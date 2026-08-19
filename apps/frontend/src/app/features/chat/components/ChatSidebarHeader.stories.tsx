import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { ChatSidebarHeader } from './ChatContainer';
import type { OrgUserOption } from './GroupModal';

/**
 * Ten teammates plus the signed-in user, and the ordering is load-bearing.
 *
 * The header drops whoever matches `currentUserId` and then caps the rest at
 * `slice(0, 8)`. With eleven entries both rules bite, and with the signed-in
 * user placed SECOND rather than last, her absence proves the self-exclusion
 * rather than the cap - at the end of the list the cap would have removed her
 * anyway and the story would pass either way.
 */
const ORG_USERS: OrgUserOption[] = [
  { id: 'u-1', userId: 'u-1', name: 'Amelia Hart', email: 'amelia@clinic.test', role: 'Lead vet' },
  { id: 'u-me', userId: 'u-me', name: 'Yara Osman', email: 'yara@clinic.test', role: 'Vet' },
  { id: 'u-2', userId: 'u-2', name: 'Tomas Vidal', email: 'tomas@clinic.test', role: 'Nurse' },
  {
    id: 'u-3',
    userId: 'u-3',
    name: 'Priya Raghavan',
    email: 'priya@clinic.test',
    role: 'Radiologist',
  },
  { id: 'u-4', userId: 'u-4', name: 'Ben Okafor', email: 'ben@clinic.test', role: 'Receptionist' },
  { id: 'u-5', userId: 'u-5', name: 'Sofia Marchetti', email: 'sofia@clinic.test', role: 'Vet' },
  { id: 'u-6', userId: 'u-6', name: 'Lars Pedersen', email: 'lars@clinic.test', role: 'Vet tech' },
  { id: 'u-7', userId: 'u-7', name: 'Nina Kowalska', email: 'nina@clinic.test', role: 'Nurse' },
  { id: 'u-8', userId: 'u-8', name: 'Rafael Sousa', email: 'rafael@clinic.test', role: 'Vet' },
  {
    id: 'u-9',
    userId: 'u-9',
    name: 'Grace Chen',
    email: 'grace@clinic.test',
    role: 'Practice mgr',
  },
  { id: 'u-10', userId: 'u-10', name: 'Otto Brenner', email: 'otto@clinic.test', role: 'Vet' },
];

const SidebarFrame = (Story: React.ComponentType) => (
  <div className="w-[340px] border-r border-[var(--hairline)] bg-[var(--screen)] pb-6">
    <Story />
  </div>
);

/**
 * The header is fully controlled - every value it draws comes back in as a prop -
 * so the stories that need a state change to be *visible* (switching audience,
 * pressing Archived, typing into the teammate field) drive it through this
 * wrapper. The callbacks still fire on the spies underneath, so a play function
 * can assert both the call and the redraw.
 */
type HeaderProps = ComponentProps<typeof ChatSidebarHeader>;

const ControlledHeader = (props: HeaderProps) => {
  const [scope, setScope] = useState(props.scope);
  const [archived, setArchived] = useState(props.showArchived);
  const [directSearch, setDirectSearch] = useState(props.directSearch);
  const [focused, setFocused] = useState(props.searchFocused);

  return (
    <ChatSidebarHeader
      {...props}
      scope={scope}
      onScopeChange={(next) => {
        props.onScopeChange?.(next);
        setScope(next);
      }}
      showArchived={archived}
      onToggleArchived={() => {
        props.onToggleArchived();
        setArchived((value) => !value);
      }}
      directSearch={directSearch}
      onDirectSearchChange={(value) => {
        props.onDirectSearchChange(value);
        setDirectSearch(value);
      }}
      searchFocused={focused}
      onDirectSearchFocus={() => {
        props.onDirectSearchFocus();
        setFocused(true);
      }}
      onDirectSearchBlur={() => {
        props.onDirectSearchBlur();
        setFocused(false);
      }}
    />
  );
};

/**
 * The teammate rows are `<button>`s inside the directory `<ul>`, so this counts them.
 * The `<ul>` is unambiguous: nothing else in this header is a list - the audience
 * pill is a `role="group"` of buttons.
 */
const directoryList = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('ul') as HTMLElement;

const directoryRows = (canvasElement: HTMLElement) =>
  within(directoryList(canvasElement)).queryAllByRole('button');

const meta = {
  title: 'Chat/ChatSidebarHeader',
  component: ChatSidebarHeader,
  decorators: [SidebarFrame],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Everything above the conversation list in the chat sidebar: the "Chat" heading and the ' +
          'Archived toggle, the Clients / Team / Groups audience pill, the conversation search ' +
          'field, and - for two of the three audiences - a second block that has no equivalent in ' +
          'the third.\n\n' +
          'It had never been drawn because of where it is mounted. `ChatContainer` passes it as ' +
          "the `channelListHeader` of Stream's `ChannelList`, which only renders once a real " +
          '`StreamChat` client has connected with a real token, so seeing this header used to mean ' +
          'booting the whole chat stack. It is exported from `ChatContainer` for these stories; ' +
          'nothing else imports it.\n\n' +
          'The audience-specific block is the part worth reviewing. Under **Team** it is a ' +
          'cross-clinic CTA (itself gated on `crossOrgEnabled`), a teammate field, and a live ' +
          'directory list; under **Groups** it collapses to a single Create Group pill; under ' +
          '**Clients** the block is not rendered at all, so the sidebar is around 150px shorter. ' +
          'Three genuinely different headers behind one component.\n\n' +
          'The directory list is gated twice over, which is why a static capture of the Team scope ' +
          'shows an empty box: rows render only while `searchFocused || directListHover`, and the ' +
          'blur handler in `ChatContainer` runs on a 120ms timer so that moving the pointer from ' +
          'the field into the list does not empty it mid-reach. On top of that the results are ' +
          'filtered against name + email + role concatenated, capped at eight, and the signed-in ' +
          'user is removed - all three are exercised below.\n\n' +
          'One thing a reviewer should look at rather than take on trust: the rows are `<button>` ' +
          'elements parented directly by the `<ul>`, with no `<li>` between them, and the loading ' +
          'and empty strings are bare `<span>`s in the same place. The a11y panel flags it on ' +
          'every Team story here.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showArchived: false,
    onToggleArchived: fn(),
    scope: 'clients',
    onScopeChange: fn(),
    searchTerm: '',
    onSearchTermChange: fn(),
    crossOrgEnabled: true,
    onOpenNetworkDirectory: fn(),
    directSearch: '',
    onDirectSearchChange: fn(),
    onDirectSearchFocus: fn(),
    onDirectSearchBlur: fn(),
    onDirectListMouseEnter: fn(),
    onDirectListMouseLeave: fn(),
    searchFocused: false,
    directListHover: false,
    orgUsersLoading: false,
    orgUsers: ORG_USERS,
    currentUserId: 'u-me',
    creatingChat: false,
    onStartDirectChat: fn(),
    onOpenCreateGroupModal: fn(),
  },
} satisfies Meta<typeof ChatSidebarHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Clients: Story = {
  name: 'Clients (no second block)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exact string, not /chat/i: the preview decorator injects an sr-only
    // "Chat/ChatSidebarHeader - Clients (no second block)" heading into the same
    // canvas, and a loose regex matches that instead.
    await expect(canvas.getByRole('heading', { name: 'Chat', level: 2 })).toBeInTheDocument();

    const audience = canvas.getByRole('group', { name: 'Chat audience' });
    const segments = within(audience).getAllByRole('button');
    await expect(segments.map((segment) => segment.textContent)).toEqual([
      'Clients',
      'Team',
      'Groups',
    ]);
    // The middle tab reads "Team" while the scope value stays `colleagues` -
    // easy to regress into "Colleagues" when someone renames the value.
    await expect(segments[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(segments[1]).toHaveAttribute('aria-pressed', 'false');

    await expect(canvas.getByLabelText('Search conversations')).toHaveAttribute(
      'placeholder',
      'Search conversations…'
    );

    // The audience block genuinely does not exist here, rather than being hidden.
    await expect(canvas.queryByLabelText('Search teammate to chat')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Create Group' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Message a colleague at another clinic' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The shortest of the three headers, and the one the sidebar opens on. Heading, Archived ' +
          'toggle, audience pill, search field, and the list starts immediately under the hairline.',
      },
    },
  },
};

export const TeamResting: Story = {
  name: 'Team (list not yet revealed)',
  args: { scope: 'colleagues' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Message a colleague at another clinic' })
    ).toBeInTheDocument();
    await expect(canvas.getByLabelText('Search teammate to chat')).toHaveValue('');
    // Ten teammates are loaded and none of them is drawn: the list is gated on
    // focus or hover, not on having data. This is the state a screenshot of the
    // Team scope actually captures.
    await expect(directoryRows(canvasElement)).toHaveLength(0);

    /* And the box holding them is not collapsed - it is the full `max-h-40`
       scroller, rendered and empty, which is exactly why the resting Team scope
       reads as a broken list rather than as a prompt. */
    const list = directoryList(canvasElement);
    await expect(list.children).toHaveLength(0);
    await expect(getComputedStyle(list).maxHeight).toBe('160px');
    await expect(getComputedStyle(list).overflowY).toBe('auto');
    // Nothing tells the reader what would fill it: no placeholder copy anywhere
    // in the block.
    await expect(canvas.queryByText('Loading teammates…')).not.toBeInTheDocument();
    await expect(
      canvas.queryByText('No teammates found. Adjust your search.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Team scope at rest. `orgUsers` is fully populated here - the empty `max-h-40` box under ' +
          'the field is the double gate, not a loading state and not an empty directory.',
      },
    },
  },
};

export const TeamDirectory: Story = {
  name: 'Team directory (focused, capped at 8)',
  args: { scope: 'colleagues', searchFocused: true },
  play: async ({ canvasElement }) => {
    const rows = directoryRows(canvasElement);
    // Eleven fixtures, minus the signed-in user, capped at eight.
    await expect(rows).toHaveLength(8);
    // Monogram, name and email all come from the same record.
    await expect(rows[0]).toHaveTextContent('AH');
    await expect(rows[0]).toHaveTextContent('Amelia Hart');
    await expect(rows[0]).toHaveTextContent('amelia@clinic.test');

    /* Self-exclusion, proved positionally: Yara Osman is the SECOND fixture, so
       she would be row two here. Row two is Tomas instead, and her name is
       nowhere in the list. */
    const canvas = within(canvasElement);
    await expect(rows[1]).toHaveTextContent('Tomas Vidal');
    await expect(canvas.queryByText('Yara Osman')).not.toBeInTheDocument();

    // The cap, at its boundary: Rafael is the eighth kept, Grace the ninth dropped.
    await expect(rows[7]).toHaveTextContent('Rafael Sousa');
    await expect(canvas.queryByText('Grace Chen')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Otto Brenner')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The revealed directory: 56px rows on `--screen`, monogram avatar, name over email, ' +
          'inside a `max-h-40` scroller - so at eight rows roughly two and a half are visible and ' +
          'the rest are scrolled. Every row is a start-a-chat button, not a link.',
      },
    },
  },
};

export const TeamDirectoryLoading: Story = {
  name: 'Team directory (loading)',
  args: { scope: 'colleagues', searchFocused: true, orgUsersLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const line = canvas.getByText('Loading teammates…');
    // Loading wins over the data: `orgUsers` is still the full eleven here, and
    // the field is focused, so both other gates are open.
    await expect(directoryRows(canvasElement)).toHaveLength(0);

    /* The line is the list's only child, and it is a bare `<span>` sitting where
       the rows go - no skeleton, no spinner element - so the whole loading state
       is one 12px grey line inside a 160px box. */
    const list = directoryList(canvasElement);
    await expect(list.children).toHaveLength(1);
    await expect(list.children[0]).toBe(line);
    await expect(line.tagName).toBe('SPAN');
    await expect(getComputedStyle(list).maxHeight).toBe('160px');
    await expect(canvasElement.querySelectorAll('svg[class*="animate"]')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'While `fetchOrgUsers` is in flight. The string is a bare `caption-1` span with no ' +
          'spinner and no skeleton row, so at sidebar width it reads as a single grey line where ' +
          'the list will be.',
      },
    },
  },
};

export const TeamNoMatches: Story = {
  name: 'Team directory (no matches)',
  args: { scope: 'colleagues', searchFocused: true, directSearch: 'zzz' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const line = canvas.getByText('No teammates found. Adjust your search.');
    await expect(directoryRows(canvasElement)).toHaveLength(0);

    // Only child of the list, and the query that produced it is still in the
    // field - the copy tells the reader to adjust it, so it had better be there.
    const list = directoryList(canvasElement);
    await expect(list.children).toHaveLength(1);
    await expect(list.children[0]).toBe(line);
    await expect(canvas.getByLabelText('Search teammate to chat')).toHaveValue('zzz');
    // The cross-clinic CTA above is untouched, which matters: "no teammates
    // found" is the moment that button is most relevant and it does not move.
    await expect(
      canvas.getByRole('button', { name: 'Message a colleague at another clinic' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`hasNoDirectMatches` needs four conditions at once - not loading, focused, a non-blank ' +
          'query and zero results - so this line is unreachable by clicking around with an empty ' +
          'field, and equally unreachable while the fetch is still running.',
      },
    },
  },
};

export const TeamWithoutCrossOrg: Story = {
  name: 'Team without cross-clinic messaging',
  args: { scope: 'colleagues', searchFocused: true, crossOrgEnabled: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('button', { name: 'Message a colleague at another clinic' })
    ).not.toBeInTheDocument();
    // The rest of the block is untouched, so this is a height change, not a mode.
    await expect(canvas.getByLabelText('Search teammate to chat')).toBeInTheDocument();
    await expect(directoryRows(canvasElement)).toHaveLength(8);
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a practice with the cross-clinic feature off sees. The globe CTA is dropped ' +
          'entirely rather than disabled, which lifts the teammate field to the top of the block - ' +
          'worth seeing beside the enabled Team stories, since that is the layout most practices get.',
      },
    },
  },
};

export const Groups: Story = {
  name: 'Groups (Create Group only)',
  args: { scope: 'groups' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = canvas.getByRole('button', { name: 'Create Group' });
    // The teammate directory belongs to the Team scope only - group membership
    // is picked inside GroupModal instead.
    await expect(canvas.queryByLabelText('Search teammate to chat')).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('ul')).toBeNull();
    await expect(
      canvas.queryByRole('button', { name: 'Message a colleague at another clinic' })
    ).not.toBeInTheDocument();

    /* The block holds exactly one control, and that control is `w-fit` rather
       than stretched - the difference between the design's left-aligned pill and
       a full-bleed bar, and the reason this header is ~60px instead of ~200. */
    const block = pill.parentElement as HTMLElement;
    await expect(within(block).getAllByRole('button')).toHaveLength(1);
    await expect(pill.getBoundingClientRect().width).toBeLessThan(
      block.getBoundingClientRect().width * 0.6
    );
    await expect(pill.textContent).toBe('Create Group');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The third header. The same bordered block as Team holds one `w-fit` `--cta` pill, so ' +
          'the block is about 60px tall instead of 200 and the conversation list starts much higher.',
      },
    },
  },
};

export const ArchivedOn: Story = {
  name: 'Archived filter on',
  args: { showArchived: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Archived' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    /* The pressed treatment is a real repaint, not just an aria flip: a filled
       `--blue-soft` ground where the resting control is transparent, and a border
       that no longer matches the hairline the search pill uses. Both are read off
       the live element inside `waitFor`, because the control is
       `transition-colors` and one synchronous read can land mid-interpolation. */
    const searchPill = canvas.getByLabelText('Search conversations').parentElement as HTMLElement;
    await waitFor(() => {
      const pressed = getComputedStyle(toggle);
      expect(pressed.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(pressed.borderTopColor).not.toBe(getComputedStyle(searchPill).borderTopColor);
    });
    // The label never changes with the state, so `aria-pressed` really is the
    // whole announcement - and the glyph beside it is decorative.
    await expect(toggle.textContent).toBe('Archived');
    await expect(toggle.querySelector('svg')).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pressed toggle: `--blue` border, `--blue-soft` fill, `--blue-text` label. It is the ' +
          'only control in the header that changes which conversations the list below queries, and ' +
          'the only signal that the list is showing archived threads.',
      },
    },
  },
};

export const ArchivedTogglesLive: Story = {
  name: 'Archived toggles (live)',
  render: (args) => <ControlledHeader {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Archived' });
    const resting = getComputedStyle(toggle).backgroundColor;
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);

    await expect(args.onToggleArchived).toHaveBeenCalled();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // Read the fill inside waitFor: the button carries `transition-colors`, so a
    // single synchronous read lands on an interpolated value between the
    // transparent resting state and `--blue-soft`.
    await waitFor(() => {
      expect(getComputedStyle(toggle).backgroundColor).not.toBe(resting);
    });
    // The label does not change with the state, so aria-pressed is the whole
    // announcement a screen reader gets.
    await expect(toggle).toHaveTextContent('Archived');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The transition itself, driven through a wrapper that owns the state the way ' +
          '`ChatContainer` does. Both the resting and pressed fills are read off the live element, ' +
          'so a token rename that flattened one into the other would fail here rather than merely ' +
          'look wrong.',
      },
    },
  },
};

export const SwitchingAudience: Story = {
  name: 'Switching audience reveals the block',
  render: (args) => <ControlledHeader {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const audience = canvas.getByRole('group', { name: 'Chat audience' });
    const [clients, team, groups] = within(audience).getAllByRole('button');

    await expect(canvas.queryByLabelText('Search teammate to chat')).not.toBeInTheDocument();

    await userEvent.click(team);
    await expect(args.onScopeChange).toHaveBeenCalledWith('colleagues');

    // The point of the switch: a block that did not exist now does.
    expect(await canvas.findByLabelText('Search teammate to chat')).toBeInTheDocument();
    await expect(team).toHaveAttribute('aria-pressed', 'true');
    await expect(clients).toHaveAttribute('aria-pressed', 'false');
    // The raised active segment is 700 against 600 on the others; weight is not
    // transitioned, so this reads cleanly straight after the click.
    await expect(getComputedStyle(team).fontWeight).toBe('700');
    await expect(getComputedStyle(clients).fontWeight).toBe('600');

    await userEvent.click(groups);
    expect(await canvas.findByRole('button', { name: 'Create Group' })).toBeInTheDocument();
    await expect(canvas.queryByLabelText('Search teammate to chat')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Clients to Team to Groups in one pass. Each step swaps the whole second block, so the ' +
          'sidebar header changes height twice - which is the thing to watch, because the ' +
          'conversation list below it is a scroller sized by whatever is left.',
      },
    },
  },
};

export const TypingFiltersTheDirectory: Story = {
  name: 'Typing filters the directory',
  args: { scope: 'colleagues' },
  render: (args) => <ControlledHeader {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText('Search teammate to chat');

    // Focusing is what reveals the list at all.
    await userEvent.click(field);
    await expect(directoryRows(canvasElement)).toHaveLength(8);

    // "Radiologist" is a role, not a name: the filter concatenates
    // name + email + role, so a role query has to match.
    await userEvent.type(field, 'radiolog');
    await waitFor(() => {
      expect(directoryRows(canvasElement)).toHaveLength(1);
    });
    await expect(directoryRows(canvasElement)[0]).toHaveTextContent('Priya Raghavan');

    await userEvent.clear(field);
    await userEvent.type(field, 'clinic.test');
    // Every teammate shares the email domain, so the cap is back in force.
    await waitFor(() => {
      expect(directoryRows(canvasElement)).toHaveLength(8);
    });

    await userEvent.clear(field);
    await userEvent.type(field, 'qqq');
    expect(await canvas.findByText('No teammates found. Adjust your search.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The filter is not a name search. It matches against name, email and role joined ' +
          'together, so `radiolog` finds Priya through her role and `clinic.test` finds everyone ' +
          'through their address - and the eight-row cap re-applies on every keystroke, silently, ' +
          'with nothing in the UI saying that more matched than are shown.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the ⌘K hint is dropped',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert - a story using it renders at full panel width and
  // proves nothing about the breakpoint below.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Search conversations');
    // The hint chip is the input's next sibling inside the search pill.
    const hint = input.nextElementSibling as HTMLElement;
    // Exact, not a substring: the chip is a ⌘ glyph plus the single letter K,
    // and the glyph is an svg that contributes no text.
    await expect(hint.textContent).toBe('K');
    // `hidden ... sm:flex` is a viewport query, so this is only true under 640px.
    await expect(getComputedStyle(hint).display).toBe('none');
    // Removed from layout, not merely invisible - it takes no width at all.
    await expect(hint.getBoundingClientRect().width).toBe(0);

    /* Everything above the chip is unchanged at 375px, which is the point: the
       pill keeps its 38px minimum and the field simply runs to the edge. */
    const pill = input.parentElement as HTMLElement;
    await expect(Math.round(pill.getBoundingClientRect().height)).toBeGreaterThanOrEqual(38);
    await expect(getComputedStyle(input).display).not.toBe('none');
    await expect(canvas.getByRole('heading', { name: 'Chat', level: 2 })).toBeInTheDocument();
    // The audience pill survives the breakpoint with all three segments.
    const audience = canvas.getByRole('group', { name: 'Chat audience' });
    await expect(
      within(audience)
        .getAllByRole('button')
        .map((segment) => segment.textContent)
    ).toEqual(['Clients', 'Team', 'Groups']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'On a phone the ⌘K chip is removed from the search pill, which is correct - there is no ' +
          'keyboard to press it with - but it is also the only place in the product that advertises ' +
          'the command palette, so on mobile the palette is undiscoverable rather than merely ' +
          'unreachable. The pill keeps its 38px height and the field simply runs wider.',
      },
    },
  },
};
