import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import CompanionRecordRow from './CompanionRecordRow';

const ORG_NAME = 'Avenger Park Veterinary';

const record = (over: Partial<CompanionRecord> = {}): CompanionRecord => ({
  title: 'Feline leukaemia panel',
  category: 'HEALTH',
  subcategory: 'LAB_TEST',
  attachments: [{ key: 'panel.pdf', mimeType: 'application/pdf', size: 184_320 }],
  /* Noon UTC, not the bare `2026-07-14` the API actually returns. The label runs
     through `formatDateLabel` -> Intl in the preferred timezone, and a midnight
     value lands on the previous day for every reviewer west of it - so the
     assertion below would pass or fail by where the runner sits. Noon is the one
     instant that names the same calendar day in every zone. */
  issueDate: '2026-07-14T12:00:00.000Z',
  ...over,
});

/**
 * `getPreferredTimeZone` reads `yc_preferred_timezone` out of localStorage and
 * only falls back to Europe/Berlin when it is absent. The Storybook iframe keeps
 * localStorage across stories, so a zone some other story wrote would quietly
 * reformat the date line here. Clear it for the duration, put it back after.
 */
const withDefaultTimeZone = () => () => {
  const saved = globalThis.localStorage.getItem('yc_preferred_timezone');
  globalThis.localStorage.removeItem('yc_preferred_timezone');
  return () => {
    if (saved !== null) globalThis.localStorage.setItem('yc_preferred_timezone', saved);
  };
};

/** The row is the whole button; every measurement below is taken off it. */
const row = (canvasElement: HTMLElement, title: string): HTMLElement =>
  within(canvasElement).getByRole('button', { name: `Open ${title}` });

/** The 38px icon tile is the button's first child span. */
const iconTile = (rowElement: HTMLElement): HTMLElement =>
  rowElement.firstElementChild as HTMLElement;

const meta = {
  title: 'Documents/CompanionRecordRow',
  component: CompanionRecordRow,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One record in the companion records list. Everything visible is *derived* rather than ' +
          'echoed from the record, which is why it is worth stories: the icon comes from a ' +
          'sub-category lookup with two different fallbacks, the source line picks the first of ' +
          'four candidate fields, the attachment summary counts files and reads a MIME subtype, ' +
          'and the pills are computed. A row whose derivation broke still renders and still ' +
          'looks like a row.\n\n' +
          'Two things the design does not make obvious. **There is no zero-pill state**: ' +
          '`getRecordStatusPills` always seeds the list with Synced *or* Manual, so the pill ' +
          'cluster is one pill or two, never none - a row with an empty cluster means the helper ' +
          'stopped being called. And **the row never shows an empty field**: a record with no ' +
          'title reads "Untitled document", one with no issue date reads "Undated", one with no ' +
          'files reads "No attachments". All three are real API shapes, not defensive padding.\n\n' +
          'The whole row is a single button labelled `Open <title>`, so the icon, the chevron and ' +
          'the pills are all `aria-hidden` decoration inside it rather than separate stops.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    doc: record(),
    onOpen: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[560px] bg-[var(--page)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: withDefaultTimeZone(),
} satisfies Meta<typeof CompanionRecordRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Synced record, visible to the pet parent',
  args: {
    doc: record({
      id: 'rec-1',
      issuingBusinessName: ORG_NAME,
      syncedFromPms: true,
      pmsVisible: true,
    }),
  },
  play: async ({ args, canvasElement }) => {
    const target = row(canvasElement, 'Feline leukaemia panel');

    /* Both derived lines in full. Checking only that the title rendered would
       pass with the source, the sub-category label and the file summary all
       silently reduced to their fallbacks. */
    await expect(within(target).getByText(`Jul 14, 2026 · ${ORG_NAME}`)).toBeInTheDocument();
    await expect(within(target).getByText('Lab test · 1 file (PDF)')).toBeInTheDocument();

    // Synced outranks the uploader fields, and pmsVisible adds the second pill.
    await expect(
      Array.from(target.querySelectorAll('.yc-status-pill')).map((pill) => pill.textContent)
    ).toEqual(['Synced', 'PMS visible']);

    /* The tile is a fixed 38px square in the design and `flex-none`, so it must
       not shrink when the title crowds it (see the long-content story). */
    const tile = iconTile(target).getBoundingClientRect();
    await expect(tile.width).toBe(38);
    await expect(tile.height).toBe(38);

    /* One stop, not four. The icon tile and the chevron are hidden from the
       accessibility tree and nothing inside the row is focusable, so the record
       is reached by its single `Open <title>` button - a nested control here
       would also be invalid HTML inside a <button>. */
    await expect(iconTile(target)).toHaveAttribute('aria-hidden', 'true');
    await expect(within(target).queryAllByRole('button')).toHaveLength(0);

    await userEvent.click(target);
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The common case: a record the PMS created, carrying the practice name as its source ' +
          'and marked visible in the pet parent app.',
      },
    },
  },
};

export const ParentUpload: Story = {
  name: 'Uploaded by the pet parent',
  args: {
    doc: record({
      id: 'rec-2',
      title: 'Discharge summary, overnight stay',
      subcategory: 'DISCHARGE_SUMMARY',
      attachments: [
        { key: 'discharge.pdf', mimeType: 'application/pdf' },
        { key: 'meds.pdf', mimeType: 'application/pdf' },
        { key: 'consent.pdf', mimeType: 'application/pdf' },
      ],
      uploadedByParentId: 'parent-1',
    }),
  },
  play: async ({ canvasElement }) => {
    const target = row(canvasElement, 'Discharge summary, overnight stay');

    /* Exactly one pill. `pmsVisible` is absent here, and Manual is the *first*
       pill rather than an extra one - a two-pill cluster in this state would
       mean the source pill had been appended instead of seeded. */
    await expect(
      Array.from(target.querySelectorAll('.yc-status-pill')).map((pill) => pill.textContent)
    ).toEqual(['Manual']);

    /* Source falls through to the uploader: no issuing business, not synced,
       so "Pet parent" rather than the "Staff" that a record with neither gets. */
    await expect(within(target).getByText('Jul 14, 2026 · Pet parent')).toBeInTheDocument();
    // Plural summary, and the subtype is read off the first attachment only.
    await expect(within(target).getByText('Discharge summary · 3 files (PDF)')).toBeInTheDocument();
  },
};

export const MissingTitleAndDate: Story = {
  name: 'Untitled, undated, no files',
  args: {
    doc: record({ id: 'rec-3', title: '', issueDate: undefined, attachments: [] }),
  },
  play: async ({ canvasElement }) => {
    /* The fallback title is not cosmetic - it is the row's accessible name, so
       a record with no title would otherwise be a button called "Open ". */
    const target = row(canvasElement, 'Untitled document');
    await expect(within(target).getByText('Untitled document')).toBeInTheDocument();

    // "Undated · Staff": no date, and no uploader of any kind on the record.
    await expect(within(target).getByText('Undated · Staff')).toBeInTheDocument();
    await expect(within(target).getByText('Lab test · No attachments')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every optional field at once. `title` is typed as required but arrives empty from ' +
          'records created by an import, and `issueDate` is genuinely optional - the row has to ' +
          'stay a three-line block either way rather than collapsing to one.',
      },
    },
  },
};

export const LongContent: Story = {
  name: 'Long title and source',
  args: {
    doc: record({
      id: 'rec-4',
      title:
        'Pre-anaesthetic haematology and biochemistry panel with electrolytes, dated the morning of surgery',
      issuingBusinessName: 'Avenger Park Veterinary Hospital and Referral Centre, Northgate',
      syncedFromPms: true,
      pmsVisible: true,
    }),
  },
  play: async ({ canvasElement }) => {
    const target = within(canvasElement).getByRole('button', { name: /^Open Pre-anaesthetic/ });
    const title = within(target).getByText(/^Pre-anaesthetic haematology/);

    // The title really is clipped rather than wrapped to a second line.
    await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);

    /* And the clipping is what keeps the row inside its container: the text
       block is `min-w-0 flex-1` precisely so the pills and chevron are never
       pushed past the right edge. Measured on the row itself, because an
       overflowing child would still leave the page scroll width alone here. */
    await expect(target.scrollWidth).toBeLessThanOrEqual(target.clientWidth);

    const pills = Array.from(target.querySelectorAll('.yc-status-pill'));
    await expect(pills).toHaveLength(2);
    const rowRight = target.getBoundingClientRect().right;
    for (const pill of pills) {
      await expect(pill.getBoundingClientRect().right).toBeLessThanOrEqual(rowRight);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The case that decides whether the row clamps or blows out. All three text lines are ' +
          '`truncate`, so a long title costs an ellipsis rather than a taller row - which is ' +
          'what keeps a list of fifty records on a predictable rhythm.',
      },
    },
  },
};

export const TypedIcons: Story = {
  name: 'Icon derivation and its two fallbacks',
  // Three rows in one story on purpose: the assertion is that the glyphs DIFFER,
  // which needs them side by side. `doc` from the meta args is overridden on each.
  render: (args) => (
    <div className="flex flex-col gap-2">
      <CompanionRecordRow
        {...args}
        doc={record({
          id: 'icon-vaccination',
          title: 'Rabies vaccination certificate',
          subcategory: 'VACCINATION',
          syncedFromPms: true,
        })}
      />
      <CompanionRecordRow
        {...args}
        doc={record({
          id: 'icon-synced-fallback',
          title: 'Pet passport',
          subcategory: 'PASSPORT',
          syncedFromPms: true,
        })}
      />
      <CompanionRecordRow
        {...args}
        doc={record({
          id: 'icon-manual-fallback',
          title: 'Passport scan from a previous clinic',
          subcategory: 'PASSPORT',
          uploadedByParentId: 'parent-1',
        })}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const glyph = (title: string) =>
      (
        iconTile(row(canvasElement, title)).querySelector('svg path') as SVGPathElement
      ).getAttribute('d');

    const mapped = glyph('Rabies vaccination certificate');
    const syncedFallback = glyph('Pet passport');
    const manualFallback = glyph('Passport scan from a previous clinic');

    /* Three different glyphs from one helper. PASSPORT is a valid sub-category
       with no entry in either icon map, so it exercises the fallback arm - and
       the fallback itself forks on `syncedFromPms` (document) vs not (upload).
       Comparing the rendered path is the only way to catch the map silently
       collapsing to one icon: every arm renders *an* icon either way. */
    await expect(mapped).not.toBe(syncedFallback);
    await expect(syncedFallback).not.toBe(manualFallback);
    await expect(mapped).not.toBe(manualFallback);
  },
  parameters: {
    docs: {
      description: {
        story:
          '`getRecordIcon` looks the sub-category up in the health map, then the hygiene map, ' +
          'then falls back on the record’s origin. PASSPORT is the interesting value: it is a ' +
          'legal health sub-category that no map covers, so it reaches the fallback and forks on ' +
          'whether the PMS produced the record.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the pills win, the title clamps',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert - a story pinned that way renders at the full
  // panel width and still passes, proving nothing about the phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* And pinned AGAIN as a width, because the global alone is not enough for the
     measurements below: the viewport addon resizes the preview iframe from the
     manager, so a play function loaded straight from `iframe.html` (which is how
     the story verifier and any headless run reach it) measures the full panel
     width and passes on desktop geometry. The row has no media query, so a 375px
     box is the same reflow a phone gets. */
  decorators: [
    (Story) => (
      <div className="w-[375px]">
        <Story />
      </div>
    ),
  ],
  args: {
    doc: record({
      id: 'rec-5',
      title: 'Rabies vaccination certificate and booster schedule',
      subcategory: 'VACCINATION',
      issuingBusinessName: ORG_NAME,
      syncedFromPms: true,
      pmsVisible: true,
    }),
  },
  play: async ({ canvasElement }) => {
    const target = row(canvasElement, 'Rabies vaccination certificate and booster schedule');
    const title = within(target).getByText('Rabies vaccination certificate and booster schedule');

    /* The pill cluster is `flex-none`, so at 375px it keeps both pills side by
       side on one line and the title is what gives way. Worth measuring because
       the alternative - the cluster wrapping to a second line and doubling the
       row height - looks perfectly reasonable in a thumbnail, and because a
       title that stopped truncating would push the row off the screen. */
    const [synced, visible] = Array.from(target.querySelectorAll('.yc-status-pill'));
    await expect(visible.getBoundingClientRect().top).toBe(synced.getBoundingClientRect().top);
    await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
    await expect(target.scrollWidth).toBeLessThanOrEqual(target.clientWidth);
    await expect(target.getBoundingClientRect().width).toBe(375);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The row at 375px. There is no phone branch in the markup - one flex row reflows - so ' +
          'the only thing deciding whether it works is that the text block is the flexible child ' +
          'and the pills are not.',
      },
    },
  },
};
