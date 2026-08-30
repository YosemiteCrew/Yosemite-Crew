import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import AccessibilityStatement from './AccessibilityStatement';
/* The whole document skin - the `.yc-doc` prose rules, the section hairlines and
   the 900px contents fold - lives in this sheet, and only
   `(routes)/(public)/layout.tsx` loads it at runtime. Nothing in this page's import
   graph pulls it in: LegalDoc imports `./motion`, which only *mentions* the sheet in
   comments. Without this line the page still renders, so every computed-style
   assertion below would quietly be measuring browser defaults instead. */
import '../../marketing/site/marketing.css';

/**
 * The contents rail is authored by hand as `{ id, label }` pairs and the body is
 * authored by hand as `<DocSection id title>`. The two are matched by string and
 * nothing type-checks the pair, so this list is the story's copy of the contract.
 */
const TOC_LABELS = [
  'Our commitment',
  'Technical standard',
  'Conformance status',
  'Measures we take',
  'Report an accessibility barrier',
  'Alternative formats and support',
  'Third-party content',
] as const;

/** Headings are authored across several source lines, so compare on collapsed whitespace. */
const norm = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

const meta = {
  title: 'Legal/AccessibilityStatement',
  component: AccessibilityStatement,
  parameters: {
    layout: 'fullscreen',
    // Public page, so it keeps the lighter marketing inks rather than the PIMS
    // ones the preview decorator scopes to `[data-yc-app]`.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The published WCAG 2.2 AA accessibility statement: seven anchored sections behind ' +
          "LegalDoc's hero band and sticky contents rail.\n\n" +
          '`LegalDoc` has its own stories, but they run on invented fixture copy - so nothing ' +
          'covered this page. What is actually fragile here is not the shell, it is the wiring ' +
          'between the two hand-written halves of the document. The rail is a `TOC` array of ' +
          '`{ id, label }`; the body is a series of `<DocSection id title>`. Rename an id on one ' +
          'side, or reword a heading, and the page still compiles, still renders, and the contents ' +
          'entry silently becomes a link that jumps nowhere - in the one document where the ' +
          'contents is the only way to navigate.\n\n' +
          'The rest of what the stories pin is the statement itself: that it still names a ' +
          'conformance level (a WCAG statement without one is not a statement), that the report ' +
          'route and both inboxes are the ones the text promises, and that the off-site standards ' +
          'link opening in a new tab carries `rel="noopener"`.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AccessibilityStatement>;

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
          'The two-column form: the 220px rail stuck 100px from the top beside the prose column, ' +
          'with all seven entries visible at once.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exact name on purpose: the preview decorator injects an sr-only
    // `<h1>{title} - {story name}</h1>` into this canvas, so a bare level-1 query
    // is ambiguous and a loose text match would hit the decorator's heading.
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Accessibility Statement' })
    ).toBeInTheDocument();

    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;
    const links = [...nav.querySelectorAll('a')];
    await expect(links.map((link) => link.textContent)).toEqual([...TOC_LABELS]);

    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const sections = [...doc.querySelectorAll(':scope > section')];
    await expect(sections).toHaveLength(TOC_LABELS.length);

    /* The dead-anchor guard. Every entry has to resolve to a real section, and the
       label has to still describe the heading it lands on - a section renamed in
       the body but not in the rail is worse than a broken link, because the reader
       is told the wrong thing about where they are going. */
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      const section = canvasElement.querySelector(`section[id="${id}"]`);
      await expect(section).not.toBeNull();
      await expect(norm(section?.querySelector('h2')?.textContent)).toBe(norm(link.textContent));
    }

    /* Anchor jumps land under the site's sticky header without this offset, so the
       reader arrives at a section whose heading is hidden behind the chrome and has
       to scroll back up to find out where they are. It is set on the section rather
       than the h2 because the contents targets the section. */
    await expect(globalThis.getComputedStyle(sections[1]).scrollMarginTop).toBe('96px');
    // `section:first-child` opts out so the document opens flush against the hero;
    // every later section carries its own hairline.
    await expect(globalThis.getComputedStyle(sections[0]).borderTopWidth).toBe('0px');
    await expect(globalThis.getComputedStyle(sections[1]).borderTopWidth).toBe('1px');

    /* Four of the seven sections are lists, and `.yc-doc ul` drops the native
       marker so `.yc-doc li::before` can draw the blue dot instead. If the sheet
       stops reaching this page both halves go at once: native discs come back and
       the flex column gap collapses to plain block spacing. */
    const list = doc.querySelector('ul') as HTMLElement;
    await expect(globalThis.getComputedStyle(list).listStyleType).toBe('none');
    await expect(globalThis.getComputedStyle(list).display).toBe('flex');

    /* A WCAG statement that does not state a conformance level is not a
       conformance statement. "Partially conformant" is a deliberate, checkable
       claim and the four gaps under it are the disclosure that makes it honest. */
    const status = canvasElement.querySelector('section[id="status"]') as HTMLElement;
    await expect(within(status).getByText('Partially conformant.')).toBeInTheDocument();
    await expect(status.querySelectorAll('li')).toHaveLength(4);

    /* One off-site link, opened in a new tab. Without `rel="noopener"` the opened
       page gets a live `window.opener` back into this one, and the page looks and
       behaves identically either way. */
    const external = [...doc.querySelectorAll('a[target="_blank"]')];
    await expect(external).toHaveLength(1);
    await expect(external[0]).toHaveAttribute('href', 'https://www.w3.org/TR/WCAG22/');
    await expect(external[0].getAttribute('rel')).toContain('noopener');

    /* The three routes the statement promises a reader who hits a barrier. The
       form is a next/link, so a typo in the route is a 404 at runtime rather than
       a build error, and the two inboxes are deliberately different addresses. */
    await expect(
      canvas.getByRole('link', { name: 'accessibility barrier report form' })
    ).toHaveAttribute('href', '/accessibility/report');
    await expect(
      canvas.getByRole('link', { name: 'accessibility@yosemitecrew.com' })
    ).toHaveAttribute('href', 'mailto:accessibility@yosemitecrew.com');
    await expect(canvas.getByRole('link', { name: 'support@yosemitecrew.com' })).toHaveAttribute(
      'href',
      'mailto:support@yosemitecrew.com'
    );
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
          'above the prose, showing only its 48px toggle row. Seven entries is enough that the ' +
          'opened fold pushes the first section most of a screen down, which is the trade the ' +
          'collapse exists to make.',
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
    // Collapsed is a CSS decision, so the entries are in the markup at every width.
    // Losing one here would mean losing it from the desktop rail too.
    await expect(nav.querySelectorAll('a')).toHaveLength(TOC_LABELS.length);
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
          'The fold opened. Below 900px each entry gets a 44px minimum row instead of the ' +
          '14px-indented desktop line, so this really is a different control and not the rail ' +
          'reflowed.',
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
    // The entries have to be reachable, not merely present: a displayed list of
    // nothing would satisfy every assertion above.
    const links = [...nav.querySelectorAll('a')];
    await expect(links.map((link) => link.textContent)).toEqual([...TOC_LABELS]);
    await expect(links[0]).toHaveAttribute('href', '#commitment');
  },
};
