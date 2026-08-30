import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import Impressum from './Impressum';
/* `.yc-doc`, the section hairlines and the 900px contents fold live in this sheet,
   which only `(routes)/(public)/layout.tsx` loads at runtime. Nothing this page
   imports pulls it in - LegalDoc imports `./motion`, which only mentions the sheet
   in comments - so without this line the page renders as unstyled prose and every
   computed-style assertion below would be measuring browser defaults. */
import '../../marketing/site/marketing.css';

/** The rail's `{ id, label }` pairs, matched to the body's `<DocSection>` ids by string alone. */
const TOC_LABELS = [
  'Provider (Angaben gemäß § 5 DDG)',
  'Represented by',
  'Contact',
  'Register entry',
  'VAT identification number',
  'Responsible for content (§ 18 (2) MStV)',
  'EU dispute resolution',
  'Trademark',
] as const;

/* The "Responsible for content" heading is authored across three source lines, so
   its raw textContent carries the indentation. HTML collapses it on screen and the
   accessible-name computation collapses it too, which is why it has never shown
   up - compare on collapsed whitespace or the heading assertions below fail on
   characters nobody can see. */
const norm = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

const meta = {
  title: 'Legal/Impressum',
  component: Impressum,
  parameters: {
    layout: 'fullscreen',
    // Public page, so it keeps the lighter marketing inks rather than the PIMS
    // ones the preview decorator scopes to `[data-yc-app]`.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The § 5 DDG legal notice: eight short sections of provider, register and ' +
          'responsibility detail for DuneXploration UG.\n\n' +
          'This page is almost entirely identifiers, and an identifier is the one kind of copy ' +
          'that can be wrong without looking wrong. German law requires the register court and ' +
          'number, the VAT ID, a named managing director and a directly reachable telephone and ' +
          'email; a refactor that drops one leaves a page that still reads like an Impressum and ' +
          'is no longer one. The stories pin those values, and pin the two places where the ' +
          'printed form and the machine form deliberately differ: the phone number is spaced for ' +
          'a reader and unspaced in its `tel:` href, and the ODR link prints its own URL as its ' +
          'label while opening off-site.\n\n' +
          'The other half is the contents rail. It is a hand-written `TOC` array matched to ' +
          'hand-written `<DocSection id>` values by string, with eight pairs and no type-check ' +
          'between them.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Impressum>;

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
          'The two-column form. Eight entries against eight very short sections, so the rail is ' +
          'nearly as tall as the prose it indexes - the widest gap between rail and body in the ' +
          'legal set.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exact name: the preview decorator injects an sr-only `{title} - {story name}`
    // level-1 heading into this canvas, so a bare heading query is ambiguous.
    await expect(canvas.getByRole('heading', { level: 1, name: 'Impressum' })).toBeInTheDocument();

    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;
    const links = [...nav.querySelectorAll('a')];
    await expect(links.map((link) => link.textContent)).toEqual([...TOC_LABELS]);

    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const sections = [...doc.querySelectorAll(':scope > section')];
    await expect(sections).toHaveLength(TOC_LABELS.length);

    /* The dead-anchor guard. Rename a `DocSection` id, or reword a heading without
       touching the rail, and the page compiles, renders and quietly ships a
       contents entry that jumps nowhere. This loop is also what proves the
       whitespace-authored "Responsible for content" heading still reduces to the
       label the rail advertises. */
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      const section = canvasElement.querySelector(`section[id="${id}"]`);
      await expect(section).not.toBeNull();
      await expect(norm(section?.querySelector('h2')?.textContent)).toBe(norm(link.textContent));
    }

    // Without the offset an anchor jump parks the heading behind the sticky site
    // header, so the reader lands on a section whose title they cannot see.
    await expect(globalThis.getComputedStyle(sections[1]).scrollMarginTop).toBe('96px');
    await expect(globalThis.getComputedStyle(sections[0]).borderTopWidth).toBe('0px');
    await expect(globalThis.getComputedStyle(sections[1]).borderTopWidth).toBe('1px');

    /* Printed spaced for a human, dialled unspaced. A `tel:` href that keeps the
       display spacing is not reliably dialable, and the page looks exactly the
       same either way - the visible label is a separate string from the href, so
       nothing pairs them but this. */
    const phone = canvas.getByRole('link', { name: '+49 152 277 63275' });
    await expect(phone).toHaveAttribute('href', 'tel:+4915227763275');
    await expect(phone.getAttribute('href')).not.toMatch(/\s/);

    /* § 5 DDG requires a direct electronic contact route alongside the phone
       number; support@ is the address the whole public site publishes. */
    await expect(canvas.getByRole('link', { name: 'support@yosemitecrew.com' })).toHaveAttribute(
      'href',
      'mailto:support@yosemitecrew.com'
    );

    /* The register court and number, the VAT ID and the named managing director
       are the three things that make this page an Impressum rather than a contact
       card. They are plain prose, so nothing but this notices them going missing
       in a rewrite. */
    await expect(
      within(canvasElement.querySelector('section[id="register"]') as HTMLElement).getByText(
        'Registered at Amtsgericht Mainz, HRB 52778.'
      )
    ).toBeInTheDocument();
    await expect(
      within(canvasElement.querySelector('section[id="vat"]') as HTMLElement).getByText(
        'VAT ID under § 27 a Umsatzsteuergesetz: DE367920596.'
      )
    ).toBeInTheDocument();
    await expect(
      within(canvasElement.querySelector('section[id="represented"]') as HTMLElement).getByText(
        'Geschäftsführer: Ankit Upadhyay'
      )
    ).toBeInTheDocument();

    /* One off-site link, opened in a new tab, and it prints its own URL as the
       label - so the href and the visible text have to agree or the page shows a
       reader one destination and sends them to another. `rel="noopener"` is the
       other half: without it the opened page keeps a live `window.opener` back
       into this one, and it looks identical either way. */
    const external = [...doc.querySelectorAll('a[target="_blank"]')];
    await expect(external).toHaveLength(1);
    const odr = external[0];
    await expect(odr).toHaveAttribute('href', 'https://ec.europa.eu/consumers/odr/');
    await expect(norm(odr.textContent)).toBe(odr.getAttribute('href'));
    await expect(odr.getAttribute('rel')).toContain('noopener');
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
          'above the prose, showing only its 48px toggle row. This is the page where the collapse ' +
          'matters least and costs most: the sections are so short that the closed contents hides ' +
          'eight jumps to save about a screen of scrolling.',
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

    /* The two longest labels carry a `§` clause and wrap on a phone. `.yc-doc`
       columns are `min-width: 0` and `.yc-public-page` clips overflow-x, so a
       label that refused to wrap would not produce a scrollbar - it would slice
       the right edge off every line in the document. Asserted as a relation so it
       holds at the 375 this story is pinned to and at whatever width a headless
       runner renders it. */
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
          'The fold opened, with the longest labels in the legal set. Each entry gets a 44px ' +
          'minimum row below 900px, and the two `§` labels wrap onto a second line inside it - so ' +
          'the open list is roughly a full phone screen before the prose starts.',
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
    // The § labels are the ones most likely to be "tidied" out of sync with the
    // heading they point at, so pin the anchor for one of them explicitly.
    await expect(links[5]).toHaveAttribute('href', '#responsible');
  },
};
