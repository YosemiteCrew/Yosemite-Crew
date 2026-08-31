import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { LegalBlocks, LegalSections } from './LegalContent';
import type { LegalBlock, LegalSection } from './legalContentTypes';
/* Every visual rule this renderer relies on - the blue `li::before` dot, the
   decimal markers on `ol`, the 700px measure, the table's own scroller, the
   17/16/15px heading ladder - lives in this sheet, and only
   `(routes)/(public)/layout.tsx` loads it at runtime. Nothing in LegalContent's
   import graph pulls it in: it imports `DocSection` from the marketing barrel,
   which reaches `./motion`, and that file only mentions the sheet in comments.
   Without this line the fixture still renders, so every computed-style assertion
   below would quietly be measuring browser defaults instead. */
import '../../marketing/site/marketing.css';

/**
 * Mirrors the module-private `MAX_NESTING` in LegalContent.tsx. It is not
 * exported, so this constant and the fixture built from it are the only place
 * the cap is ever exercised.
 */
const MAX_NESTING = 6;

/**
 * One fixture through every branch of `block()`, `inline()` and `cell()`.
 *
 * The `k` values deliberately repeat across parents (`b0` appears in four
 * different lists, `r0` in three different runs). That is the real content
 * modules' convention - `k` is documented as unique among SIBLINGS, not globally
 * - so a well-meaning change to globally-unique keys would mean rewriting
 * ~5,000 lines of content data. If that convention ever broke, React would log a
 * duplicate-key error while rendering this story.
 */
const BLOCKS: LegalBlock[] = [
  { k: 'b0', type: 'h3', content: '1. Definitions' },
  { k: 'b1', type: 'h4', content: '1.1. Emergency Downtime' },
  { k: 'b2', type: 'h5', content: '1.1.1. Excused Downtime' },
  {
    k: 'b3',
    type: 'p',
    content: [
      { k: 'r0', text: 'Emergency Downtime', bold: true },
      ' means such time as the SaaS Service is offline. Write to ',
      { k: 'r1', text: 'security@yosemitecrew.com', href: 'mailto:security@yosemitecrew.com' },
      ', use the ',
      { k: 'r2', text: 'data request form', href: '/contact-us' },
      ', or read ',
      { k: 'r3', text: 'the Clauses', href: 'https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj' },
      '.',
      { k: 'r4', br: true },
      'DuneXploration UG (haftungsbeschraenkt), Mainz',
    ],
  },
  {
    k: 'b4',
    type: 'text',
    content: 'A bare inline run, the shape a list item uses for its prose.',
  },
  {
    k: 'b5',
    type: 'ul',
    items: [
      { k: 'i0', blocks: [{ k: 'b0', type: 'text', content: 'the categories of personal data;' }] },
      {
        k: 'i1',
        blocks: [
          { k: 'b0', type: 'text', content: 'the recipients, which are:' },
          {
            k: 'b1',
            type: 'ul',
            items: [
              { k: 'i0', blocks: [{ k: 'b0', type: 'text', content: 'our hosting provider;' }] },
              { k: 'i1', blocks: [{ k: 'b0', type: 'text', content: 'our payment processor.' }] },
            ],
          },
        ],
      },
    ],
  },
  {
    k: 'b6',
    type: 'ol',
    items: [
      { k: 'i0', blocks: [{ k: 'b0', type: 'text', content: 'Notify us in writing.' }] },
      { k: 'i1', blocks: [{ k: 'b0', type: 'text', content: 'Allow thirty days to cure.' }] },
      { k: 'i2', blocks: [{ k: 'b0', type: 'text', content: 'Terminate for cause.' }] },
    ],
  },
  {
    k: 'b7',
    type: 'table',
    caption: 'Service levels by severity',
    head: ['Severity', 'Response time', 'Resolution target'],
    rows: [
      {
        k: 'r0',
        cells: [
          { k: 'c0', content: 'Severity 1', header: true },
          { k: 'c1', content: '1 hour from Start Time' },
          { k: 'c2', content: [{ k: 'r0', text: '4 hours', bold: true }, ' from Start Time'] },
        ],
      },
      {
        k: 'r1',
        cells: [
          { k: 'c0', content: 'Severity 2', header: true },
          { k: 'c1', content: '4 hours from Start Time' },
          { k: 'c2', content: 'Next scheduled Update' },
        ],
      },
    ],
  },
];

/**
 * A chain of `MAX_NESTING + 1` unordered lists.
 *
 * The outermost renders at depth 0, so the innermost is reached at depth 6 and
 * `block()` returns null for it. Its sibling text block is reached at the same
 * depth and is NOT capped, which is the distinction the story exists to pin: the
 * guard is meant to stop unbounded recursion, not to swallow content that
 * happens to sit at the boundary.
 */
const buildCappedChain = (): LegalBlock => {
  let node: LegalBlock = {
    k: 'l1',
    type: 'ul',
    items: [
      {
        k: 'i0',
        blocks: [
          { k: 'b0', type: 'text', content: 'Sibling at the cap depth.' },
          {
            k: 'l0',
            type: 'ul',
            items: [
              { k: 'i0', blocks: [{ k: 'b0', type: 'text', content: 'Past the cap, dropped.' }] },
            ],
          },
        ],
      },
    ],
  };
  for (let level = 2; level <= MAX_NESTING; level += 1) {
    node = { k: `l${level}`, type: 'ul', items: [{ k: 'i0', blocks: [node] }] };
  }
  return node;
};

const DEEP_BLOCKS: LegalBlock[] = [
  { k: 'b0', type: 'h3', content: 'Nesting guard' },
  buildCappedChain(),
];

const SECTIONS: LegalSection[] = [
  {
    id: 'definitions',
    title: '1. Definitions',
    blocks: [{ k: 'b0', type: 'p', content: 'Capitalised terms have the meanings given below.' }],
  },
  {
    id: 'scope',
    title: '2. Scope',
    blocks: [
      { k: 'b0', type: 'h3', content: '2.1. Hosted service only' },
      { k: 'b1', type: 'p', content: 'These terms govern the hosted service, not the Software.' },
    ],
  },
  {
    id: 'exhibit-a',
    title: 'Exhibit A: Support Services and Service Level Policy',
    blocks: [{ k: 'b0', type: 'p', content: 'Support hours, severities and response times.' }],
  },
];

const meta = {
  title: 'Legal/LegalContent',
  component: LegalBlocks,
  parameters: {
    layout: 'fullscreen',
    // Public page, so it keeps the lighter marketing inks rather than the PIMS
    // ones the preview decorator scopes to `[data-yc-app]`.
    surface: 'marketing',
    // `inline()` renders an internal href through next/link, which needs a router.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The renderer that turns the `LegalBlock` union into the privacy policy and the terms: ' +
          '`LegalBlocks` for one run of blocks, `LegalSections` for a whole anchored document.\n\n' +
          'The text of both documents is data rather than JSX, so this ~110-line recursive switch ' +
          'is the entire rendering contract for roughly 6,500 lines of contract copy. It is also ' +
          'the one file in the legal area with real branching, and every branch fails the same ' +
          'quiet way: a wrong tag still renders text. An `ol` emitted as a `ul` loses its clause ' +
          'numbers outright, because `.yc-doc ul` sets `list-style: none` and paints a dot from ' +
          '`li::before` - so numbered obligations in a contract silently become bullets. An `h4` ' +
          'emitted as an `h5` is a 1px font-size difference on screen and a broken document ' +
          'outline for a screen reader. A `text` block emitted as a `p` gains 16px of margin and ' +
          'breaks out of the flex row its list item lays out.\n\n' +
          'The fixture here is small on purpose: it walks every branch - three heading levels, ' +
          'paragraph vs bare text, unordered vs ordered, a list nested inside a list item, a ' +
          'table with its visually hidden caption and column heads, row-header vs data cells, and ' +
          'all four inline runs (bold, break, internal route, off-site link). The nesting story ' +
          'drives the `MAX_NESTING` cap, which no content module reaches and nothing else covers.',
      },
    },
  },
  tags: ['autodocs'],
  args: { blocks: BLOCKS },
  decorators: [
    /* The renderer emits bare `h3`/`p`/`ul`/`table` with no classes of its own -
       all of its styling is inherited from `.yc-doc` on an ancestor, which the
       real pages get from LegalDoc. Rendering the fixture outside that wrapper
       would be rendering a different component.

       `docWidth` pins the column for the stories that measure it. The viewport
       global sizes the preview IFRAME from the manager, so it is real in the
       Storybook UI and in Chromatic but absent for anything that loads
       `iframe.html` directly - which is how the story verifier runs. A geometry
       assertion that leans on the global alone therefore measures the full panel
       width and passes for the wrong reason: the phone story below asserted a
       table was overflowing and was handed a 700px one. */
    (Story, context) => (
      <div
        data-yc-theme
        className="yc-doc"
        style={{
          background: 'var(--screen)',
          color: 'var(--ink-body)',
          padding: 24,
          width: (context.parameters.docWidth as number | undefined) ?? 'auto',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LegalBlocks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blocks: Story = {
  name: 'Every block and inline branch',
  globals: { viewport: { value: 'laptop', isRotated: false } },
  parameters: {
    chromatic: { viewports: [1280] },
    docs: {
      description: {
        story:
          'One fixture through the whole switch. Read top to bottom it is also the house style ' +
          'guide for the legal documents: the h3/h4/h5 ladder, the 700px measure every block type ' +
          'shares, the blue dot on unordered items against decimal markers on ordered ones, and a ' +
          'table whose caption and column heads are present for a screen reader and invisible on ' +
          'screen.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const canvas = within(doc);
    const style = (node: Element, pseudo?: string) =>
      globalThis.getComputedStyle(node, pseudo ?? null);

    /* Scoped to `.yc-doc` rather than the canvas because the preview decorator
       injects an sr-only `<h1>{title} - {story name}</h1>` as a sibling, and a
       loose heading or text query up there is ambiguous. */

    // The heading ladder. Three separate `case` arms map three type strings onto
    // three tags, and the rendered difference between h4 and h5 is one pixel of
    // font size - so a copy-paste slip between the arms is invisible on screen
    // while the document outline a screen reader announces silently flattens.
    const headings = [3, 4, 5].map((level) => canvas.getByRole('heading', { level }));
    await expect(headings.map((node) => node.textContent)).toEqual([
      '1. Definitions',
      '1.1. Emergency Downtime',
      '1.1.1. Excused Downtime',
    ]);
    await expect(headings.map((node) => style(node).fontSize)).toEqual(['17px', '16px', '15px']);

    /* `text` exists so a list item's prose sits inline inside its `<li>`. Rendered
       through the `default` arm instead it would be a `<p>`: block level, 16px of
       bottom margin, and dropped out of the `li` flex row that the nested-list
       layout depends on. */
    const bare = canvas.getByText('A bare inline run, the shape a list item uses for its prose.');
    await expect(bare.tagName).toBe('SPAN');
    await expect(style(bare).display).toBe('inline');

    const paragraphs = [...doc.querySelectorAll(':scope > p')];
    await expect(paragraphs).toHaveLength(1);
    const para = paragraphs[0];

    /* `<strong>` and not `<b>` or a span: `.yc-doc strong` supplies both the
       weight and the darker `--ink-body`, and in these documents the bold run is
       the defined term being introduced. 600 rather than the user-agent's 700 is
       what proves the sheet reached it, so this doubles as the styling check. */
    const strong = para.querySelector('strong') as HTMLElement;
    await expect(strong.textContent).toBe('Emergency Downtime');
    await expect(style(strong).fontWeight).toBe('600');

    // The address blocks in the privacy policy are a single paragraph broken by
    // `br` runs, so losing this arm reflows a postal address onto one line.
    await expect(para.querySelectorAll('br')).toHaveLength(1);

    /* `run.href.startsWith('/')` is the only thing choosing next/link over a bare
       anchor, and both compile to an `<a>` with the same href - so what is
       checkable here is that all three run shapes survive verbatim. That still
       catches the change that matters: widen the internal test (to "not http",
       say) and `mailto:` starts being handed to the router, which cannot route
       it. */
    await expect([...para.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      'mailto:security@yosemitecrew.com',
      '/contact-us',
      'https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj',
    ]);

    const ul = doc.querySelector(':scope > ul') as HTMLElement;
    const ol = doc.querySelector(':scope > ol') as HTMLElement;

    /* The `ul`/`ol` arms share a code path and differ only by the tag name they
       hand to `<List>`, but the two are not interchangeable on screen. `.yc-doc
       ul` removes the native marker and draws a blue dot from `li::before`;
       `.yc-doc ol li` restores `list-style: decimal` and cancels that dot. Emit an
       ordered list as an unordered one and the clause numbers do not move or
       restyle, they cease to exist - in a document whose cross-references are
       clause numbers. */
    const ulItem = ul.querySelector(':scope > li') as HTMLElement;
    const olItem = ol.querySelector(':scope > li') as HTMLElement;
    await expect(style(ul).listStyleType).toBe('none');
    await expect(style(ulItem, '::before').content).not.toBe('none');
    await expect(style(olItem).listStyleType).toBe('decimal');
    await expect(style(olItem, '::before').content).toBe('none');

    /* One level of nesting: a `ul` inside an `li` of another `ul`, which is the
       deepest shape the real content uses. The indent is not the list's - `.yc-doc
       ul` has `padding-left: 0` - it comes entirely from the parent `li`'s 26px
       padding, so the nested list is offset by exactly the width that leaves room
       for the parent's dot. Measured as a relation so it holds at any width. */
    const nested = ul.querySelector(':scope > li > ul') as HTMLElement;
    await expect(nested.querySelectorAll(':scope > li')).toHaveLength(2);
    await expect(ul.querySelectorAll(':scope > li')).toHaveLength(2);
    const nestedItem = nested.querySelector(':scope > li') as HTMLElement;
    const indent = nestedItem.getBoundingClientRect().left - ulItem.getBoundingClientRect().left;
    await expect(Math.round(indent)).toBe(26);

    const table = doc.querySelector('table') as HTMLElement;
    const caption = table.querySelector('caption') as HTMLElement;
    const thead = table.querySelector('thead') as HTMLElement;

    /* The caption and the column heads are the table's only accessible structure:
       these tables carry no visible header row, so a screen reader has nothing to
       announce a cell against unless both survive. They are also the two places
       the renderer hard-codes a class name, which nothing type-checks. */
    await expect(caption.textContent).toBe('Service levels by severity');
    await expect(caption).toHaveClass('sr-only');
    await expect(thead).toHaveClass('sr-only');
    await expect(
      [...thead.querySelectorAll('th')].map((th) => [th.textContent, th.getAttribute('scope')])
    ).toEqual([
      ['Severity', 'col'],
      ['Response time', 'col'],
      ['Resolution target', 'col'],
    ]);

    /* The visible consequence of that class, and the half a missing `sr-only`
       would show: `.yc-doc thead:not(.sr-only) th` paints the header row with the
       `--inset` background. A hidden head has to stay transparent, or the
       document grows a header row it was authored not to have. */
    await expect(style(thead.querySelector('th') as HTMLElement).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)'
    );

    /* `cell()` picks `th scope="row"` or `td` off one optional flag. Row headers
       are what let a screen reader say "Severity 1, resolution target, 4 hours"
       instead of reading three unattached values, and the two render almost
       identically because `.yc-doc th, .yc-doc td` share every rule. */
    const firstRow = table.querySelector('tbody tr') as HTMLElement;
    await expect([...firstRow.children].map((node) => node.tagName)).toEqual(['TH', 'TD', 'TD']);
    await expect(firstRow.children[0]).toHaveAttribute('scope', 'row');
    // Cells take inline runs too, not just strings.
    await expect(firstRow.querySelector('td strong')?.textContent).toBe('4 hours');

    /* The reading measure. Four different block arms each have to land on the
       same 700px column or the document reads as ragged blocks of different
       widths, and the table additionally has to be its own scroll container - it
       is the only block type that can be wider than the measure. */
    const widths = [para, ul, ol, table].map((node) =>
      Math.round(node.getBoundingClientRect().width)
    );
    await expect(widths).toEqual([700, 700, 700, 700]);
    await expect(style(table).display).toBe('block');
    await expect(style(table).overflowX).toBe('auto');
  },
};

export const Phone: Story = {
  name: 'Phone (the table takes the overflow)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    // The prose column, pinned rather than inherited from the viewport global -
    // see the decorator. 375 minus the 24px gutters leaves a 327px measure.
    docWidth: 375,
    docs: {
      description: {
        story:
          'At 375 every block arm reflows to the viewport except the table, whose three columns ' +
          'carry a 140px minimum each and cannot. That is the one place this renderer can break ' +
          'the page, and it has: the fix was to make the table its own scroller and let the ' +
          'document column shrink, so the story asserts both halves of it.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const table = doc.querySelector('table') as HTMLElement;

    /* Three columns at `min-width: 140px` cannot fit a 375 viewport, so the table
       really is overflowing here - this is not a table that happens to fit and
       would pass whatever the overflow rules said. */
    await expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);

    /* And the overflow stops there. Drop `overflow-x: auto` and the excess
       propagates to the prose column; because the public page clips overflow-x
       rather than scrolling it, the symptom is not a scrollbar but the right edge
       sliced off every line in the document, tables and paragraphs alike. */
    await expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);

    // The prose arms reflow instead of clamping to the desktop measure, so the
    // 700px cap is a maximum and not a fixed width.
    const para = doc.querySelector(':scope > p') as HTMLElement;
    await expect(para.getBoundingClientRect().width).toBeLessThan(700);
  },
};

export const NestingCap: Story = {
  name: 'Nesting cap (depth 6 drops the list, keeps its sibling)',
  args: { blocks: DEEP_BLOCKS },
  parameters: {
    docs: {
      description: {
        story:
          'Seven lists nested one inside another. The real content never nests deeper than two, ' +
          'so nothing but this reaches the guard - and an unbounded-recursion guard that is never ' +
          'exercised is a guard nobody knows the shape of. What it turns out to do is cull the ' +
          'over-deep list and nothing else: a block sitting beside it at the same depth still ' +
          'renders, so a malformed content module loses a list rather than a section.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const canvas = within(doc);

    /* The cap is off-by-one sensitive in both directions and neither direction
       shows up on screen: one too low silently truncates content the documents
       legitimately use, one too high (or dropped) leaves an unbounded recursion
       that only a malformed module would find, as a blown stack in production. */
    await expect(doc.querySelectorAll('ul')).toHaveLength(MAX_NESTING);

    /* What is culled is the list, not the item that holds it. The sibling block
       is reached at the same depth 6 and still renders, so the guard cannot be
       quietly eating adjacent prose. */
    await expect(canvas.getByText('Sibling at the cap depth.')).toBeInTheDocument();
    await expect(canvas.queryByText('Past the cap, dropped.')).toBeNull();

    // The whole subtree goes, not just its first level: the deepest surviving
    // item ends up with the sibling text and no list at all.
    const deepest = [...doc.querySelectorAll('li')].at(-1) as HTMLElement;
    await expect(deepest.querySelector('ul')).toBeNull();
    await expect(deepest.textContent).toBe('Sibling at the cap depth.');
  },
};

export const Sections: Story = {
  name: 'Sections (anchored document)',
  render: () => <LegalSections sections={SECTIONS} />,
  parameters: {
    docs: {
      description: {
        story:
          '`LegalSections` is the half that makes a document navigable: it wraps each section in ' +
          '`DocSection`, which owns the `id` the contents rail jumps to and the serif `<h2>`. ' +
          'Both legal pages derive their rail from the same array with ' +
          '`SECTIONS.map(({ id, title }) => ({ id, label: title }))`, so the pairing cannot drift ' +
          'the way it can on the hand-written legal pages - what can still go is the heading level ' +
          'and the scroll offset, and both are invisible until someone follows a link.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const sections = [...doc.querySelectorAll(':scope > section')];

    // The ids are what the contents rail's hrefs are built from, so an id that
    // does not reach the DOM is a rail entry that jumps nowhere.
    await expect(sections.map((section) => section.id)).toEqual(SECTIONS.map(({ id }) => id));
    await expect(sections.map((section) => section.querySelector('h2')?.textContent)).toEqual(
      SECTIONS.map(({ title }) => title)
    );

    /* The outline contract between the two components: `DocSection` owns h2 and
       `block()` has no h2 arm at all, so the deepest a section's own content can
       start is h3. Give the block renderer an h2 and every section heading in the
       document stops being distinguishable from the prose inside it. */
    await expect(doc.querySelectorAll('h2')).toHaveLength(SECTIONS.length);
    await expect(sections[1].firstElementChild?.tagName).toBe('H2');
    await expect(sections[1].querySelector('h3')?.textContent).toBe('2.1. Hosted service only');

    /* Anchor jumps land under the site's sticky header without this offset, so a
       reader following a contents link arrives at a section whose title is behind
       the chrome. It is set on the section because the link targets the section. */
    const style = (node: Element) => globalThis.getComputedStyle(node);
    await expect(style(sections[1]).scrollMarginTop).toBe('96px');
    // The first section opens flush against the hero; every later one carries its
    // own hairline. Only true while the sections are the first children of
    // `.yc-doc`, which is why the privacy policy - whose intro paragraph goes in
    // ahead of them - looks different here.
    await expect(style(sections[0]).borderTopWidth).toBe('0px');
    await expect(style(sections[1]).borderTopWidth).toBe('1px');
  },
};
