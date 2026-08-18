import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { DocSection, LegalDoc, type TocEntry } from './LegalDoc';
// The fold is pure CSS: `.yc-toc-toggle` is `display: none` until the 900px media
// query, and `.yc-toc-list` flips to `display: none` there unless `data-open` is set.
// Only `(routes)/(public)/layout.tsx` loads this sheet, so without importing it here the
// component renders with the rail permanently open and the toggle permanently hidden.
import './marketing.css';

const TOC: TocEntry[] = [
  { id: 'scope', label: 'Scope' },
  { id: 'data-we-hold', label: 'Data we hold' },
  { id: 'processors', label: 'Sub-processors' },
  { id: 'retention', label: 'Retention' },
  { id: 'your-rights', label: 'Your rights' },
  { id: 'contact', label: 'Contact' },
];

const BODY = (
  <>
    <DocSection id="scope" title="Scope">
      <p>
        This notice covers the Yosemite Crew practice management system, the pet parent app and the
        public website. It does not cover a practice&apos;s own systems, which each practice
        controls as an independent data controller.
      </p>
    </DocSection>
    <DocSection id="data-we-hold" title="Data we hold">
      <p>
        Clinical records, appointment history, invoices and the identifiers needed to link them to a
        companion and its parent. Staff accounts additionally carry a name, a work email and a role
        within one organisation.
      </p>
    </DocSection>
    <DocSection id="processors" title="Sub-processors">
      <p>
        Hosting, transactional email, payments and error reporting are handled by named
        sub-processors. Each is bound by a data processing agreement and none is permitted to use
        practice data for its own purposes.
      </p>
    </DocSection>
    <DocSection id="retention" title="Retention">
      <p>
        Clinical records are retained for the period the practice&apos;s jurisdiction requires,
        which is longer than the life of the account. Everything else is deleted within 90 days of
        the account closing.
      </p>
    </DocSection>
    <DocSection id="your-rights" title="Your rights">
      <p>
        Access, rectification, erasure, restriction, portability and objection. Requests are
        answered within one month, and are free unless they are manifestly unfounded or excessive.
      </p>
    </DocSection>
    <DocSection id="contact" title="Contact">
      <p>Write to the data protection contact named in your practice agreement.</p>
    </DocSection>
  </>
);

/**
 * Each story pins its own width, because the fold is decided by a `max-width: 900px`
 * media query - a story that asserts what is displayed has to own the viewport it
 * asserts at. Pinning is `globals.viewport.value`, naming a preset from
 * `.storybook/preview.ts`; the `parameters.viewport.defaultViewport` spelling was
 * removed in Storybook 10 and silently renders at the full panel width instead.
 */
const meta = {
  title: 'Marketing/LegalDoc',
  component: LegalDoc,
  parameters: {
    layout: 'fullscreen',
    // Marketing pages keep the lighter faint inks; see the preview decorator.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The shared shell behind the privacy notice, the terms and the trust centre: a warm hero ' +
          'band, a sticky contents rail and the `.yc-doc` prose column, laid out as a ' +
          '`220px 1fr` grid.\n\n' +
          'The surface that had never been drawn is the phone form of that contents rail. Both the ' +
          'rail heading and a toggle button are always in the markup, and `marketing.css` decides ' +
          'which one exists at a given width: above 900px `.yc-toc-toggle` is `display: none` and ' +
          'the list is a plain flex column, so `tocOpen` changes nothing at all. At or below 900px ' +
          'the grid collapses to one column, `[data-toc]` stops being sticky and becomes a bordered ' +
          '`--inset` card, the heading is hidden, the 48px toggle appears - and `.yc-toc-list` ' +
          'becomes `display: none` unless `data-open="true"` is on it.\n\n' +
          'So the fold is a React state driving a CSS attribute selector across a media query, and ' +
          'it is invisible at every width Storybook renders by default. Nothing type-checks that ' +
          "wiring: drop the `data-open` attribute, or the `[data-open='true']` rule, and the " +
          'desktop rail is unchanged while the phone contents becomes permanently unreachable in a ' +
          'document tens of thousands of words long.\n\n' +
          'The stories pin the phone viewport, press the toggle, and assert the list is *displayed ' +
          'and populated* - not merely that `aria-expanded` flipped, which an empty or still-hidden ' +
          'list would satisfy just as well.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    eyebrow: 'Legal',
    title: 'Privacy notice',
    subtitle:
      'What Yosemite Crew collects, why it is held, how long it stays and who else can see it.',
    meta: 'Yosemite Crew Ltd - last updated 12 March 2026',
    toc: TOC,
    children: BODY,
  },
} satisfies Meta<typeof LegalDoc>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  name: 'Desktop (rail always open)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole('navigation');
    await expect(within(nav).getAllByRole('link')).toHaveLength(TOC.length);
    // Above the breakpoint the toggle is `display: none`, so the rail is open
    // regardless of state - `data-open` starts false and the list still shows.
    await expect(nav).toHaveAttribute('data-open', 'false');
    await expect(getComputedStyle(nav).display).toBe('flex');
  },
  parameters: {
    chromatic: { viewports: [1440] },
    docs: {
      description: {
        story:
          'The two-column form: a 220px rail stuck 100px from the top beside the prose. The rail ' +
          'heading is the small uppercase `--ink-faint2` line, and the toggle that replaces it on a ' +
          'phone is present in the DOM but not displayed.',
      },
    },
  },
};

export const MobileCollapsed: Story = {
  name: 'Phone (contents collapsed)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'At 375 the grid is one column and the contents becomes a bordered `--inset` card at the ' +
          'top of the document, showing only its 48px toggle row with a `+`. This is the resting ' +
          'state a reader meets before the prose.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'On this page' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    /* Queried by id rather than by role on purpose: at this width the list really is
       `display: none`, so a role query cannot see it - it is excluded from the
       accessibility tree. That exclusion IS the assertion. The entries are present in
       the markup the whole time; only the CSS hides them. */
    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;
    await expect(nav).toHaveAttribute('data-open', 'false');
    await expect(getComputedStyle(nav).display).toBe('none');
    await expect(nav.querySelectorAll('a')).toHaveLength(TOC.length);
  },
};

export const MobileOpen: Story = {
  name: 'Phone (contents open)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The fold opened. Every entry gets a 44px minimum row here rather than the 14px-indented ' +
          'desktop line, so the list is a genuinely different control at this width - and it is the ' +
          'only way to navigate a document this long on a phone.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'On this page' });
    await userEvent.click(toggle);

    const nav = canvas.getByRole('navigation');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // The state alone proves nothing: the list is shown by a CSS attribute selector,
    // so assert it is actually displayed AND that it holds every entry.
    await expect(nav).toHaveAttribute('data-open', 'true');
    await expect(getComputedStyle(nav).display).toBe('flex');
    const links = within(nav).getAllByRole('link');
    await expect(links).toHaveLength(TOC.length);
    await expect(links[0]).toHaveTextContent('Scope');
    await expect(links[0]).toHaveAttribute('href', '#scope');
    await expect(links.at(-1)).toHaveTextContent('Contact');
  },
};

export const LongContents: Story = {
  name: 'Phone (long contents)',
  args: {
    title: 'Terms and conditions',
    eyebrow: 'Legal',
    toc: [
      ...TOC,
      { id: 'fees', label: 'Fees, billing and taxes' },
      { id: 'availability', label: 'Service availability and support' },
      { id: 'liability', label: 'Limitation of liability' },
      { id: 'termination', label: 'Termination and data export' },
    ],
  },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Ten entries, several of them long enough to wrap. The open fold has no maximum height, ' +
          'so it pushes the document down by its full length - worth seeing, because it is the ' +
          'first thing between the hero and the prose on a phone.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'On this page' }));
    const nav = canvas.getByRole('navigation');
    await expect(within(nav).getAllByRole('link')).toHaveLength(10);
    await expect(
      within(nav).getByRole('link', { name: 'Service availability and support' })
    ).toBeInTheDocument();
  },
};
