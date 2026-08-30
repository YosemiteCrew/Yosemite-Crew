import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { SpeciesCounts } from './companionsDirectory';
import SpeciesTabs from './SpeciesTabs';

const COUNTS: SpeciesCounts = { all: 148, dog: 86, cat: 41, horse: 12, other: 9 };

const tabsIn = (canvasElement: HTMLElement): HTMLElement[] =>
  within(canvasElement).getAllByRole('tab');

/** The one tab reporting `aria-selected="true"`, or a throw naming what it found. */
const selectedTab = (canvasElement: HTMLElement): HTMLElement => {
  const chosen = tabsIn(canvasElement).filter(
    (tab) => tab.getAttribute('aria-selected') === 'true'
  );
  if (chosen.length !== 1) {
    throw new Error(`expected exactly one selected tab, got ${chosen.length}`);
  }
  return chosen[0];
};

/** The italic count element inside a tab, which is a sibling of the label text. */
const countOf = (tab: HTMLElement): HTMLElement => {
  const node = tab.querySelector('span');
  if (!node) throw new Error(`tab "${tab.textContent}" rendered no count`);
  return node as HTMLElement;
};

const meta = {
  title: 'Companions/SpeciesTabs',
  component: SpeciesTabs,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The species filter above the companions directory. Five underline tabs, each carrying ' +
          'its live count in Newsreader italic, and nothing else: the component holds no state, ' +
          'so `activeFilter` and `onSelect` are the whole contract.\n\n' +
          'Two things about it are invisible in a snapshot and break silently. The tab reading ' +
          '**Exotics** reports the key `other` - it is the catch-all bucket, not a species - so a ' +
          'caller that compares against the label filters to nothing and shows an empty list under ' +
          'a non-zero count. And selection is announced through `aria-selected` rather than through ' +
          'the underline: the active tab is the one the assistive tree names, and if that attribute ' +
          'stopped tracking `activeFilter` the tabs would still look correct.\n\n' +
          "Selection is also tolerant of an unset filter - `activeFilter || 'all'` - so the " +
          'directory can mount with an empty string and still show a chosen tab rather than five ' +
          'unselected ones.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    counts: COUNTS,
    activeFilter: 'all',
    onSelect: fn(),
  },
} satisfies Meta<typeof SpeciesTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'All selected',
  play: async ({ canvasElement }) => {
    const tabs = tabsIn(canvasElement);
    await expect(tabs).toHaveLength(5);
    await expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All148',
      'Dogs86',
      'Cats41',
      'Horses12',
      'Exotics9',
    ]);

    /* Exactly one tab claims selection, and it is the first. A row where every
       tab reported `aria-selected="false"` - or two reported true - draws
       identically, because the underline comes from the same branch that sets
       the attribute only by convention, not by construction. */
    await expect(selectedTab(canvasElement)).toBe(tabs[0]);

    // The tablist names itself; without this the group is an unlabelled set of
    // five buttons to a screen reader.
    await expect(
      within(canvasElement).getByRole('tablist', { name: 'Filter by species' })
    ).toBeInTheDocument();

    /* The count is its own element so it can be the Newsreader italic against the
       sans label. Measured rather than checked by class name: `font-newsreader`
       resolves through `--font-newsreader`, and if that token were dropped the
       class would still be in the markup while the numerals rendered in the body
       face. */
    const count = countOf(tabs[0]);
    await expect(count).toHaveTextContent('148');
    const countStyle = globalThis.getComputedStyle(count);
    await expect(countStyle.fontFamily).toContain('Newsreader');
    await expect(countStyle.fontStyle).toBe('italic');
    await expect(countStyle.fontFamily).not.toBe(globalThis.getComputedStyle(tabs[0]).fontFamily);
  },
};

export const SpeciesSelected: Story = {
  name: 'A species tab selected',
  args: { activeFilter: 'cat' },
  play: async ({ args, canvasElement }) => {
    const tabs = tabsIn(canvasElement);
    const cats = tabs[2];
    await expect(selectedTab(canvasElement)).toBe(cats);

    /* The active tab is drawn by a real bottom border and the inactive ones by a
       transparent one of the same width, so the row never reflows on selection.
       Both halves matter: an inactive tab that dropped `border-transparent`
       would shift every tab up by 2px the moment the filter changed. */
    const active = globalThis.getComputedStyle(cats);
    const inactive = globalThis.getComputedStyle(tabs[1]);
    await expect(active.borderBottomWidth).toBe(inactive.borderBottomWidth);
    await expect(active.borderBottomWidth).toBe('2px');
    await expect(inactive.borderBottomColor).toBe('rgba(0, 0, 0, 0)');
    await expect(active.borderBottomColor).not.toBe(inactive.borderBottomColor);
    // Weight carries the same signal as the underline, for anyone who cannot
    // see a 2px rule.
    await expect(Number(active.fontWeight)).toBeGreaterThan(Number(inactive.fontWeight));

    /* Clicking a NEIGHBOUR of the selected tab, because the failure worth
       catching is a handler wired to the wrong tab in the map - which looks
       right until two adjacent tabs swap. */
    await userEvent.click(tabs[3]);
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onSelect).toHaveBeenCalledWith('horse');

    // The component is stateless: nothing moved, because the parent owns the
    // filter and has not echoed the choice back yet.
    await expect(selectedTab(canvasElement)).toBe(cats);
  },
};

export const ExoticsSelected: Story = {
  name: 'Exotics reports the "other" key',
  args: { activeFilter: 'other' },
  play: async ({ args, canvasElement }) => {
    const tabs = tabsIn(canvasElement);
    const exotics = tabs[4];
    await expect(exotics).toHaveTextContent('Exotics');
    await expect(selectedTab(canvasElement)).toBe(exotics);

    /* The label and the key deliberately disagree. `resolveSpeciesBucket` files
       rabbits, birds, an unrecognised type and a missing type all under `other`,
       so the tab that says "Exotics" must emit `other` - anything else filters
       the list to nothing while the count above it stays non-zero. */
    await userEvent.click(exotics);
    await expect(args.onSelect).toHaveBeenCalledWith('other');
    await expect(args.onSelect).not.toHaveBeenCalledWith('exotics');
  },
};

export const NoFilterYet: Story = {
  name: 'An empty filter still selects All',
  args: { activeFilter: '' },
  play: async ({ canvasElement }) => {
    /* The directory mounts before it has resolved a filter, and an empty string
       is not a tab key. Without the `|| 'all'` fallback the row renders with
       nothing selected and no underline at all, which reads as a broken control
       rather than as "everything". */
    await expect(selectedTab(canvasElement)).toBe(tabsIn(canvasElement)[0]);
  },
};

export const EmptyDirectory: Story = {
  name: 'Zero across the board',
  args: { counts: { all: 0, dog: 0, cat: 0, horse: 0, other: 0 } },
  play: async ({ args, canvasElement }) => {
    const tabs = tabsIn(canvasElement);
    /* Zeroes are printed, not hidden. A falsy-count guard here would collapse
       the row to five bare labels on an empty clinic - the one moment the counts
       are actually telling the reader something. */
    await expect(tabs.map((tab) => countOf(tab).textContent)).toEqual(['0', '0', '0', '0', '0']);
    await expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All0',
      'Dogs0',
      'Cats0',
      'Horses0',
      'Exotics0',
    ]);

    // An empty species is still selectable - the tabs never disable themselves,
    // so the reader can filter to Horses and read "no horses" rather than
    // wondering why the tab is dead.
    await userEvent.click(tabs[3]);
    await expect(args.onSelect).toHaveBeenCalledWith('horse');
  },
};

export const Phone: Story = {
  name: 'Phone: four-figure counts never squash the row',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    counts: { all: 4820, dog: 2913, cat: 1402, horse: 318, other: 187 },
    activeFilter: 'dog',
  },
  decorators: [
    /* The directory wraps the tablist in `max-w-full overflow-x-auto
       scrollbar-hidden`. Reproduced here because the overflow is the caller's
       job, not the component's: without this wrapper a busy practice's counts
       push the whole phone page sideways (measured at 375px: a 382px row in a
       343px column). */
    (Story) => (
      <div className="max-w-full overflow-x-auto scrollbar-hidden">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const tabs = tabsIn(canvasElement);

    /* Every tab is `shrink-0` and the row does not wrap, which together are the
       reason the caller has to provide a scroller. The failure this guards is
       the tempting "fix": drop `shrink-0` and the row fits any width, but the
       labels squash and clip instead of scrolling, and it looks fine at desktop
       where there is room to spare. */
    for (const tab of tabs) {
      await expect(globalThis.getComputedStyle(tab).flexShrink).toBe('0');
    }
    await expect(globalThis.getComputedStyle(tabs[0].parentElement as HTMLElement).flexWrap).toBe(
      'nowrap'
    );
    const tops = new Set(tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
    await expect(tops.size).toBe(1);

    // With the caller's scroller in place the overflow stays inside it and the
    // page itself never gains a horizontal scrollbar.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
    await expect(selectedTab(canvasElement)).toBe(tabs[1]);
  },
};
