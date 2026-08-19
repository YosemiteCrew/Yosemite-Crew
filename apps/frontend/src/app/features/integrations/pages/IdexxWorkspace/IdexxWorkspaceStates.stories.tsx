import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { formatDateTimeLocal } from '@/app/lib/date';
import { NotConnectedState, SyncingSkeleton } from './index';

const LAST_SYNC = '2026-08-18T06:05:00.000Z';

/**
 * Both branches are whole-page returns, so they get the page's own padding here
 * rather than a card wrapper - the not-connected card is centred by
 * `flex-1 items-center justify-center` and needs room to prove its 520px cap.
 */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-[560px] flex-col bg-[var(--screen-2)] p-3 md:p-5">{children}</div>
);

const meta = {
  title: 'Integrations/IdexxWorkspace states',
  component: NotConnectedState,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The two IDEXX Hub screens that are not the results table, and neither had ever been ' +
          'drawn. Both are chosen by the page, not by a prop: `NotConnectedState` is an early ' +
          '`return` taken when `!integrationEnabled && !loading`, and `SyncingSkeleton` replaces ' +
          'the whole table body while a refresh is in flight. The page that picks between them ' +
          'sits behind `ProtectedRoute` + `OrgGuard` and pulls results over axios, so neither ' +
          'was reachable from a story until they were exported.\n\n' +
          'The skeleton has a trap in it. Its root is `aria-hidden="true"`, which is correct - it ' +
          'is decorative - but `getByRole` skips hidden subtrees by default, so every role query ' +
          'written against it comes back empty and a story that reached for one would fail while ' +
          'the surface rendered perfectly. The play functions below query by text and by ' +
          'selector on purpose.\n\n' +
          'The header band and the four placeholder rows are two independent declarations of the ' +
          'same four tracks: `TableHead` takes `track="1.4fr 1fr 1fr 90px"` as a style, the rows ' +
          'carry `grid-cols-[1.4fr_1fr_1fr_90px]` as a class. Nothing keeps them in agreement, ' +
          'so both are asserted below - a drift there tilts every placeholder off its column ' +
          'while the skeleton still looks plausible.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof NotConnectedState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotConnected: Story = {
  name: "Not connected ('IDEXX isn't connected yet')",
  render: () => (
    <Frame>
      <NotConnectedState />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Exact strings, not a loose regex: the preview decorator injects an sr-only
       <h1> reading "<title> - <story name>" into this same canvas, and that title
       contains "Not connected", so /not connected/i would match the heading of a
       story whose component never rendered. */
    const title = canvas.getByText("IDEXX isn't connected yet");
    await expect(title).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'Connect your IDEXX account to order labs from the visit and pull results from in-house ' +
          'analyzers straight into the record.'
      )
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Works with Catalyst One, ProCyte Dx and VetLab UA stations')
    ).toBeInTheDocument();

    /* TWO routes to the same place, which is the whole point of the card: the
       filled pill and the quiet text link both go to /integrations. `Primary`
       renders a real next/link whenever href is neither empty nor '#', so both
       are role=link here rather than buttons. */
    const primary = canvas.getByRole('link', { name: 'Enable IDEXX in Integrations' });
    const secondary = canvas.getByRole('link', { name: 'Open Integrations' });
    await expect(primary).toHaveAttribute('href', '/integrations');
    await expect(secondary).toHaveAttribute('href', '/integrations');

    // 520px card cap, 320px action column. Border box, so getBoundingClientRect -
    // getComputedStyle().width would report the content box and read 518/318 here.
    const card = title.closest('div[class*="max-w-[520px]"]') as HTMLElement;
    await expect(Math.round(card.getBoundingClientRect().width)).toBe(520);
    const actions = primary.parentElement as HTMLElement;
    await expect(Math.round(actions.getBoundingClientRect().width)).toBe(320);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting card at desktop width. The flask chip is 74px on `--blue-soft`, the card ' +
          'caps at 520px and the two CTAs share a 320px column, so the pill never stretches to ' +
          'the full card width.',
      },
    },
  },
};

export const NotConnectedPhone: Story = {
  name: 'Not connected (phone)',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 - it still type-checks and still renders, at the full panel
  // width, so a story pinned that way silently draws desktop markup.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  render: () => (
    <Frame>
      <NotConnectedState />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("IDEXX isn't connected yet");
    const card = title.closest('div[class*="max-w-[520px]"]') as HTMLElement;

    // `w-full max-w-[520px]` with `px-11` inside: at 375 the cap stops applying
    // and the card takes the column, so the 88px of horizontal padding is what
    // squeezes the copy rather than the card shrinking away from the edges.
    const cardWidth = card.getBoundingClientRect().width;
    await expect(cardWidth).toBeLessThan(520);
    await expect(cardWidth).toBeGreaterThan(300);

    // The action column keeps its own cap and both CTAs stay stacked.
    const actions = canvas.getByRole('link', { name: 'Enable IDEXX in Integrations' })
      .parentElement as HTMLElement;
    await expect(getComputedStyle(actions).flexDirection).toBe('column');
    await expect(actions.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the card gives up its 520 cap but keeps `px-11`, so 88px of the width is ' +
          'padding. This is the state a phone user lands on from the Hub tab with no ' +
          'integration, and it had never been looked at.',
      },
    },
  },
};

export const Syncing: Story = {
  name: 'Syncing skeleton',
  render: () => (
    <Frame>
      <div
        className="flex flex-col overflow-hidden rounded-2xl border"
        style={{ background: 'var(--screen)', borderColor: 'var(--hairline)' }}
      >
        <SyncingSkeleton lastRefreshedAt={LAST_SYNC} />
      </div>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Syncing with IDEXX…')).toBeInTheDocument();
    /* Formatted through the same helper the component uses rather than hard-coded:
       `formatDateTimeLocal` renders in the viewer's preferred time zone, so a
       literal string here would pass in one CI region and fail in the next. */
    await expect(
      canvas.getByText(`Last sync ${formatDateTimeLocal(LAST_SYNC, '—')}`)
    ).toBeInTheDocument();

    // Header band: four labels, four tracks.
    const head = canvasElement.querySelector('.yc-table-head') as HTMLElement;

    /* Decorative by design, and that is what makes role queries inside it come
       back empty - assert the flag rather than rediscovering it from a failing
       query later. `TableHead` also declares no table roles of its own, on
       purpose: `role="columnheader"` without a `role="table"` ancestor
       announces a header for a table nobody can navigate. */
    await expect(head.closest('[aria-hidden="true"]')).not.toBeNull();
    await expect(head).not.toHaveAttribute('role');
    await expect(head.children).toHaveLength(4);
    await expect(getComputedStyle(head).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
    await expect([...head.children].map((cell) => cell.textContent)).toEqual([
      'Patient',
      'Accession #',
      'Device',
      'Status',
    ]);

    /* Four placeholder rows, fading 1 / .75 / .5 / .28 down the stack. The
       opacity IS the design here - equal rows would read as a loaded table with
       no content - so it is asserted rather than assumed. */
    const rows = [...canvasElement.querySelectorAll('div[class*="grid-cols-"]')] as HTMLElement[];
    await expect(rows).toHaveLength(4);
    await expect(rows.map((row) => getComputedStyle(row).opacity)).toEqual([
      '1',
      '0.75',
      '0.5',
      '0.28',
    ]);
    for (const row of rows) {
      await expect(row.children).toHaveLength(4);
      await expect(getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the table is replaced by while a refresh runs. The spinner in the band is the ' +
          'only moving part; the rows are static bars on `--inset` with a fixed opacity ramp.',
      },
    },
  },
};

export const SyncingNeverSynced: Story = {
  name: 'Syncing skeleton (no previous sync)',
  render: () => (
    <Frame>
      <div
        className="flex flex-col overflow-hidden rounded-2xl border"
        style={{ background: 'var(--screen)', borderColor: 'var(--hairline)' }}
      >
        <SyncingSkeleton lastRefreshedAt={null} />
      </div>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The em-dash fallback, not the helper's default 'Not available' - the call
    // site passes its own, and that choice is only visible on a first sync.
    await expect(canvas.getByText('Last sync —')).toBeInTheDocument();
    await expect(canvas.queryByText(/Not available/)).not.toBeInTheDocument();

    /* Everything else has to be BYTE-IDENTICAL to the story above. `null` takes a
       different branch inside `formatDateTimeLocal`, and the only thing that may
       differ because of it is the six characters after "Last sync". Re-asserting
       the whole skeleton here is what turns this from "a fallback string
       rendered" into "the fallback string is the only difference". */
    await expect(canvas.getByText('Syncing with IDEXX…')).toBeInTheDocument();
    const head = canvasElement.querySelector('.yc-table-head') as HTMLElement;
    await expect([...head.children].map((cell) => cell.textContent)).toEqual([
      'Patient',
      'Accession #',
      'Device',
      'Status',
    ]);
    await expect(getComputedStyle(head).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);

    const rows = [...canvasElement.querySelectorAll('div[class*="grid-cols-"]')] as HTMLElement[];
    await expect(rows).toHaveLength(4);
    await expect(rows.map((row) => getComputedStyle(row).opacity)).toEqual([
      '1',
      '0.75',
      '0.5',
      '0.28',
    ]);
    for (const row of rows) {
      await expect(row.children).toHaveLength(4);
      await expect(getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first sync after connecting, when there is no previous timestamp. ' +
          '`formatDateTimeLocal` defaults to "Not available"; this call site overrides it with ' +
          'an em dash, which is a difference only this state shows.',
      },
    },
  },
};
