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
    /* 340px is under the 430px this strip needs, which is the whole point - and the
       frame scrolls so the demonstration stays inside the story instead of dragging
       the preview document 56px wide, which is what a phone-width sweep saw and read
       as a layout bug in a component no call site pushes this far.

       A container, not the mobile viewport global: that global is applied by the
       manager to the preview iframe and is inert for a runner loading iframe.html
       directly, and nothing here branches on a media query anyway. */
    (Story) => (
      <div data-frame="" style={{ width: 340, overflowX: 'auto' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector('[data-frame]') as HTMLElement;
    const strip = within(canvasElement).getByRole('tablist');
    const widths = [...strip.children].map((tab) => tab.getBoundingClientRect().width);

    /* The floor is real: the four segments together need more than the box, and no
       label has wrapped to buy that back. Asserted as a relation rather than against
       430px, so a font or padding change moves the number without failing here. */
    await expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
    await expect(widths.reduce((sum, width) => sum + width, 0)).toBeGreaterThan(
      frame.getBoundingClientRect().width
    );

    /* And wrapping has already happened - it is not what saves this. A Range over the
       label's TEXT NODE returns one client rect per line box, which counts lines
       rather than inferring them from a height. The range has to be the text node and
       not the button: the button is a flex container, so its contents measure as one
       flex item however many lines the text inside runs to.

       "All documents" and "Consent forms" have both broken in two and the strip still
       does not fit - and "Imaging" is one word, so it could not have wrapped however
       tight the box got. That is the shape of the floor: a label bottoms out at its
       longest word, and a one-word label bottoms out immediately. */
    const linesIn = (tab: Element) => {
      const label = [...tab.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
      const range = globalThis.document.createRange();
      range.selectNodeContents(label as Node);
      return range.getClientRects().length;
    };
    const lineCounts = [...strip.children].map(linesIn);
    await expect(lineCounts.filter((lines) => lines > 1).length).toBeGreaterThan(1);
    await expect(linesIn(within(canvasElement).getByRole('tab', { name: 'Imaging' }))).toBe(1);
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
