import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import TermsAndConditions from './TermsAndConditions';
import { TERMS_SECTIONS } from './content';
/* The whole document skin - the `.yc-doc` prose rules, the section hairlines, the
   700px measure, the table's own scroll container and the 900px contents fold -
   lives in this sheet, and only `(routes)/(public)/layout.tsx` loads it at
   runtime. Nothing in this page's import graph pulls it in: LegalDoc imports
   `./motion`, which only mentions the sheet in comments. Without this line the
   page still renders, so every computed-style assertion below would quietly be
   measuring browser defaults. */
import '../../marketing/site/marketing.css';

/** Headings are authored across several source lines, so compare on collapsed whitespace. */
const norm = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

/** The agreement's closing run, in the order the index module concatenates it. */
const ANNEXES = ['exhibit-a', 'exhibit-b', 'appendix-1', 'appendix-2'] as const;

const meta = {
  title: 'Legal/TermsAndConditions',
  component: TermsAndConditions,
  parameters: {
    layout: 'fullscreen',
    // Public page, so it keeps the lighter marketing inks rather than the PIMS
    // ones the preview decorator scopes to `[data-yc-app]`.
    surface: 'marketing',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The Yosemite Crew License and Subscription Terms: twenty-three anchored sections ' +
          "inside LegalDoc's hero band and sticky contents rail.\n\n" +
          '`TERMS_SECTIONS` is not one document, it is five content modules concatenated - the ' +
          'numbered body, then Exhibit A (support and service levels), Exhibit B (the data ' +
          'processing agreement), and Appendices 1 and 2 (the Standard Contractual Clauses and ' +
          'their annexes). Roughly 5,000 lines of content data, assembled here and nowhere else, ' +
          'and the concatenation is the substance: in an agreement, an exhibit that arrives ' +
          'before the clause incorporating it, or an appendix that stops arriving at all, changes ' +
          'what has been agreed. Nothing type-checks the order.\n\n' +
          'This is also the only legal document with tables, thirteen of them, and the only one ' +
          'wide enough to break the page. Each is a `display: block` scroll container precisely ' +
          'so the prose column can stay narrower than its widest row; before that, a phone got ' +
          'the right edge sliced off every line of the agreement rather than a scrollbar. The ' +
          'tables carry no visible header row either, so their column headings exist only as a ' +
          'visually hidden `thead`, and whether a cell is announced against the right heading is ' +
          'entirely a question of the rows lining up with it. Ten of them do not: the Annex II ' +
          'processing matrices declare four columns and then emit their continuation rows one ' +
          'cell wide, which puts a list of personal-data categories under "Module" rather than ' +
          'under "Categories of Personal Data". The story pins that shape where it is rather ' +
          'than papering over it.\n\n' +
          'The rendered page is very tall - the agreement plus its annexes - so a visual snapshot ' +
          'of it runs to tens of thousands of pixels.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TermsAndConditions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  name: 'Desktop (contents rail open)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: {
    chromatic: { viewports: [1440] },
    docs: {
      description: {
        story:
          'The two-column form, with the longest rail in the set: nineteen numbered clauses ' +
          'followed by the four annexes. The rail is taller than a screen, which is what the ' +
          '`position: sticky` on it is for.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const style = (node: Element) => globalThis.getComputedStyle(node);

    // Exact name on purpose: the preview decorator injects an sr-only
    // `<h1>{title} - {story name}</h1>` into this canvas, so a bare level-1 query
    // is ambiguous and a loose text match would hit the decorator's heading.
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Terms and conditions' })
    ).toBeInTheDocument();

    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;
    const links = [...nav.querySelectorAll('a')];
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const sections = [...doc.querySelectorAll(':scope > section')];

    /* The rail is derived from the same array as the body, so the two cannot
       drift the way they can on the hand-written legal pages. What this proves is
       that the derivation reaches the DOM intact and in order - `LegalSections`
       passes `section.id` to `DocSection`, and an id that stops arriving turns
       every rail entry below it into a link that jumps nowhere. */
    await expect(links.map((link) => norm(link.textContent))).toEqual(
      TERMS_SECTIONS.map(({ title }) => norm(title))
    );
    await expect(sections.map((section) => section.id)).toEqual(TERMS_SECTIONS.map(({ id }) => id));
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      const section = canvasElement.querySelector(`section[id="${id}"]`);
      await expect(section).not.toBeNull();
      await expect(norm(section?.querySelector('h2')?.textContent)).toBe(norm(link.textContent));
    }

    /* The concatenation contract. `TERMS_SECTIONS` spreads five modules in a fixed
       order, and the annexes have to close the document: an exhibit rendered
       among the numbered clauses is a different agreement, and a spread quietly
       dropped in a merge removes an annex while leaving a page that still reads
       as complete. Asserted against the tail of the DOM rather than the array so
       it also covers the rendering. */
    const ids = sections.map((section) => section.id);
    await expect(ids.slice(-ANNEXES.length)).toEqual([...ANNEXES]);
    await expect(ids.findIndex((id) => id === ANNEXES[0])).toBe(ids.length - ANNEXES.length);

    /* The numbered spine of the body. Note the gap: the agreement runs 1 to 18 and
       then jumps to 20, because `termsBody.ts` has no section 19 at all. That is
       how the published document reads today, so it is pinned as-is rather than
       as a range - if a clause 19 is ever restored this fails, which is the point. */
    const numbered = TERMS_SECTIONS.map(({ title }) => /^(\d+)\./.exec(title)?.[1])
      .filter(Boolean)
      .map(Number);
    await expect(numbered).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20,
    ]);

    /* Unlike the privacy policy, nothing is rendered ahead of the sections, so the
       first one really is `.yc-doc section:first-child` and opens flush against
       the hero with no hairline. The two documents differ here and both are
       deliberate. */
    await expect(style(sections[0]).borderTopWidth).toBe('0px');
    await expect(style(sections[1]).borderTopWidth).toBe('1px');
    // Anchor jumps land under the sticky site header without this offset.
    await expect(style(sections[1]).scrollMarginTop).toBe('96px');

    // An emptied `blocks` array is valid data: it still produces a rail entry and
    // an `<h2>`, so a clause can go missing while the document looks complete.
    for (const section of sections) {
      await expect(section.children.length).toBeGreaterThan(1);
    }

    /* The tables. Not one of them has a visible header row, so the only thing
       naming a column is the `thead.sr-only`, and whether any cell is announced
       against the right heading rides entirely on the rows lining up with it. */
    const tables = [...doc.querySelectorAll('table')];
    await expect(tables.length).toBeGreaterThan(10);

    const ragged: string[] = [];
    for (const table of tables) {
      const head = table.querySelector('thead') as HTMLElement;
      await expect(head).not.toBeNull();
      await expect(head).toHaveClass('sr-only');
      const columns = [...head.querySelectorAll('th')];
      await expect(columns.every((th) => th.getAttribute('scope') === 'col')).toBe(true);

      const rows = [...table.querySelectorAll('tbody tr')];
      // The head has to match the row it was written for, and no row may be wider
      // than the head: a cell past the last column is announced against nothing.
      await expect(rows[0].children.length).toBe(columns.length);
      for (const row of rows) {
        await expect(row.children.length).toBeLessThanOrEqual(columns.length);
        if (row.children.length !== columns.length) {
          ragged.push(table.closest('section')?.id ?? '');
        }
      }

      /* And each table owns its overflow. `.yc-doc table` is `display: block` with
         `overflow-x: auto` so a row wider than the measure scrolls inside the
         table instead of widening the column that holds it. */
      await expect(style(table).display).toBe('block');
      await expect(style(table).overflowX).toBe('auto');
    }

    /* The ragged rows, pinned as they are rather than asserted away. The Annex II
       processing matrices declare four columns, then generate their continuation
       rows through `categoryRows` in `termsAppendix1.ts` as a single cell each -
       intended, per that helper's own comment, to read as one more entry under
       "Categories of Personal Data", the SECOND column. A one-cell `<tr>` lands in
       the first, so those rows sit under "Module" both on screen and in what a
       screen reader announces. Exhibit A's two tables are rectangular, which is
       what makes scoping this to one section meaningful: it says the shape is a
       property of that one generator and not of the renderer, and it is the
       assertion that notices when either changes. */
    await expect([...new Set(ragged)]).toEqual(['appendix-1']);

    /* The other half of that fix, and the one that actually broke: grid items are
       `min-width: auto` by default, so the widest table's min-content width would
       stretch the document column past the viewport. Because the public page clips
       overflow-x rather than scrolling it, the symptom was not a scrollbar - it
       was the right edge sliced off every line in the agreement. `[data-doc-grid]
       > *` overrides it, and a computed `auto` here is that bug returning. */
    await expect(style(doc).minWidth).toBe('0px');
    await expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);

    /* Link hygiene, asserted as sets so a content update does not have to touch
       this story. The terms promise no in-app route at all - every link leaves the
       site - and the two published mailboxes are deliberately different: support@
       is the Exhibit A support channel that the service levels are measured
       against, security@ is the Appendix 1 contact for the sub-processor list. The
       off-site links are the cloud providers' own DPAs and security pages, which
       this agreement cites as the basis of its transfer claim; over plain http one
       could be rewritten in transit. */
    const hrefs = [...doc.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
    await expect(hrefs.every(Boolean)).toBe(true);
    await expect(hrefs.filter((href) => href.startsWith('/'))).toEqual([]);
    await expect([...new Set(hrefs.filter((href) => href.startsWith('mailto:')))].sort()).toEqual([
      'mailto:security@yosemitecrew.com',
      'mailto:support@yosemitecrew.com',
    ]);
    const offsite = hrefs.filter((href) => !href.startsWith('mailto:'));
    await expect(offsite.every((href) => href.startsWith('https://'))).toBe(true);

    /* `inline()` never emits a `target`, so nothing here opens a new tab and there
       is no `window.opener` to sever. Add `target="_blank"` to the off-site arm
       without `rel="noopener"` and every cited provider gets a live handle back
       into this page. */
    await expect(doc.querySelectorAll('a[target]')).toHaveLength(0);
  },
};

export const Phone: Story = {
  name: 'Phone (contents collapsed)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'At 375 the grid collapses to one column and the rail becomes a bordered `--inset` card ' +
          'above the prose, showing only its 48px toggle row. Twenty-three entries is the longest ' +
          'contents in the set, and several annex labels wrap - left open it would be several ' +
          'screens before the agreement starts.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('.yc-toc-toggle') as HTMLButtonElement;
    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;

    /* This pair is the whole phone contents control and neither half is
       type-checked. `aria-controls` naming an element that does not exist reads to
       a screen reader as a button that governs nothing, and it is invisible at
       every width: above 900px the button is `display: none`, below it the only
       visible symptom is a correct-looking `+`. */
    await expect(toggle).toHaveAttribute('aria-controls', 'yc-toc-list');
    await expect(nav.id).toBe(toggle.getAttribute('aria-controls'));
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).toHaveAttribute('data-open', 'false');
    // Collapsed is a CSS decision, so all twenty-three entries are in the markup
    // at every width. Losing one here would mean losing it from the desktop rail.
    await expect(nav.querySelectorAll('a')).toHaveLength(TERMS_SECTIONS.length);

    // The document column takes no overflow from its thirteen tables at any
    // width; each of them scrolls on its own instead.
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    await expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
  },
};

export const PhoneContentsOpen: Story = {
  name: 'Phone (contents open)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The fold opened on the longest contents in the legal set. Below 900px each entry gets ' +
          'a 44px minimum row instead of the 14px-indented desktop line, and the four annex ' +
          'labels wrap onto two, so this really is a different control and not the rail reflowed.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('.yc-toc-toggle') as HTMLButtonElement;
    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;

    await userEvent.click(toggle);

    /* `aria-expanded` flipping proves only that React re-rendered. What actually
       shows the list is `.yc-toc-list[data-open='true']` in the 900px block, so
       assert the attribute the selector keys on AND that the list is displayed -
       drop `data-open` from the JSX and the state still flips while the phone
       contents stays permanently shut. */
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toHaveAttribute('data-open', 'true');
    await expect(globalThis.getComputedStyle(nav).display).toBe('flex');

    const links = [...nav.querySelectorAll('a')];
    await expect(links.map((link) => norm(link.textContent))).toEqual(
      TERMS_SECTIONS.map(({ title }) => norm(title))
    );

    /* The annexes are the entries a reader is most likely to jump straight to -
       they are where the sub-processors and the SCCs live - and they are the last
       four, at the bottom of a list that is several screens long on a phone. Pin
       their anchors explicitly. */
    await expect(links.slice(-ANNEXES.length).map((link) => link.getAttribute('href'))).toEqual(
      ANNEXES.map((id) => `#${id}`)
    );

    /* Tapping an entry closes the fold on the way to the anchor - the `onClick` on
       each link, not just on the toggle. Without it the reader jumps to a clause
       and lands with a twenty-three entry list still covering it, which reads as
       the jump having failed. */
    await userEvent.click(links[links.length - 1]);
    await expect(nav).toHaveAttribute('data-open', 'false');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  },
};
