import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import DmcaCopyrightPolicy from './DmcaCopyrightPolicy';
/* `.yc-doc`, the section hairlines and the 900px contents fold all live in this
   sheet, which only `(routes)/(public)/layout.tsx` loads at runtime. Nothing this
   page imports pulls it in - LegalDoc imports `./motion`, which only mentions the
   sheet in comments - so without this line the page renders as unstyled prose and
   every computed-style assertion below would be measuring browser defaults. */
import '../../marketing/site/marketing.css';

/** The rail's `{ id, label }` pairs, matched to the body's `<DocSection>` ids by string alone. */
const TOC_LABELS = [
  'Reporting copyright infringement',
  'Required elements of a takedown notice',
  'How to submit',
  'Questions',
] as const;

const AGENT_INBOX = 'dmca@yosemitecrew.com';

/* Two of this page's headings are authored across several source lines, so their
   raw textContent carries the indentation with it. HTML collapses it on screen and
   the accessible-name computation collapses it too, which is why it has never
   shown up - compare on collapsed whitespace or every heading assertion here
   fails on invisible characters. */
const norm = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

const meta = {
  title: 'Legal/DmcaCopyrightPolicy',
  component: DmcaCopyrightPolicy,
  parameters: {
    layout: 'fullscreen',
    // Public page, so it keeps the lighter marketing inks rather than the PIMS
    // ones the preview decorator scopes to `[data-yc-app]`.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The § 512 takedown policy: four anchored sections, a bespoke "Copyright agent" address ' +
          'card and the six statutory elements of a valid notice.\n\n' +
          'Two things here exist nowhere else in the app. The address card is inline-styled ' +
          'directly onto `var(--hairline)` / `var(--page)` custom properties, which is a shape no ' +
          'type-check reaches: rename a token and the declarations become invalid at computed ' +
          'value time, so the border and the panel background simply drop and the agent address ' +
          'runs on as ordinary prose. And the requirements list is ordered by statute - the page ' +
          'itself promises the six elements "in this order" - with each one carried by a bolded ' +
          'lead-in that is the only thing separating the requirement from its explanation.\n\n' +
          'The third thing worth pinning is duller and more expensive to get wrong: all three ' +
          'routes to the copyright agent are the same hand-typed inbox, and the policy states ' +
          'that notices sent anywhere else may not be reviewed promptly.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DmcaCopyrightPolicy>;

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
          'The two-column form: a four-entry rail beside the prose, with the agent card capped at ' +
          '460px inside a much wider column so it reads as a panel rather than a full-width band.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exact name: the preview decorator injects an sr-only `{title} - {story name}`
    // level-1 heading into this canvas, so a bare heading query is ambiguous.
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'DMCA Copyright Policy' })
    ).toBeInTheDocument();

    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;
    const links = [...nav.querySelectorAll('a')];
    await expect(links.map((link) => link.textContent)).toEqual([...TOC_LABELS]);

    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const sections = [...doc.querySelectorAll(':scope > section')];
    await expect(sections).toHaveLength(TOC_LABELS.length);

    /* The dead-anchor guard. Rename a `DocSection` id, or reword a heading without
       touching the rail, and the page compiles, renders and quietly ships a
       contents entry that jumps nowhere - or lands somewhere it did not promise. */
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      const section = canvasElement.querySelector(`section[id="${id}"]`);
      await expect(section).not.toBeNull();
      await expect(norm(section?.querySelector('h2')?.textContent)).toBe(norm(link.textContent));
    }

    // Without the offset an anchor jump parks the heading behind the sticky site
    // header, so the reader arrives at a section they cannot see the title of.
    await expect(globalThis.getComputedStyle(sections[1]).scrollMarginTop).toBe('96px');
    await expect(globalThis.getComputedStyle(sections[0]).borderTopWidth).toBe('0px');
    await expect(globalThis.getComputedStyle(sections[1]).borderTopWidth).toBe('1px');

    /* The agent card. Its border and background are inline `var(...)` references,
       and an unresolvable custom property is invalid at computed value time: the
       declaration is dropped rather than flagged, `border-style` falls back to
       `none`, and the used border width collapses to 0. Visually the address stops
       being a panel and nothing in the build says a word. */
    const reporting = canvasElement.querySelector('section[id="reporting"]') as HTMLElement;
    const card = within(reporting).getByText('Copyright agent').parentElement as HTMLElement;
    const cardStyle = globalThis.getComputedStyle(card);
    await expect(cardStyle.borderTopStyle).toBe('solid');
    await expect(cardStyle.borderTopWidth).toBe('1px');
    await expect(cardStyle.borderTopLeftRadius).toBe('18px');
    await expect(cardStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    /* `maxWidth: 460` with no `boxSizing` of its own, so it rides the global
       `* { box-sizing: border-box }`. Assert the used width rather than the
       declaration: drop that global and the 22px side padding pushes the panel to
       504px, which is still inside this column and only breaks on a phone. */
    const cardBox = card.getBoundingClientRect();
    await expect(cardBox.width).toBeLessThanOrEqual(460);
    await expect(cardBox.right).toBeLessThanOrEqual(doc.getBoundingClientRect().right);

    /* Ordered by statute. 17 U.S.C. § 512(c)(3) enumerates six elements and the
       paragraph above the list promises them "in this order", so both the count
       and the sequence are part of the claim - and each element is identified only
       by its bolded lead-in. */
    const requirements = canvasElement.querySelector('section[id="requirements"]') as HTMLElement;
    const items = [...requirements.querySelectorAll('li')];
    await expect(items).toHaveLength(6);
    await expect(items.map((item) => norm(item.querySelector('strong')?.textContent))).toEqual([
      'Your signature',
      'Identification of the copyrighted work',
      'Identification of the infringing material',
      'Your contact information',
      'A good-faith statement',
      'An accuracy statement',
    ]);

    /* Three separate hand-typed routes to the same inbox: the card, the "How to
       submit" instruction and the "Questions" line. A typo in one of them is a
       notice that was legally served and never operationally arrived, and the page
       explicitly warns that notices sent elsewhere may not be reviewed. */
    const agentLinks = canvas.getAllByRole('link', { name: AGENT_INBOX });
    await expect(agentLinks).toHaveLength(3);
    for (const link of agentLinks) {
      await expect(link).toHaveAttribute('href', `mailto:${AGENT_INBOX}`);
    }

    // Nothing on this page opens off-site, so there is nothing here that would
    // need `rel="noopener"` - the check is cheap and it is the thing a later edit
    // adding an external reference would forget.
    await expect(doc.querySelectorAll('a[target="_blank"]')).toHaveLength(0);
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
          'At 375 the grid collapses to one column, the rail becomes a bordered `--inset` card ' +
          'showing only its 48px toggle row, and the agent card - the widest fixed-size thing on ' +
          'the page - has to give up its 460px cap and shrink to the column instead.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('.yc-toc-toggle') as HTMLButtonElement;
    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;

    /* The whole phone contents control is these two attributes and neither is
       type-checked. `aria-controls` pointing at an id that does not exist reads as
       a button governing nothing, and it is invisible either way: above 900px the
       button is `display: none`, below it the only symptom is a correct-looking `+`. */
    await expect(toggle).toHaveAttribute('aria-controls', 'yc-toc-list');
    await expect(nav.id).toBe(toggle.getAttribute('aria-controls'));
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).toHaveAttribute('data-open', 'false');
    // Collapsing is a CSS decision, so the entries stay in the markup at every
    // width - losing one here would mean losing it from the desktop rail too.
    await expect(nav.querySelectorAll('a')).toHaveLength(TOC_LABELS.length);

    /* The narrow-viewport check the agent card needs. `[data-doc-grid] > *` sets
       `min-width: 0` precisely so a fixed-width child cannot stretch the column
       past the viewport; `.yc-public-page` clips overflow-x, so when that goes
       wrong it does not show up as a scrollbar, it shows up as the right edge of
       every line being sliced off. Asserted as a relation so it holds at both the
       375 this story is pinned to and the width a headless runner renders it at. */
    const card = canvasElement.querySelector('section[id="reporting"] > div') as HTMLElement;
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    await expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(
      doc.getBoundingClientRect().right
    );
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
          'The fold opened. Four entries is the shortest contents of the legal set, so this is ' +
          'the case where the collapse costs the least and the open list barely displaces the ' +
          'first section.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('.yc-toc-toggle') as HTMLButtonElement;
    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;

    await userEvent.click(toggle);

    /* `aria-expanded` flipping only proves React re-rendered. The list is shown by
       `.yc-toc-list[data-open='true']`, so assert the attribute that selector keys
       on and that the list is actually displayed - drop `data-open` from the JSX
       and the state still flips while the phone contents stays shut for good. */
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toHaveAttribute('data-open', 'true');
    await expect(globalThis.getComputedStyle(nav).display).toBe('flex');
    const links = [...nav.querySelectorAll('a')];
    await expect(links.map((link) => link.textContent)).toEqual([...TOC_LABELS]);
    await expect(links[1]).toHaveAttribute('href', '#requirements');
  },
};
