import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PhoneFab from './PhoneFab';
import { PHONE_FAB_ACTIONS, resolveFabAction } from './phoneShellConfig';
import './PhoneShell.css';

/**
 * The FAB skin lives behind `@media screen and (max-width: 767px)` in
 * `PhoneShell.css`, so every story pins the `mobile` viewport — above 768px it
 * renders as an unstyled button in the document flow rather than the docked
 * circle.
 */
const meta = {
  title: 'Layout/PhoneFab',
  component: PhoneFab,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "The phone shell's single floating creation action, docked 12px above the tab bar. Each " +
          'list route contributes one action (appointment, task, companion, product); every other ' +
          'route passes `null` and no button is rendered, so the phone never shows a create ' +
          'affordance the desktop hides.',
      },
    },
  },
  tags: ['autodocs'],
  args: { onAction: fn() },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 420, background: 'var(--page)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneFab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewAppointment: Story = {
  name: 'Appointments list',
  args: { action: resolveFabAction('/appointments') },
  play: async ({ args, canvasElement }) => {
    const fab = within(canvasElement).getByRole('button', { name: 'New appointment' });

    /* 52px is the design's diameter and it is also the touch-target floor this
       control has to clear on its own - nothing around it enlarges the hit area. */
    const box = fab.getBoundingClientRect();
    await expect(Math.round(box.width)).toBe(52);
    await expect(Math.round(box.height)).toBe(52);

    await userEvent.click(fab);
    await expect(args.onAction).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'appointment' })
    );
  },
};

export const NewTask: Story = {
  name: 'Tasks list',
  args: { action: resolveFabAction('/tasks') },
};

export const NewCompanion: Story = {
  name: 'Companions list',
  args: { action: resolveFabAction('/companions') },
};

export const NewProduct: Story = {
  name: 'Inventory list',
  args: { action: resolveFabAction('/inventory') },
};

export const NoAction: Story = {
  name: 'A route with nothing to create',
  args: { action: null },
  play: async ({ canvasElement }) => {
    // Not "hidden" - absent. A disabled or invisible FAB would still occupy the
    // corner and read as a broken control.
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Detail and workspace routes resolve to `null`. The button is not rendered at all rather ' +
          'than rendered disabled, which is why `resolveFabAction` returns `null` instead of a ' +
          'flagged action.',
      },
    },
  },
};

export const EveryAction: Story = {
  name: 'All four actions, compared',
  args: { action: PHONE_FAB_ACTIONS[0] },
  render: (args) => (
    <div style={{ display: 'grid', gap: 12, padding: 16 }}>
      {PHONE_FAB_ACTIONS.map((action) => (
        <div
          key={action.key}
          style={{
            position: 'relative',
            height: 84,
            borderRadius: 14,
            background: 'var(--inset)',
          }}
        >
          <span
            style={{
              padding: '10px 12px',
              display: 'block',
              font: '600 12px var(--font-satoshi)',
              color: 'var(--ink-faint)',
            }}
          >
            {action.matchHref}
          </span>
          {/* Positioned relative to the tile so all four read side by side; in the
              app each is `position: fixed` against the viewport. */}
          <span style={{ position: 'absolute', right: 16, bottom: 16 }}>
            <PhoneFab {...args} action={action} />
          </span>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The four routes that carry a creation action. The glyph is identical in all of them - ' +
          'the route decides what gets created, and the accessible name is the only thing that ' +
          'differs, so screen-reader users get the specific action rather than "Add".',
      },
    },
  },
};
