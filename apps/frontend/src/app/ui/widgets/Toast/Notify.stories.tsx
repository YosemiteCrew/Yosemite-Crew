import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import React from 'react';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import { useNotify, type NotifyType } from '@/app/hooks/useNotify';
import { Secondary } from '@/app/ui/primitives/Buttons';

/**
 * The four messages a clinic actually sees, fired through the real `useNotify`
 * hook into the real `ToastProvider`, so the story shows the toast exactly as
 * the app renders it (surface from globals.css, body from NotifyToast) rather
 * than the body in isolation.
 */
const SAMPLES: Record<NotifyType, { title: string; text: string }> = {
  warning: {
    title: 'Slot unavailable',
    text: 'This time is outside available hours. Please select a different slot.',
  },
  success: {
    title: 'Appointment booked',
    text: 'Max · Peralta, today at 11:30 AM with Tim Apple.',
  },
  error: {
    title: 'Could not save the invoice',
    text: 'The slot was taken while you were editing.',
  },
  info: { title: 'Results ready', text: 'IDEXX filed the haematology panel to the patient.' },
};

const Launcher = () => {
  const { notify } = useNotify();
  return (
    <div className="flex min-h-[420px] flex-col gap-3 bg-[var(--screen)] p-6">
      <p className="text-[13.5px] text-[var(--ink-muted)]">
        Fire a toast. It lands top-right, under the app header, and dismisses after five seconds.
      </p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(SAMPLES) as NotifyType[]).map((tone) => (
          <Secondary
            key={tone}
            text={`Show ${tone}`}
            onClick={() => notify(tone, SAMPLES[tone], { autoClose: false })}
          />
        ))}
      </div>
      <ToastProvider />
    </div>
  );
};

const meta = {
  title: 'Overlays/Toast/Runtime toast',
  component: Launcher,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The runtime notification every `notify()` call raises: a 360px warm-bone card with a ' +
          'hairline and level-3 float, a 32px tone disc (Ionicons glyph on the status tint), a ' +
          '13.5px/700 ink title, a 12.5px muted detail line and the shared round Close control. ' +
          'The surface is the `.yc-toast` recipe in globals.css, positioned by `ToastProvider`; ' +
          'the tone tokens flip with `html[data-theme=dark]`.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Launcher>;

export default meta;
type Story = StoryObj<typeof meta>;

const fireAll = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Show warning' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Show success' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Show error' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Show info' }));
  await expect(await canvas.findByText('Slot unavailable')).toBeVisible();
  await expect(
    canvas.getByText('This time is outside available hours. Please select a different slot.')
  ).toBeVisible();
  await expect(canvas.getByText('Appointment booked')).toBeVisible();
  await expect(canvas.getByText('Could not save the invoice')).toBeVisible();
  await expect(canvas.getByText('Results ready')).toBeVisible();
  // Every toast renders the shared Close control, not the library's.
  await expect(canvas.getAllByRole('button', { name: 'Close' })).toHaveLength(4);
};

export const AllTones: Story = {
  name: 'All four tones',
  play: async ({ canvasElement }) => fireAll(canvasElement),
};

export const Dark: Story = {
  name: 'All four tones (dark)',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => fireAll(canvasElement),
};

export const Phone: Story = {
  name: 'Phone (390)',
  globals: { viewport: { value: 'mobile' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show warning' }));
    await expect(await canvas.findByText('Slot unavailable')).toBeVisible();
  },
};
