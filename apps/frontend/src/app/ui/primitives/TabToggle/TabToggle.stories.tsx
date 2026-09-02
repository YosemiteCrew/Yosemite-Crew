import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { IoDocumentTextOutline, IoPulseOutline } from 'react-icons/io5';

import TabToggle, { type TabOption } from './TabToggle';

const RECORD_TABS: TabOption[] = [
  { key: 'VITALS', label: 'Vitals' },
  { key: 'OBSERVATION', label: 'Observation tools' },
];

const meta = {
  title: 'Primitives/TabToggle',
  component: TabToggle,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Underlined tab strip used inside the appointment workspace side modal (record, documents ' +
          'and tasks panels). Segments share the width equally; the active tab is bold `--blue-text` ' +
          'over a 2px `--blue` underline that sits on the shared `card-border` hairline. Pass `panelId` ' +
          'to wire `aria-controls` to the panel each tab reveals.\n\n' +
          'Segments are `flex-1` with `px-6` and no `min-w-0`, so "share the width equally" only ' +
          'holds while there is width to share: below that the strip stops shrinking and pushes ' +
          'instead. Measured floors are 219px for the two-tab strip and 430px for the four-tab ' +
          'one. Every call site today passes exactly two short tabs - Vitals / Observation Tool, ' +
          'Forms / Records, Employee task / Parent task - so the two-tab floor is the one that ' +
          'ships, and it clears a 390px phone with room to spare.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    tabs: RECORD_TABS,
    activeKey: 'VITALS',
    onChange: fn(),
  },
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 520 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof TabToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The second tab active — the underline and the bold weight move together. */
export const SecondTabActive: Story = {
  name: 'Second tab active',
  args: { activeKey: 'OBSERVATION' },
};

/** Optional leading icons, as the documents panel uses them. */
export const WithIcons: Story = {
  name: 'With icons',
  args: {
    tabs: [
      { key: 'VITALS', label: 'Vitals', icon: <IoPulseOutline size={16} aria-hidden /> },
      { key: 'NOTES', label: 'Notes', icon: <IoDocumentTextOutline size={16} aria-hidden /> },
    ],
  },
};

/**
 * Four tabs in a box too small for them. No call site has four - this is the shape of
 * the limit, not of anything shipping. Labels wrap onto a second line first, which is
 * as far as wrapping gets you: `flex-1` without `min-w-0` floors each segment at its
 * longest WORD plus 48px of padding, so a fully wrapped strip still needs 430px and
 * pushes anyway. Two rows of text and a sideways shove, not one or the other.
 */
export const ManyTabs: Story = {
  name: 'Many tabs, long labels',
  args: {
    tabs: [
      { key: 'all', label: 'All documents' },
      { key: 'consent', label: 'Consent forms' },
      { key: 'lab', label: 'Lab results' },
      { key: 'imaging', label: 'Imaging' },
    ],
    activeKey: 'consent',
  },
  decorators: [
    /* 340px is under what these four segments need, which is the whole point.
       The frame is a plain box with no scroller of its own: the strip has to be
       the thing that scrolls, and if it ever stops being that, this story shows
       the document being dragged sideways instead of hiding it.

       A container, not the mobile viewport global: that global is applied by the
       manager to the preview iframe and is inert for a runner loading iframe.html
       directly, and nothing here branches on a media query anyway. */
    (Story) => (
      <div data-frame="" style={{ width: 340 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector('[data-frame]') as HTMLElement;
    const strip = within(canvasElement).getByRole('tablist');
    const tabs = [...strip.children] as HTMLElement[];

    /* The floor is real: the four segments together need more than the box.
       Asserted as a relation rather than against a pixel count, so a font or
       padding change moves the number without failing here. */
    await expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
    await expect(
      tabs.reduce((sum, tab) => sum + tab.getBoundingClientRect().width, 0)
    ).toBeGreaterThan(frame.getBoundingClientRect().width);

    /* The strip absorbs the overflow itself - this is the whole fix, so it is
       asserted by DRIVING the scroll rather than by reading a style. An element
       that is not a scroll container pins `scrollLeft` at 0 no matter what you
       assign, so a strip that has stopped scrolling fails here.

       Asserted this way on purpose: the first version of this check compared
       `document.documentElement.scrollWidth` against its clientWidth, and that
       passed with the scroller REMOVED - the preview canvas is 1280 wide, so a
       340px frame spilling to 430px never reaches the document edge and the
       assertion could not tell the two apart. It was a guard that could not
       fail. */
    await expect(Math.round(frame.getBoundingClientRect().width)).toBe(340);
    strip.scrollLeft = 9999;
    await expect(strip.scrollLeft).toBeGreaterThan(0);
    strip.scrollLeft = 0;

    // And the clipped tab at the right edge is what tells the reader there is more.
    const last = tabs[tabs.length - 1].getBoundingClientRect();
    await expect(last.right).toBeGreaterThan(strip.getBoundingClientRect().right);

    /* Wrapping is still the first thing that gives, and that is deliberate. A
       Range over the label's TEXT NODE returns one client rect per line box,
       which counts lines rather than inferring them from a height. The range has
       to be the text node and not the button: the button is a flex container, so
       its contents measure as one flex item however many lines the text inside
       runs to.

       Forcing `whitespace-nowrap` instead was tried and reverted. It reads
       tidier here, but it takes the row's min-content width up to the full
       labels, and at 375px that is what turns RecordPanel's two-tab strip from
       an even split into an 18px-lopsided one. The scroller below is the fix for
       overflow; nowrap was not. "Imaging" is one word, so it cannot wrap however
       tight the box gets - that is the shape of the floor. */
    const linesIn = (tab: Element) => {
      const label = [...tab.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
      const range = globalThis.document.createRange();
      range.selectNodeContents(label as Node);
      return range.getClientRects().length;
    };
    const lineCounts = tabs.map(linesIn);
    await expect(lineCounts.filter((n) => n > 1).length).toBeGreaterThan(1);
    await expect(linesIn(within(canvasElement).getByRole('tab', { name: 'Imaging' }))).toBe(1);

    /* The indicator still lands on the hairline. The border moved to a wrapper
       when the tablist became the scroll container, so this is the join that a
       future refactor is most likely to break. */
    const active = within(canvasElement).getByRole('tab', { selected: true });
    await expect(Math.round(active.getBoundingClientRect().bottom)).toBe(
      Math.round((strip.parentElement as HTMLElement).getBoundingClientRect().bottom)
    );

    /* The two things the scroll container would otherwise cost, both invisible
       on macOS because its scrollbars are overlays.

       A scrollbar must take no height inside the strip: if it did, it would sit
       between the active tab's underline and the wrapper's hairline and push
       the two apart by its own thickness, which is the join asserted just
       above. `offsetHeight - clientHeight` is that thickness. */
    await expect(strip.offsetHeight - strip.clientHeight).toBe(0);

    /* And the focus indicator has to be INSET. A scroll container clips
       descendant painting on both axes, so an outward ring loses its top and
       bottom edges against a button that fills the strip's height, and the end
       tabs lose an outer edge as well. Asserted on the computed shadow rather
       than the class list, because the class only matters if it resolves. */
    tabs[0].focus();
    await expect(globalThis.getComputedStyle(tabs[0]).boxShadow).toMatch(/inset/);
    tabs[0].blur();
  },
};

const InteractiveTabToggle = () => {
  const [activeKey, setActiveKey] = useState('VITALS');
  return (
    <div className="flex flex-col gap-3">
      <TabToggle
        tabs={RECORD_TABS}
        activeKey={activeKey}
        onChange={setActiveKey}
        panelId={(key) => `tabtoggle-panel-${key}`}
      />
      <div
        id={`tabtoggle-panel-${activeKey}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeKey}`}
        className="text-[14px] text-[var(--ink-body)]"
      >
        {activeKey === 'VITALS' ? 'Weight, temperature, heart rate.' : 'Pain and grimace scales.'}
      </div>
    </div>
  );
};

/** Wired to a panel so the `aria-controls` / `role="tabpanel"` pairing is exercised. */
export const Interactive: Story = {
  render: () => <InteractiveTabToggle />,
};
