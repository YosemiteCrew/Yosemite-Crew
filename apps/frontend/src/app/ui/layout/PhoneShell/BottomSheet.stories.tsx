import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { fn } from 'storybook/test';

import BottomSheet from './BottomSheet';
import { Primary, Secondary } from '../../primitives/Buttons';

/**
 * The whole sheet skin lives behind `@media (max-width: 767px)` in
 * `overlays/Sheet/Sheet.css`, so above the phone breakpoint the panel renders as
 * plain flow content with no radius, grabber sizing or backdrop. Every story
 * pins the canvas — and the Chromatic snapshot — to 375px.
 */
const PHONE_VIEWPORT = {
  phone: {
    name: 'Mobile (375)',
    styles: { width: '375px', height: '812px' },
    type: 'mobile',
  },
};

const meta = {
  title: 'Layout/PhoneBottomSheet',
  component: BottomSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    viewport: { options: PHONE_VIEWPORT },
    chromatic: { viewports: [375] },
    docs: {
      description: {
        component:
          'The phone form of a modal or drawer: a bottom-anchored sheet with a 44x5 grabber, a 24px ' +
          'top radius, a title + close row and an optional footer for full-width stacked buttons. It ' +
          'traps focus while open, closes on backdrop click or Escape, and hands focus back to the ' +
          'trigger on close. The interior comes from the shared `overlays/Sheet/SheetChrome`, so it ' +
          'stays identical to the phone form of `overlays/Modal`.',
      },
    },
  },
  args: {
    open: true,
    title: 'Reschedule appointment',
    onClose: fn(),
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const bodyCopy = (
  <p className="text-body-4 text-text-secondary" style={{ margin: 0 }}>
    Lena Hartmann is notified as soon as you confirm, and the visit moves in her app right away.
  </p>
);

export const Default: Story = {
  args: { children: bodyCopy },
  parameters: {
    docs: {
      description: {
        story:
          'Title row, grabber and body only. The close chip is always present, which is what ' +
          'guarantees the focus trap has at least one focusable element to land on.',
      },
    },
  },
};

export const WithFooter: Story = {
  name: 'With stacked actions',
  args: {
    title: 'Confirm appointment',
    children: bodyCopy,
    footer: (
      <>
        <Primary text="Confirm" size="large" />
        <Secondary text="Keep current time" size="large" />
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'The footer is fixed furniture — it never scrolls with the body, and its children are ' +
          'stretched to full width by the sheet, which is why phone actions stack instead of sitting ' +
          'side by side.',
      },
    },
  },
};

export const LongContent: Story = {
  name: 'Long body (scrolls)',
  args: {
    title: 'Visit history',
    children: (
      <div className="flex flex-col gap-3 pb-2">
        {Array.from({ length: 14 }, (_, i) => (
          <div
            key={`visit-${i + 1}`}
            className="rounded-2xl border border-[var(--hairline)] px-3 py-2.5"
          >
            <div className="text-[13px] font-semibold text-[var(--ink)]">Wellness exam {i + 1}</div>
            <div className="text-[12px] text-[var(--ink-muted)]">
              Dr. Amelia Rhodes — 12 March 2026
            </div>
          </div>
        ))}
      </div>
    ),
    footer: <Primary text="Export history" size="large" />,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel is capped at 86vh and only the body region scrolls, so the grabber, title row ' +
          'and footer stay put no matter how long the content is.',
      },
    },
  },
};

const OpenableSheet = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: 20 }}>
      <Primary text="Open sheet" onClick={() => setOpen(true)} />
      <BottomSheet title={title} open={open} onClose={() => setOpen(false)}>
        {children}
      </BottomSheet>
    </div>
  );
};

export const Closed: Story = {
  name: 'Closed (opens on click)',
  args: { open: false, children: bodyCopy },
  render: (args) => <OpenableSheet title={args.title}>{args.children}</OpenableSheet>,
  parameters: {
    docs: {
      description: {
        story:
          'While closed the component renders nothing at all — no hidden dialog, no backdrop — so a ' +
          'parked sheet cannot swallow clicks on the page behind it.',
      },
    },
  },
};
