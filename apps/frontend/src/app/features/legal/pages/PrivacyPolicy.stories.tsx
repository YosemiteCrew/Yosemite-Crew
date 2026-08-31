import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import PrivacyPolicy from './PrivacyPolicy';
import { PRIVACY_SECTIONS } from './content';
/* The whole document skin - the `.yc-doc` prose rules, the section hairlines, the
   700px measure and the 900px contents fold - lives in this sheet, and only
   `(routes)/(public)/layout.tsx` loads it at runtime. Nothing in this page's
   import graph pulls it in: LegalDoc imports `./motion`, which only mentions the
   sheet in comments. Without this line the page still renders, so every
   computed-style assertion below would quietly be measuring browser defaults. */
import '../../marketing/site/marketing.css';

/** Headings are authored across several source lines, so compare on collapsed whitespace. */
const norm = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

const meta = {
  title: 'Legal/PrivacyPolicy',
  component: PrivacyPolicy,
  parameters: {
    layout: 'fullscreen',
    // Public page, so it keeps the lighter marketing inks rather than the PIMS
    // ones the preview decorator scopes to `[data-yc-app]`.
    surface: 'marketing',
    // One content run links an internal route through next/link.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The published GDPR privacy policy: thirteen anchored sections built from ' +
          '`PRIVACY_SECTIONS`, opened by the unanchored `PRIVACY_INTRO` paragraph, inside ' +
          "LegalDoc's hero band and sticky contents rail.\n\n" +
          'The page itself is twenty lines, but it is the only place roughly 1,500 lines of ' +
          'content data are ever assembled and drawn, so this is where a content edit is seen. ' +
          'Unlike the hand-written legal pages the rail cannot drift from the body - both come ' +
          'from the same array - so what the stories pin instead is the assembly and the ' +
          'document-level invariants nothing type-checks: that the intro really does sit outside ' +
          'the anchored run (which is also why this document, alone in the set, opens with a ' +
          'hairline above its first section), that the numbered spine still runs 1 to 11 without ' +
          'a gap, that no section came out empty, and that every one of the ~25 links the policy ' +
          'makes is still the kind of link it claims to be.\n\n' +
          'That last one is the substance of a privacy policy rather than decoration. A ' +
          'controller has to be reachable at the address it publishes, the rights it grants have ' +
          'to lead to a route that exists, and the third-party policies it cites have to be ' +
          'fetched over a channel that cannot be rewritten in transit.\n\n' +
          'The rendered page is very tall - roughly twenty thousand words - so a visual snapshot ' +
          'of it runs to tens of thousands of pixels.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PrivacyPolicy>;

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
          'The two-column form: a 220px rail stuck 100px from the top beside the prose column. ' +
          'This document holds the longest rail label in the legal set - section 8 is a ' +
          '77-character question - so it is also where the fixed track has to prove it makes the ' +
          'label wrap rather than widening itself.',
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
      canvas.getByRole('heading', { level: 1, name: 'Privacy policy' })
    ).toBeInTheDocument();

    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;
    const links = [...nav.querySelectorAll('a')];
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const sections = [...doc.querySelectorAll(':scope > section')];

    /* The rail is derived - `PRIVACY_SECTIONS.map(({ id, title }) => ({ id, label: title }))` -
       so rail and body cannot drift the way they can on the hand-written legal
       pages. What is still worth proving is that the derivation reaches the DOM
       intact and in order: `LegalSections` passes `section.id` through to
       `DocSection`, and an id that stops arriving turns every rail entry below it
       into a link that jumps nowhere. */
    await expect(links.map((link) => norm(link.textContent))).toEqual(
      PRIVACY_SECTIONS.map(({ title }) => norm(title))
    );
    await expect(sections.map((section) => section.id)).toEqual(
      PRIVACY_SECTIONS.map(({ id }) => id)
    );
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      const section = canvasElement.querySelector(`section[id="${id}"]`);
      await expect(section).not.toBeNull();
      await expect(norm(section?.querySelector('h2')?.textContent)).toBe(norm(link.textContent));
    }

    /* `PRIVACY_INTRO` is rendered by a second `LegalBlocks` call ahead of
       `LegalSections`, so it is the one run of copy in the document with no
       heading, no id and no rail entry. Folding it into the first section - the
       obvious tidy-up - would silently file the policy's opening statement of
       scope under "Trademark notice". */
    await expect(doc.firstElementChild?.tagName).toBe('P');
    await expect(norm(doc.firstElementChild?.textContent)).toMatch(
      /^The protection and security of your personal information is important to us\./
    );

    /* And that positioning has a visible consequence that only shows up by
       comparison with the terms page: `.yc-doc section:first-child` drops the
       hairline and the 40px top padding so a document opens flush against the
       hero. The intro paragraph occupies that slot here, so this document's first
       section is a hairline below the intro instead. Pinned because it is the
       kind of difference a refactor "fixes" without noticing it is deliberate. */
    await expect(style(sections[0]).borderTopWidth).toBe('1px');
    await expect(style(sections[1]).borderTopWidth).toBe('1px');
    // Anchor jumps land under the sticky site header without this offset, so the
    // reader arrives at a section whose heading is hidden behind the chrome.
    await expect(style(sections[1]).scrollMarginTop).toBe('96px');

    /* The numbered spine. Two sections are deliberately unnumbered - the trademark
       notice that opens and the PostHog analytics note that closes - and the
       eleven between them carry the numbers the document refers to itself by.
       Dropping, duplicating or renumbering one in a 1,500-line content module is
       a diff nobody reads closely, and the page renders identically either way. */
    const numbered = PRIVACY_SECTIONS.map(({ title }) => /^(\d+)\./.exec(title)?.[1])
      .filter(Boolean)
      .map(Number);
    await expect(numbered).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    /* Every section has to carry content, not just a heading. An emptied `blocks`
       array is valid data and still produces a rail entry and an `<h2>`, so the
       document loses a clause while looking complete. */
    for (const section of sections) {
      await expect(section.children.length).toBeGreaterThan(1);
    }

    /* Link hygiene, asserted as sets rather than counts so a genuine content
       update does not have to touch this story.

       A privacy policy is mostly promises about reachability. The single internal
       route is how a data subject exercises their Article 15 to 21 rights, and
       because it goes through next/link a typo is a 404 at runtime rather than a
       build error. The single mailbox is the published controller and DPO
       contact. Everything else is a third-party policy this document cites as the
       basis for a joint-controller or transfer claim, and citing one over plain
       http would let it be rewritten in transit. */
    const hrefs = [...doc.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
    await expect(hrefs.every(Boolean)).toBe(true);
    await expect([...new Set(hrefs.filter((href) => href.startsWith('/')))]).toEqual([
      '/contact-us',
    ]);
    await expect([...new Set(hrefs.filter((href) => href.startsWith('mailto:')))]).toEqual([
      'mailto:security@yosemitecrew.com',
    ]);
    const offsite = hrefs.filter((href) => !href.startsWith('/') && !href.startsWith('mailto:'));
    await expect(offsite.length).toBeGreaterThan(15);
    await expect(offsite.every((href) => href.startsWith('https://'))).toBe(true);

    /* `inline()` never emits a `target`, so unlike the hand-written legal pages
       nothing here opens a new tab and there is no `window.opener` to sever. That
       is a property of the renderer rather than of this content, and it is the
       assertion that survives it changing: add `target="_blank"` to the off-site
       arm without `rel="noopener"` and twenty links start handing a live handle
       on this page to a third party. */
    await expect(doc.querySelectorAll('a[target]')).toHaveLength(0);

    /* The rail track is fixed at 220px in `gridTemplateColumns`. Section 8's label
       is a full question and is by some margin the longest in the legal set, so
       this is the document that would expose a track switched to `auto` or
       `max-content` - the rail would eat the prose column. Asserted with the
       wrap, because a 220px track that clipped instead of wrapping looks like a
       shortened label rather than a bug. */
    const rail = canvasElement.querySelector('[data-toc]') as HTMLElement;
    await expect(Math.round(rail.getBoundingClientRect().width)).toBe(220);
    const longest = links.reduce((a, b) =>
      norm(b.textContent).length > norm(a.textContent).length ? b : a
    );
    await expect(norm(longest.textContent)).toBe(norm(PRIVACY_SECTIONS[8].title));
    await expect(longest.scrollWidth).toBeLessThanOrEqual(longest.clientWidth);
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
          'above the prose, showing only its 48px toggle row. Thirteen entries against a document ' +
          'this long is the case the collapse exists for: left open it would push the opening ' +
          'paragraph two screens down.',
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
    // Collapsed is a CSS decision, so the entries are in the markup at every
    // width. Losing one here would mean losing it from the desktop rail too.
    await expect(nav.querySelectorAll('a')).toHaveLength(PRIVACY_SECTIONS.length);

    /* The document column must never be the thing that overflows. `.yc-doc`
       columns are `min-width: 0` and the public page clips overflow-x, so a block
       that refused to shrink would not produce a scrollbar - it would slice the
       right edge off every line in twenty thousand words of policy. */
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
          'The fold opened. Below 900px each entry gets a 44px minimum row instead of the ' +
          '14px-indented desktop line, and section 8 wraps to three of them, so this really is a ' +
          'different control and not the rail reflowed.',
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
    await expect(links.map((link) => norm(link.textContent))).toEqual(
      PRIVACY_SECTIONS.map(({ title }) => norm(title))
    );

    /* Tapping an entry closes the fold on the way to the anchor - the `onClick`
       on each link, not just on the toggle. Without it the reader jumps to a
       section and lands with a thirteen-entry list still covering the screen they
       jumped to, which reads as the jump having failed. */
    await userEvent.click(links[8]);
    await expect(nav).toHaveAttribute('data-open', 'false');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(links[8]).toHaveAttribute('href', `#${PRIVACY_SECTIONS[8].id}`);
  },
};
