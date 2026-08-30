import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import { StructuredResultsPanel } from './CompanionHistoryTimeline';
import type { HistoryEntry } from '@/app/features/companionHistory/types/history';

/**
 * Structurally the module-private `DetailPair` the timeline builds in
 * `getLabResults`. It is not exported, but the panel's props are typed inline, so a
 * literal of this shape is what the real call site passes.
 */
type ResultRow = {
  label: string;
  value: string;
  range?: string;
  abnormal?: boolean;
  direction?: string;
};

/** No `payload.referenceRange`, so a row with no interval of its own falls through to '-'. */
const LAB_ENTRY: HistoryEntry = {
  id: 'hist-lab-1',
  type: 'LAB_RESULT',
  occurredAt: '2026-03-12T09:42:00.000Z',
  status: 'COMPLETED',
  title: 'Complete blood count',
  subtitle: 'IDEXX ProCyte Dx',
  actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' },
  link: { kind: 'labResult', id: 'lab-1', appointmentId: 'appt-1', companionId: 'companion-1' },
  source: 'idexx',
  payload: {},
};

/** The same record with the panel-level fallback interval present on the payload. */
const LAB_ENTRY_WITH_FALLBACK: HistoryEntry = {
  ...LAB_ENTRY,
  id: 'hist-lab-2',
  payload: { referenceRange: 'Species reference interval' },
};

/**
 * Six rows, because `getLabResults` slices the payload to six before this panel ever
 * sees it - six is the most the inline panel can draw, not a story convenience.
 */
const CBC_RESULTS: ResultRow[] = [
  { label: 'Haematocrit', value: '33 %', range: '37 - 55', abnormal: true, direction: '↓' },
  { label: 'Haemoglobin', value: '11.2 g/dL', range: '12 - 18', abnormal: true, direction: '↓' },
  {
    label: 'White cell count',
    value: '9.4 K/uL',
    range: '5.05 - 16.76',
    abnormal: false,
    direction: '',
  },
  { label: 'Platelets', value: '412 K/uL', range: '148 - 484', abnormal: false, direction: '' },
  { label: 'Reticulocytes', value: '96 K/uL', range: '10 - 110', abnormal: false, direction: '' },
  {
    label: 'Segmented neutrophils',
    value: '7.1 K/uL',
    range: '2.95 - 11.64',
    abnormal: false,
    direction: '',
  },
];

/** The header band, which is the only `.yc-table-head` in the canvas. */
const headerOf = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('.yc-table-head') as HTMLElement;

/** The bordered card the band and the rows share. */
const panelOf = (canvasElement: HTMLElement): HTMLElement =>
  headerOf(canvasElement).parentElement as HTMLElement;

/** Everything after the header band: one node per result row. */
const rowsOf = (canvasElement: HTMLElement): HTMLElement[] =>
  [...panelOf(canvasElement).children].slice(1) as HTMLElement[];

const tracks = (el: HTMLElement): string[] =>
  getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/);

/**
 * Four cells AND four resolved tracks, asserted together on every grid in the panel.
 * Either half alone is satisfiable by a broken render: a template that failed to
 * parse collapses to `none` while the four cells stack, and a template that survived
 * a dropped cell still reports four tracks.
 */
const expectFourColumns = (el: HTMLElement) => {
  expect(el.children).toHaveLength(4);
  expect(tracks(el)).toHaveLength(4);
};

/**
 * Proof that the unlayered `Generictable.css` recipe actually reached this band.
 *
 * `.yc-table-head` is a side-effect import on `CompanionHistoryTimeline`, not a
 * global. Uppercase and the 10.5px size exist nowhere else, so they are the cheapest
 * signal that the stylesheet loaded. Without this check the header/row template
 * equality asserted below would pass TRIVIALLY on an unstyled band - both halves
 * would have no padding and identical tracks, and the story would be green with the
 * recipe missing.
 *
 * The padding pair is the cascade fix itself: the recipe sets `padding: 11px 20px`
 * and the markup zeroes the inline sides with `px-0!`. Unlayered CSS outranks a
 * Tailwind utility, so the `!` is the only reason the header is not indented 20px
 * away from its rows. `paddingLeft` reading 20px means someone dropped it.
 */
const expectHeadRecipeApplied = (header: HTMLElement) => {
  const style = getComputedStyle(header);
  expect(style.textTransform).toBe('uppercase');
  expect(style.fontSize).toBe('10.5px');
  expect(style.paddingTop).toBe('11px');
  expect(style.paddingLeft).toBe('0px');
  expect(style.paddingRight).toBe('0px');
};

const meta = {
  title: 'Companions/StructuredResultsPanel',
  component: StructuredResultsPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The inline analyte table under an expanded lab row in the companion history ' +
          'timeline. It is rendered as `expandedContent` and only when **both** conditions hold: ' +
          "the row's id equals `expandedId`, and `getLabResults(entry)` came back non-empty. Two " +
          'gates in one expression means the panel had never been drawn anywhere - not in ' +
          'Storybook, and not in any test that stops at the collapsed card.\n\n' +
          'It is a CSS grid pretending to be a table, and the four-track template ' +
          '`minmax(160px,1fr) 120px 120px 100px` is written out **twice**: once on the ' +
          '`.yc-table-head` band and once, independently, on every data row. Nothing in the type ' +
          'system ties the two copies together. If either drifts, the header stops lining up with ' +
          'the body and the only symptom is misaligned columns, so the stories assert the two ' +
          'computed templates are identical rather than merely that each has four tracks.\n\n' +
          'That equality also depends on one non-obvious cascade detail. `.yc-table-head` is ' +
          'plain unlayered CSS from `Generictable.css` - a side-effect import on ' +
          '`CompanionHistoryTimeline`, not a global stylesheet - and it sets `padding: 11px 20px`; ' +
          'the data rows have no horizontal padding at all. Unlayered rules beat Tailwind ' +
          'utilities, so the header is zeroed with `px-0!` rather than `px-0` - an important ' +
          'declaration is the only thing that outranks the plain rule. Drop the `!` and the ' +
          'header indents 20px while the rows do not. Every story here first checks the recipe ' +
          'genuinely landed (uppercase, 10.5px, 11px block padding, 0 inline padding), because ' +
          'on an unstyled band the two templates would match for the wrong reason.\n\n' +
          'Two things a reviewer should look at directly. **The Meter column is hard-coded to ' +
          '"N/A"** for every row - it is a placeholder, not data. And **the flags are computed ' +
          'and then thrown away**: `getResultFlag` does real work upstream (lab flag codes first, ' +
          'then a numeric comparison against the parsed reference interval) to produce `abnormal` ' +
          'and a ↑/↓ `direction`, both of which arrive on every row here and neither of which ' +
          'this panel renders. A haematocrit of 33 against an interval of 37-55 draws exactly ' +
          'like a normal one. `HistoryRecordDrawer` does render them, so the same result reads as ' +
          'flagged in the drawer and unflagged in the timeline.\n\n' +
          'Nothing here is horizontally scrollable, and the tracks sum to a 536px hard floor, ' +
          'which is what the phone story is for.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    entry: LAB_ENTRY,
    results: CBC_RESULTS,
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[720px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StructuredResultsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Six analytes',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = headerOf(canvasElement);
    const rows = rowsOf(canvasElement);

    // The band really is wearing the recipe, so everything below is measured against
    // styled markup rather than against a bare div.
    expectHeadRecipeApplied(header);

    // Four labels, four tracks, six rows of four cells. A template that lost a
    // track collapses the row onto a second line and nothing throws.
    expectFourColumns(header);
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expectFourColumns(row);
    }

    /* The invariant that matters: header and body carry two separate copies of the
       same arbitrary template, so they must resolve to the same pixel widths. */
    expect(tracks(rows[0]).join(' ')).toBe(tracks(header).join(' '));

    /* At the default `laptop` viewport the first track is the `1fr` half of its
       `minmax()` and has absorbed the slack, so it is wider than the 160px floor.
       The phone story asserts the same track pinned at exactly 160 - together they
       show which half of the `minmax()` is binding at each width. */
    expect(Number.parseFloat(tracks(header)[0])).toBeGreaterThan(160);
    expect(tracks(header).slice(1)).toEqual(['120px', '120px', '100px']);

    expect(within(header).getByText('Test')).toBeInTheDocument();
    expect(within(header).getByText('Value')).toBeInTheDocument();
    expect(within(header).getByText('Reference')).toBeInTheDocument();
    expect(within(header).getByText('Meter')).toBeInTheDocument();

    // Row one, cell by cell, in order.
    expect([...rows[0].children].map((cell) => cell.textContent)).toEqual([
      'Haematocrit',
      '33 %',
      '37 - 55',
      'N/A',
    ]);
    expect(within(rows[5]).getByText('Segmented neutrophils')).toBeInTheDocument();

    // Every Meter cell is the same placeholder string - one per row, no exceptions.
    expect(canvas.getAllByText('N/A')).toHaveLength(6);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A complete blood count as the timeline draws it: the uppercase 10.5px header band on ' +
          '`--screen-2`, then six 14px medium rows with the analyte name in bold. The header is ' +
          '`.yc-table-head--static`, which drops the sticky positioning the recipe normally ' +
          'carries - inside an expanded card there is no scroll container for it to stick to, ' +
          'and sticky would strand the band mid-panel.',
      },
    },
  },
};

export const FlagsAreDropped: Story = {
  name: 'Out-of-range results draw as normal',
  args: {
    results: [
      { label: 'Haematocrit', value: '33 %', range: '37 - 55', abnormal: true, direction: '↓' },
      { label: 'Platelets', value: '412 K/uL', range: '148 - 484', abnormal: false, direction: '' },
      { label: 'ALT', value: '186 U/L', range: '10 - 125', abnormal: true, direction: '↑' },
    ],
  },
  play: async ({ canvasElement }) => {
    const header = headerOf(canvasElement);
    const rows = rowsOf(canvasElement);
    expectHeadRecipeApplied(header);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expectFourColumns(row);
    }

    /* Both arrows arrived on the props and neither reaches the DOM. Assert against the
       whole panel's text, because there is no element to query for something absent. */
    const panel = panelOf(canvasElement);
    expect(panel.textContent).not.toContain('↑');
    expect(panel.textContent).not.toContain('↓');

    // The Meter column is where a flag would go, and it is the placeholder on the
    // flagged rows too.
    expect([...rows[0].children].map((cell) => cell.textContent)).toEqual([
      'Haematocrit',
      '33 %',
      '37 - 55',
      'N/A',
    ]);
    expect([...rows[2].children].map((cell) => cell.textContent)).toEqual([
      'ALT',
      '186 U/L',
      '10 - 125',
      'N/A',
    ]);

    /* A flagged reading and a normal one are the same ink. The row style sets colour
       inline on the row, so the cells inherit one value - there is no abnormal
       treatment to catch. Read after the transition settles rather than in the same
       frame as the mount, and compare weight too: a bold-only flag would slip past a
       colour check. */
    await waitFor(() => {
      const flagged = getComputedStyle(rows[0].children[1]);
      const clean = getComputedStyle(rows[1].children[1]);
      expect(flagged.color).toBe(clean.color);
      expect(flagged.fontWeight).toBe(clean.fontWeight);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Haematocrit is below its interval and ALT is well above its own; both `abnormal` and ' +
          'both directions are on the props. The panel renders neither, so all three rows read ' +
          'identically. This is the surface to compare against `HistoryRecordDrawer`, which ' +
          'renders the same `abnormal` / `direction` pair as a tinted value and an arrow - the ' +
          'same lab result therefore looks flagged in the drawer and clean in the timeline.',
      },
    },
  },
};

export const ReferenceFallback: Story = {
  name: 'Empty cells and the payload fallback',
  args: {
    entry: LAB_ENTRY_WITH_FALLBACK,
    results: [
      { label: 'Haematocrit', value: '', range: '' },
      { label: 'Haemoglobin', value: '11.2 g/dL', range: '' },
    ],
  },
  play: async ({ canvasElement }) => {
    const header = headerOf(canvasElement);
    const rows = rowsOf(canvasElement);
    expectHeadRecipeApplied(header);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expectFourColumns(row);
    }

    // A missing reading becomes '-'; a missing interval instead falls back to the
    // record-level `payload.referenceRange`, which is a different substitution.
    expect([...rows[0].children].map((cell) => cell.textContent)).toEqual([
      'Haematocrit',
      '-',
      'Species reference interval',
      'N/A',
    ]);
    expect(rows[1].children[2].textContent).toBe('Species reference interval');

    /* Prose, not a number, in a 120px track - it wraps rather than truncating,
       because the ellipsis rule is scoped to `.yc-table-head > *` and not to rows.
       The wrap is counted over a Range: every cell is a grid item, so it is
       blockified and stretched, and its own client rects are one box whatever the
       text did. A Range over the contents returns one rect per line box. */
    const reference = rows[0].children[2] as HTMLElement;
    expect(getComputedStyle(reference).textOverflow).toBe('clip');
    expect(getComputedStyle(reference).overflow).toBe('visible');
    const referenceText = document.createRange();
    referenceText.selectNodeContents(reference);
    expect(referenceText.getClientRects().length).toBeGreaterThanOrEqual(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both substitutions in one render. The value cell short-circuits to a literal hyphen, ' +
          'but the reference cell tries `payload.referenceRange` first - so one lab that reports ' +
          'a single interval for the whole panel repeats that string down every row, in a 120px ' +
          'column with no truncation of its own. It wraps instead, and every row on the panel ' +
          'grows to carry the same repeated sentence.',
      },
    },
  },
};

export const NoReferenceAnywhere: Story = {
  name: 'No interval on the row or the record',
  args: {
    entry: LAB_ENTRY,
    results: [
      { label: 'Haematocrit', value: '33 %', range: '' },
      { label: 'Haemoglobin', value: '11.2 g/dL', range: '' },
    ],
  },
  play: async ({ canvasElement }) => {
    const header = headerOf(canvasElement);
    const rows = rowsOf(canvasElement);
    expectHeadRecipeApplied(header);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expectFourColumns(row);
    }

    // `payload` is empty here, so the fallback chain runs out and the Reference
    // column is a column of hyphens - visually identical to a missing value.
    expect([...rows[0].children].map((cell) => cell.textContent)).toEqual([
      'Haematocrit',
      '33 %',
      '-',
      'N/A',
    ]);
    expect(rows.map((row) => row.children[2].textContent)).toEqual(['-', '-']);

    /* Two of the four tracks now carry nothing but placeholders, and they still hold
       their full 120px + 100px. That is the whole argument for the phone story: the
       220px is spent whether or not there is anything to put in it. */
    expect(tracks(header).slice(2)).toEqual(['120px', '100px']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The common shape for a manually entered result: readings, no intervals. Two of the ' +
          'four columns are then dead - Reference is all hyphens and Meter is all "N/A" - which ' +
          'is 220px of the template spent on nothing, and the reason the phone width is as tight ' +
          'as it is.',
      },
    },
  },
};

export const LongAnalyteNames: Story = {
  name: 'Long analyte names wrap',
  args: {
    results: [
      {
        label: 'Segmented neutrophils absolute count (automated differential)',
        value: '7.1 K/uL',
        range: '2.95 - 11.64',
      },
      { label: 'Platelets', value: '412 K/uL', range: '148 - 484' },
    ],
  },
  play: async ({ canvasElement }) => {
    const header = headerOf(canvasElement);
    const rows = rowsOf(canvasElement);
    expectHeadRecipeApplied(header);
    expect(rows).toHaveLength(2);
    expectFourColumns(header);
    for (const row of rows) {
      expectFourColumns(row);
    }

    /* The header band is `white-space: nowrap` with `overflow: hidden` +
       `text-overflow: ellipsis` on its children, from the plain-CSS recipe. Data rows
       inherit neither, so the two halves of the same table handle overflow in
       opposite ways. */
    expect(getComputedStyle(header.children[0]).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(header.children[0]).textOverflow).toBe('ellipsis');
    expect(getComputedStyle(rows[0].children[0]).whiteSpace).toBe('normal');
    expect(getComputedStyle(rows[0].children[0]).textOverflow).toBe('clip');

    /* Counted over a Range, not over the element: every cell is a grid item, so it is
       blockified and stretched to the row height and its own client rects are one box
       whatever the text did. A Range over the text contents returns one rect per line
       box, so this is a direct wrap count. */
    const label = rows[0].children[0] as HTMLElement;
    const labelText = document.createRange();
    labelText.selectNodeContents(label);
    expect(labelText.getClientRects().length).toBeGreaterThanOrEqual(2);

    /* The wrap is contained: the first column keeps the width the header gave it, so
       the numeric columns do not shift under a long name. This is the assertion that
       fails if someone swaps `minmax(160px,1fr)` for `auto` or `max-content`. */
    expect(tracks(rows[0])).toEqual(tracks(header));
    expect(Math.round(label.getBoundingClientRect().width)).toBe(
      Math.round((header.children[0] as HTMLElement).getBoundingClientRect().width)
    );

    // The wrapped label grows the row past the single-line row below it, and the
    // short row is unaffected - the growth is local, not a whole-table reflow.
    expect(rows[0].getBoundingClientRect().height).toBeGreaterThan(
      rows[1].getBoundingClientRect().height
    );
    expect(rows[1].children[0].textContent).toBe('Platelets');
  },
  parameters: {
    docs: {
      description: {
        story:
          'IDEXX and Merck panels both emit analyte names at this length. The first track is ' +
          '`minmax(160px,1fr)`, so it absorbs the slack at desktop width and the name wraps ' +
          'inside it rather than pushing the numeric columns - but the row grows taller than its ' +
          'neighbours while the other three cells stay top-aligned, so the reading no longer sits ' +
          'on the same baseline as its name.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* The width is pinned here as well as through the viewport global. The global
     is applied by the Storybook manager resizing the preview iframe, so a runner
     that loads `iframe.html` directly renders this at panel width - where a 536px
     grid fits and the scroll assertion below is false for the wrong reason. This
     one CAN be framed, unlike a `sm:`-gated layout: the overflow is driven by the
     grid's own `min-width` against its container, not by a media query. */
  decorators: [
    (Story) => (
      <div className="w-[375px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const header = headerOf(canvasElement);
    const panel = panelOf(canvasElement);
    const rows = rowsOf(canvasElement);

    expectHeadRecipeApplied(header);
    // The template does not respond to width - still four tracks, at every size.
    expectFourColumns(header);
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expectFourColumns(row);
    }

    /* The table is wider than the card by design: 160 + 120 + 120 + 100 plus three
       gaps cannot render under 536px, and this panel sits in a ~309px column on a
       phone. What changed is that it is now SCROLLABLE rather than spilling - the
       panel carries `overflow-x: auto` and the grid a `min-width`, so the Meter
       column is reachable instead of hanging off the side of its own card. */
    expect(getComputedStyle(panel).overflowX).toBe('auto');
    expect(panel.scrollWidth).toBeGreaterThan(panel.clientWidth);

    /* The scroll lives on the PANEL, not on the page. A container that failed to
       clip would look identical here and take the whole history screen sideways
       with it, which is the regression this pins. */
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth
    );

    // Rows scroll with the header, so the columns stay aligned while they move,
    // and the content is unchanged from the laptop render.
    expect(tracks(rows[0])).toEqual(tracks(header));
    expect([...rows[0].children].map((cell) => cell.textContent)).toEqual([
      'Haematocrit',
      '33 %',
      '37 - 55',
      'N/A',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The phone record renders this same panel - `variant="phone"` changes the timeline ' +
          'chrome around it, not the expanded content. The four tracks are unconditional, so the ' +
          'table cannot render under 536px inside a ~309px column. It scrolls inside its own card ' +
          'rather than spilling: nothing is dropped, because a lab panel is read by comparing a ' +
          'value against its reference interval and hiding either column on a phone would defeat ' +
          'it.\n\nThe track widths are deliberately NOT asserted here. The viewport global is ' +
          'applied by the Storybook manager resizing the preview iframe, so a runner that loads ' +
          '`iframe.html` directly renders this at panel width and the `minmax()` floor resolves ' +
          'differently - an absolute assertion would fail for a reason that has nothing to do ' +
          'with the component. The scroll containment holds at either width, so that is what is ' +
          'measured.',
      },
    },
  },
};
