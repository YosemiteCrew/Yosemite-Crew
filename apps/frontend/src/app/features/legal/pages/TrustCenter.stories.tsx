import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import TrustCenter from './TrustCenter';
/* The whole document skin - the `.yc-doc` prose rules, the section hairlines and the
   900px contents fold - lives in this sheet, and only `(routes)/(public)/layout.tsx`
   loads it at runtime. Nothing in this page's import graph pulls it in: LegalDoc
   imports `./motion`, which only mentions the sheet in comments. Without this line the
   page still renders, so every computed-style assertion below would quietly be
   measuring browser defaults instead. */
import '../../marketing/site/marketing.css';

/**
 * The rail is authored as `{ id, label }` pairs in `trustCenterData.ts`; every `<h2>`
 * is authored by hand in `TrustCenter.tsx`. The two halves are matched by string and
 * nothing type-checks the pair, so this is the story's third copy of the contract.
 */
const TOC_LABELS = [
  'Our approach to trust',
  'Certifications and standards',
  'Security controls',
  'Data residency and encryption',
  'Subprocessors',
  'Resources',
  'Responsible disclosure',
] as const;

/** Order matters: the grid is rendered straight off the `certifications` array. */
const CERT_NAMES = [
  'GDPR',
  'SOC 2 Type I',
  'ISO 27001:2022',
  '21 CFR Part 11',
  'ESIGN Act',
  'UETA',
  'eIDAS (SES)',
  'ZertES',
  'HIPAA',
] as const;

/** Carry a `badge` URL, so they render the CDN image branch of `CertBadge`. */
const BADGE_CERTS = ['GDPR', 'SOC 2 Type I', 'ISO 27001:2022', '21 CFR Part 11'] as const;
/** Carry an `icon` name instead, so they render the tinted 40px tile fallback. */
const ICON_CERTS = ['ESIGN Act', 'UETA', 'eIDAS (SES)', 'ZertES', 'HIPAA'] as const;
/** Everything else is `COMPLIANT`. */
const PLANNED_CERTS = ['ZertES', 'HIPAA'] as const;

const PILLAR_TITLES = [
  'Organizational security',
  'People and internal security',
  'Infrastructure security',
  'Product security',
  'Data privacy and operations',
] as const;

const SUBPROCESSORS = [
  ['Amazon Web Services', 'Cloud infrastructure and storage', 'Luxembourg (EU)'],
  ['Supabase, Inc.', 'Database hosting', 'Singapore'],
  ['Google Cloud', 'Maps and analytics services', 'Ireland (EU)'],
  ['PostHog', 'Product analytics (on consent)', 'EU'],
] as const;

/** `getStatusPillStyle`, resolved. A swapped ternary still renders a plausible pill. */
const PILL_COLOURS = {
  COMPLIANT: { color: 'rgb(0, 102, 66)', background: 'rgb(230, 244, 239)' },
  PLANNED: { color: 'rgb(175, 94, 25)', background: 'rgb(254, 243, 233)' },
} as const;

/** Headings are authored across several source lines, so compare on collapsed whitespace. */
const norm = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

const gridBy = (root: HTMLElement, attribute: string) =>
  root.querySelector(`[${attribute}]`) as HTMLElement;

/**
 * Computed `grid-template-columns` resolves to the pixel tracks the browser actually
 * laid out, so this is the column count `repeat(auto-fill, minmax(N, 1fr))` produced at
 * the current width - not the authored string. A non-grid element computes to `none`,
 * which parses to `NaN` and fails every width assertion below rather than passing as
 * "one column".
 */
const tracksOf = (grid: HTMLElement) =>
  globalThis.getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).map(parseFloat);

const cardFor = (grid: HTMLElement, name: string) =>
  ([...grid.children] as HTMLElement[]).find((card) =>
    card.textContent?.includes(name)
  ) as HTMLElement;

/** The status pill is the only span in a card that carries text; the icon tile is empty. */
const pillIn = (card: HTMLElement) =>
  [...card.querySelectorAll('span')].find(
    (span) => span.textContent === 'COMPLIANT' || span.textContent === 'PLANNED'
  ) as HTMLElement;

const meta = {
  title: 'Legal/TrustCenter',
  component: TrustCenter,
  parameters: {
    layout: 'fullscreen',
    // Public page, so it keeps the lighter marketing inks rather than the PIMS ones the
    // preview decorator scopes to `[data-yc-app]`.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The published security, privacy and compliance page: seven anchored sections behind ' +
          "LegalDoc's hero band and sticky contents rail.\n\n" +
          'Unlike the other legal documents this one is not prose. Four private components carry ' +
          'it - `CertBadge`, `CertCard`, `PillarCard` and `SubprocessorRow` - and each has a ' +
          'branch that fails silently. A certification renders either a CDN badge image or a ' +
          'tinted icon tile depending on which optional field the record happens to carry; the ' +
          'status pill picks its two colours off `status === COMPLIANT`, so a swapped ternary ' +
          'still paints a plausible pill and quietly promotes a roadmap item to shipped; the ' +
          'ledger draws its dividers with a `first` flag rather than a CSS sibling selector, so ' +
          'an off-by-one puts a hairline under the rounded top corner.\n\n' +
          'The tile tint carries no status meaning, by the way - HIPAA is on the roadmap behind ' +
          'the same blue tile as the compliant ESIGN Act, and only the pill separates them.\n\n' +
          'None of this is reachable through props. The page takes none, and reads ' +
          '`trustCenterData` at module scope, so each story below renders the whole document and ' +
          'scopes its queries to one section. That is also why the badge alts are asserted ' +
          'per-grid: the approach band renders the same five badge images again, and two of its ' +
          'alts (`GDPR`, `21 CFR Part 11`) are character-for-character the certification names ' +
          'below, so an unscoped `getByAltText` is ambiguous.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TrustCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  name: 'Desktop (full page)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: {
    chromatic: { viewports: [1440] },
    docs: {
      description: {
        story:
          'The two-column form: the 220px contents rail beside the prose column, the badge band, ' +
          'the certification grid at four across and the pillar grid at two.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exact name on purpose: the preview decorator injects an sr-only
    // `<h1>{title} - {story name}</h1>` into this canvas, so a bare level-1 query is
    // ambiguous and a loose text match would hit the decorator's heading.
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Security, privacy and compliance' })
    ).toBeInTheDocument();

    const nav = canvasElement.querySelector('#yc-toc-list') as HTMLElement;
    const links = [...nav.querySelectorAll('a')];
    await expect(links.map((link) => link.textContent)).toEqual([...TOC_LABELS]);

    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const sections = [...doc.querySelectorAll(':scope > section')];
    await expect(sections).toHaveLength(TOC_LABELS.length);

    /* The dead-anchor guard. The rail lives in `trustCenterData.ts` and the headings
       live in the JSX, so renaming a section id on one side only leaves a contents
       entry that still looks right and jumps nowhere - in a document where the
       contents is the only way to navigate. Matching the label against the heading
       catches the worse half of it: a link that lands somewhere real and tells the
       reader the wrong thing about where they are going. */
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      const section = canvasElement.querySelector(`section[id="${id}"]`);
      await expect(section).not.toBeNull();
      await expect(norm(section?.querySelector('h2')?.textContent)).toBe(norm(link.textContent));
    }

    /* Both grids are `auto-fill` + `minmax`, which is the entire responsive story for
       this page: no media query narrows them, the track floor does. Asserting the
       relation rather than "four columns" keeps this true at any width wide enough for
       the two-column document - what must hold is that the 190px cert floor packs more
       cards per row than the 280px pillar floor, and that neither ever renders a track
       narrower than its own floor (which is what a stray `1fr` or a dropped `minmax`
       would produce). */
    const certGrid = gridBy(canvasElement, 'data-cert-grid');
    const pillarGrid = gridBy(canvasElement, 'data-pillar-grid');
    await expect(globalThis.getComputedStyle(certGrid).display).toBe('grid');
    await expect(globalThis.getComputedStyle(pillarGrid).display).toBe('grid');

    const certTracks = tracksOf(certGrid);
    const pillarTracks = tracksOf(pillarGrid);
    await expect(certTracks.length).toBeGreaterThan(pillarTracks.length);
    await expect(pillarTracks.length).toBeGreaterThan(1);
    for (const track of certTracks) await expect(track).toBeGreaterThanOrEqual(190);
    for (const track of pillarTracks) await expect(track).toBeGreaterThanOrEqual(280);

    await expect(certGrid.children).toHaveLength(CERT_NAMES.length);
    await expect(pillarGrid.children).toHaveLength(PILLAR_TITLES.length);

    /* Anchor jumps land under the site's sticky header without this offset, so the
       reader arrives at a section whose heading is hidden behind the chrome. It is set
       on the section rather than the h2 because the contents targets the section. */
    await expect(globalThis.getComputedStyle(sections[1]).scrollMarginTop).toBe('96px');
    // `section:first-child` opts out so the document opens flush against the hero.
    await expect(globalThis.getComputedStyle(sections[0]).borderTopWidth).toBe('0px');
    await expect(globalThis.getComputedStyle(sections[1]).borderTopWidth).toBe('1px');

    /* The three addresses the page's promises rest on. A mailto typo is invisible at
       every level above this one: the link renders, it is clickable, and the report
       simply never arrives. The status page is the only off-site link on the document,
       and without `rel="noopener"` it gets a live `window.opener` back into this tab -
       which looks and behaves identically either way. */
    await expect(canvas.getByRole('link', { name: 'security@yosemitecrew.com' })).toHaveAttribute(
      'href',
      'mailto:security@yosemitecrew.com'
    );
    await expect(canvas.getByRole('link', { name: 'terms' })).toHaveAttribute(
      'href',
      '/terms-and-conditions'
    );
    const external = [...doc.querySelectorAll('a[target="_blank"]')];
    await expect(external).toHaveLength(1);
    await expect(external[0]).toHaveAttribute('href', 'https://yosemite-crew.openstatus.dev/');
    await expect(external[0].getAttribute('rel')).toContain('noopener');
  },
};

export const Certifications: Story = {
  name: 'Certifications (badge, icon tile, status pill)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: {
    chromatic: { viewports: [1440] },
    docs: {
      description: {
        story:
          'Both `CertBadge` branches in one grid: four CDN badge images and five tinted icon ' +
          'tiles, seven COMPLIANT pills and two PLANNED ones.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const grid = gridBy(canvasElement, 'data-cert-grid');
    const cards = [...grid.children] as HTMLElement[];
    await expect(cards).toHaveLength(CERT_NAMES.length);

    /* The image branch. `alt` is the only accessible text the badge has, and an empty
       one leaves a screen reader with a bare graphic where the certification name
       should be. It is looked up per-card because the approach band above renders the
       same badge files again, and two of its alts (`GDPR`, `21 CFR Part 11`) are the
       exact certification names asserted here. */
    for (const name of BADGE_CERTS) {
      const card = cardFor(grid, name);
      const img = card.querySelector('img');
      await expect(img).not.toBeNull();
      await expect(img).toHaveAttribute('alt', name);
      // Image and tile are mutually exclusive: a card showing both means `cert.badge`
      // stopped short-circuiting the fallback.
      await expect(card.querySelector('svg')).toBeNull();
    }

    /* The fallback branch. `iconBg` and `iconColor` are optional on `Certification`, so
       a record that supplies `icon` alone still type-checks and renders a glyph on a
       transparent 40px hole. Measuring the tile catches both that and a dropped
       `flex: 'none'`, which would let the nowrap pill squash it. */
    for (const name of ICON_CERTS) {
      const card = cardFor(grid, name);
      await expect(card.querySelector('img')).toBeNull();
      const icon = card.querySelector('svg') as SVGElement;
      await expect(icon).not.toBeNull();
      // Decorative: the name is already spelled out below it, so announcing the glyph
      // would only repeat it.
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      const tile = icon.parentElement as HTMLElement;
      const box = tile.getBoundingClientRect();
      await expect(box.width).toBe(40);
      await expect(box.height).toBe(40);
      await expect(globalThis.getComputedStyle(tile).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    }

    /* The status branch, on every card at once. Nine pills carrying the same two colour
       pairs is the whole honesty claim of this page ("where one is on the roadmap we
       say that too"), and inverting the ternary would promote ZertES and HIPAA to
       shipped without changing a single word of copy. */
    for (const name of CERT_NAMES) {
      const pill = pillIn(cardFor(grid, name));
      const status = (PLANNED_CERTS as readonly string[]).includes(name) ? 'PLANNED' : 'COMPLIANT';
      await expect(pill.textContent).toBe(status);
      const style = globalThis.getComputedStyle(pill);
      await expect(style.color).toBe(PILL_COLOURS[status].color);
      await expect(style.backgroundColor).toBe(PILL_COLOURS[status].background);
      /* `whiteSpace: nowrap`, measured. The pill shares a 190px card header with a badge
         up to 80px wide, and "COMPLIANT" breaking across two lines would push the header
         past its 40px minimum and stagger the row. */
      await expect(pill.getClientRects()).toHaveLength(1);
    }
  },
};

export const SecurityControls: Story = {
  name: 'Security controls (pillar checklists)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: {
    chromatic: { viewports: [1440] },
    docs: {
      description: {
        story: 'Five pillar cards, four checked items each, twenty ticks that say nothing aloud.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const grid = gridBy(canvasElement, 'data-pillar-grid');
    const cards = [...grid.children] as HTMLElement[];
    await expect(cards.map((card) => card.firstElementChild?.textContent)).toEqual([
      ...PILLAR_TITLES,
    ]);

    let ticks = 0;
    for (const card of cards) {
      const rows = [...(card.lastElementChild?.children ?? [])] as HTMLElement[];
      await expect(rows.length).toBeGreaterThan(0);

      for (const row of rows) {
        /* One tick per claim, and exactly one. A row rendering its checkmark twice, or
           none, is a claim that reads as a different kind of statement than the four
           beside it, and nothing in the JSX ties the icon to the item text. */
        const icons = row.querySelectorAll('svg');
        await expect(icons).toHaveLength(1);
        // Decorative. Twenty announced "checkmark"s ahead of twenty items is the whole
        // list read twice.
        await expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
        // `flex: 'none'`, measured. These rows are a flex row with a wrapping text node,
        // so without it the tick is the item that gives up width and squashes to a
        // sliver on the longest claim.
        await expect(icons[0].getBoundingClientRect().width).toBe(16);
        await expect(norm(row.textContent).length).toBeGreaterThan(0);
        ticks += 1;
      }
    }
    await expect(ticks).toBe(20);
  },
};

export const Subprocessors: Story = {
  name: 'Subprocessor ledger',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: {
    chromatic: { viewports: [1440] },
    docs: {
      description: {
        story:
          'Four rows in a clipped, rounded card. The dividers come from a `first` flag ' +
          'passed per row rather than a CSS sibling selector, which is the branch this pins.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const section = canvasElement.querySelector('section[id="subprocessors"]') as HTMLElement;
    const card = section.querySelector(':scope > div') as HTMLElement;
    const rows = [...card.children] as HTMLElement[];
    await expect(rows).toHaveLength(SUBPROCESSORS.length);

    for (const [index, [name, service, location]] of SUBPROCESSORS.entries()) {
      const row = within(rows[index]);
      await expect(row.getByText(name)).toBeInTheDocument();
      await expect(row.getByText(service)).toBeInTheDocument();
      await expect(row.getByText(location)).toBeInTheDocument();
    }

    /* The `first` branch. `SubprocessorRow` draws its own top hairline unless it is told
       it is first, so an off-by-one either rules the card straight under its rounded top
       corner or drops the divider between the first two subprocessors. Both look close
       enough to right to survive a glance at a four-row list. */
    await expect(globalThis.getComputedStyle(rows[0]).borderTopWidth).toBe('0px');
    for (const row of rows.slice(1)) {
      const style = globalThis.getComputedStyle(row);
      await expect(style.borderTopWidth).toBe('1px');
      await expect(style.borderTopStyle).toBe('solid');
    }
    // The rows are square; only the card's `overflow: hidden` keeps the top and bottom
    // ones inside its 20px radius.
    await expect(globalThis.getComputedStyle(card).overflow).toBe('hidden');

    /* A ledger has to read down its columns. Each location sits in a `nowrap` span
       pinned right by `justify-content: space-between`, so a row that picked up extra
       padding, or a location long enough to wrap, would break the alignment while every
       text assertion above still passed. */
    const rights = rows.map((row) => {
      const location = row.lastElementChild as HTMLElement;
      return {
        rects: location.getClientRects().length,
        right: location.getBoundingClientRect().right,
      };
    });
    for (const entry of rights) {
      await expect(entry.rects).toBe(1);
      await expect(Math.abs(entry.right - rights[0].right)).toBeLessThan(0.5);
    }

    // `maxWidth: 700` - the ledger is four short rows and stretching it the full width of
    // the prose column would leave the location column stranded across a gulf.
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    await expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(700);
    await expect(card.getBoundingClientRect().width).toBeLessThan(
      doc.getBoundingClientRect().width
    );
  },
};

export const Phone: Story = {
  name: 'Phone (both grids collapse to one column)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'At 375 the document grid collapses to one column, leaving the prose column 327px ' +
          'wide, and both card grids fall to a single track: 190px + 190px + a 14px gap does not ' +
          'fit, and neither does 280px twice.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    /* The viewport global resizes the iframe from the manager, and the verifier loads
       `iframe.html` directly - so pinning `mobile` styles the Chromatic snapshot but
       leaves this play function running at the full panel width. Nothing about the
       collapse needs a media query though: both grids are `auto-fill`, so they answer to
       the width of the column they are in. Narrowing `.yc-doc` itself to the width a
       375px viewport gives it reproduces the phone layout of every card inside it, and
       is restored below so the snapshot is not taken through it. */
    const doc = canvasElement.querySelector('.yc-doc') as HTMLElement;
    const certGrid = gridBy(canvasElement, 'data-cert-grid');
    const pillarGrid = gridBy(canvasElement, 'data-pillar-grid');
    const ledger = canvasElement.querySelector('section[id="subprocessors"] > div') as HTMLElement;
    const previousWidth = doc.style.width;

    try {
      // 375 viewport - 24px of section padding either side, with the 900px media query
      // having already collapsed the 220px rail out of the row.
      doc.style.width = '327px';

      await expect(globalThis.getComputedStyle(certGrid).display).toBe('grid');
      await expect(globalThis.getComputedStyle(pillarGrid).display).toBe('grid');
      await expect(tracksOf(certGrid)).toHaveLength(1);
      await expect(tracksOf(pillarGrid)).toHaveLength(1);

      /* `.yc-public-page` clips horizontal overflow, so anything that outgrows the column
         on a phone is not a scrollbar, it is a cut-off right edge on every line of the
         document. The two candidates here both refuse to wrap: the status pill sharing a
         card header with an 80px badge, and the subprocessor location sharing a row with
         a name as long as "Amazon Web Services". */
      for (const box of [certGrid, pillarGrid, ledger]) {
        await expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
      }
    } finally {
      doc.style.width = previousWidth;
    }
  },
};
