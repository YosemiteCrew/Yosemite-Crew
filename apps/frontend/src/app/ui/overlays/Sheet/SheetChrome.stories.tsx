import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import React from 'react';
import SheetChrome from './SheetChrome';

/**
 * Phone bottom-sheet chrome (< 768px): grabber, optional title + close row,
 * scrollable body, and an optional footer for full-width stacked actions.
 *
 * The panel skin (frosted background, 24px top radius, gutters) lives on the
 * owning dialog's `.yc-phone-sheet` class in `Sheet.css` and is gated to phone
 * widths, so these stories render inside a phone frame at the `mobile` viewport
 * to match the design's bottom-sheet anatomy (grabber 44x5 `--divider`, title
 * 17px/700/-0.02em `--ink`, 30x30 hairline close chip with a 15px glyph).
 *
 * @see src/app/ui/overlays/Sheet/SheetChrome.tsx
 * @see design-01-foundations.html — "Bottom sheet anatomy"
 */
const meta = {
  title: 'Overlays/SheetChrome',
  component: SheetChrome,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile' },
    docs: {
      description: {
        component:
          'Presentational bottom-sheet interior shared by PhoneShell/BottomSheet and the ' +
          'phone form of the centered Modal. View at the `mobile` viewport (< 768px) so the ' +
          'phone-gated sheet skin applies.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div
        className="yc-phone-sheet-root"
        style={{
          position: 'relative',
          minHeight: 520,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <div
          className="yc-phone-sheet-backdrop"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden
        />
        <div className="yc-phone-sheet" style={{ position: 'relative' }}>
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof SheetChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

const bodyCopy = (
  <p className="text-body-4 text-text-secondary" style={{ margin: 0 }}>
    Lena Hartmann will get a push notification and the visit appears in her app right away.
  </p>
);

export const TitledWithActions: Story = {
  name: 'Titled + stacked actions',
  args: {
    title: 'Confirm appointment',
    titleId: 'sheet-demo-title',
    children: bodyCopy,
    footer: (
      <>
        <button
          type="button"
          className="text-body-3-emphasis"
          style={{
            height: 48,
            borderRadius: 9999,
            background: 'var(--cta)',
            color: 'var(--cta-text)',
            border: 'none',
            fontWeight: 700,
          }}
        >
          Book appointment
        </button>
        <button
          type="button"
          className="text-body-4-emphasis"
          style={{
            height: 44,
            borderRadius: 9999,
            background: 'transparent',
            color: 'var(--ink-body)',
            border: '1px solid var(--divider)',
          }}
        >
          Back to details
        </button>
      </>
    ),
  },
};

export const TitledOnly: Story = {
  name: 'Titled, no footer',
  args: {
    title: 'More',
    titleId: 'sheet-more-title',
    children: bodyCopy,
  },
};

export const GrabberOnly: Story = {
  name: 'No title (caller supplies header)',
  args: {
    children: bodyCopy,
  },
};
