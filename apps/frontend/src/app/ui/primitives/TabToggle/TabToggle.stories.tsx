import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
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
          'to wire `aria-controls` to the panel each tab reveals.',
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
 * Four tabs with longer labels. Segments are `flex-1`, so the strip stays even
 * while the labels get tighter — the case where a label would start to wrap.
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
