import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import MenuActionsList from './MenuActionsList';
import type { MenuAction, MenuSubmenu } from './appointmentContextMenuHelpers';

const ACTIONS: MenuAction[] = [
  { key: 'open', label: 'Open appointment', onSelect: fn() },
  { key: 'status', label: 'Change status', submenu: 'status' },
  { key: 'room', label: 'Move to room', submenu: 'room' },
  { key: 'reschedule', label: 'Reschedule', onSelect: fn() },
  { key: 'cancel', label: 'Cancel appointment', destructive: true, onSelect: fn() },
];

/**
 * The real list lives inside `AppointmentContextMenu`, which owns the `role="menu"`
 * container, the `itemRefs` map used to measure a submenu's flyout position, and the
 * `activeSubmenu` state that hovering a row sets. The harness supplies all three so the
 * hover-driven active row can be reached from a story rather than only from a live
 * right-click on a calendar marker.
 */
const Harness = ({
  actions,
  initialSubmenu,
  onActivate,
}: {
  actions: MenuAction[];
  initialSubmenu: MenuSubmenu;
  onActivate: (action: MenuAction) => void;
}) => {
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeSubmenu, setActiveSubmenu] = useState<MenuSubmenu>(initialSubmenu);

  return (
    <div
      role="menu"
      aria-label="Appointment actions"
      className="yc-glass-overlay w-[220px] overflow-hidden rounded-[22px] px-1.5 py-2"
    >
      <MenuActionsList
        actions={actions}
        activeSubmenu={activeSubmenu}
        itemRefs={itemRefs}
        onHover={(action) => setActiveSubmenu(action.submenu ?? null)}
        onActivate={onActivate}
      />
    </div>
  );
};

/** The two rows the fill assertions compare: the submenu row and a plain sibling. */
const rowsByLabel = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  return {
    canvas,
    status: canvas.getByRole('menuitem', { name: 'Change status' }),
    plain: canvas.getByRole('menuitem', { name: 'Open appointment' }),
  };
};

const meta = {
  title: 'Appointments/Calendar/MenuActionsList',
  component: Harness,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The action rows of the appointment context menu. The menu itself is portalled and only ' +
          'exists after a right-click on a calendar marker, and the state that matters here is one ' +
          'interaction deeper still: the **active row**, which is set by `onMouseEnter` and by ' +
          'nothing else. No prop opens it, so nothing had ever drawn it.\n\n' +
          'That active row is a fill swap, and a fill swap on this surface is exactly where this ' +
          'family of components has already shipped a bug. `getMenuItemClassName` picks between ' +
          '`bg-[var(--hairline)]` when active and `bg-transparent` when not, on a row whose ink is ' +
          '`text-text-primary` - both themed. The sibling submenus previously filled the same rows ' +
          'with literal `bg-white/50`, which put a light ink on a near-#a1a1a0 row at about 2.1:1 in ' +
          'dark mode and survived precisely as long as no story rendered the hovered state. The ' +
          'stories below therefore compare the computed `background-color` of the active row against ' +
          'a plain sibling instead of only reading `aria-expanded`: a dropped or transparent fill ' +
          'still satisfies the attribute.\n\n' +
          'Two more things are only checkable with the list drawn. The dividers render between rows ' +
          'rather than around them (`index > 0`, `mx-1 border-t border-[var(--hairline)]`), so a ' +
          'single-action menu must show no rule at all. And the 10px `IoChevronForward` at ' +
          '`opacity-55` is the only affordance telling a reader a row leads somewhere - it is ' +
          'rendered from `action.submenu`, so it must be present on exactly the two submenu rows.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    actions: ACTIONS,
    initialSubmenu: null,
    onActivate: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting (nothing hovered)',
  play: async ({ canvasElement }) => {
    const { canvas } = rowsByLabel(canvasElement);
    const items = canvas.getAllByRole('menuitem');
    await expect(items).toHaveLength(5);
    // Dividers sit between rows only, so five rows means four rules.
    await expect(canvasElement.querySelectorAll('div[aria-hidden="true"]')).toHaveLength(4);
    // The chevron is rendered from `action.submenu`, so it belongs to exactly two rows.
    const withChevron = items.filter((item) => item.querySelector('svg') !== null);
    await expect(withChevron).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story: 'What a freshly opened context menu shows before the pointer touches a row.',
      },
    },
  },
};

export const SubmenuRowActive: Story = {
  name: 'Submenu row hovered (active fill)',
  play: async ({ canvasElement }) => {
    const { status, plain } = rowsByLabel(canvasElement);
    await expect(status).toHaveAttribute('aria-expanded', 'false');

    await userEvent.hover(status);

    await expect(status).toHaveAttribute('aria-expanded', 'true');
    /* The attribute alone is the weak check - it flips whether or not the fill
       survived. Compare the painted background against a plain sibling instead:
       an active row that resolves to the same colour as an inactive one, or to a
       fully transparent one, means the `bg-[var(--hairline)]` branch was dropped.
       The row carries `transition-colors`, so for the first frame after the class
       swaps the computed value is still the colour it is leaving - the read has to
       be polled rather than taken once. */
    await waitFor(() => {
      const activeFill = getComputedStyle(status).backgroundColor;
      expect(activeFill).not.toBe(getComputedStyle(plain).backgroundColor);
      expect(activeFill).not.toBe('rgba(0, 0, 0, 0)');
      expect(activeFill).not.toBe('transparent');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Hovering "Change status" is what opens the status flyout in the real menu, and the row ' +
          'has to read as the open one while that flyout is up. This is the state a pointer holds ' +
          'the whole time the submenu is being used, and the only one where the tinted fill is ' +
          'visible at all.',
      },
    },
  },
};

export const SubmenuRowPreOpened: Story = {
  name: 'Submenu already open (room)',
  args: { initialSubmenu: 'room' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const room = canvas.getByRole('menuitem', { name: 'Move to room' });
    const status = canvas.getByRole('menuitem', { name: 'Change status' });
    await expect(room).toHaveAttribute('aria-expanded', 'true');
    // Only one row may be active at a time - two tinted rows is its own defect.
    await expect(status).toHaveAttribute('aria-expanded', 'false');
    await expect(getComputedStyle(room).backgroundColor).not.toBe(
      getComputedStyle(status).backgroundColor
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same active state reached through the prop rather than the pointer, so the tint can ' +
          'be inspected without a hover held open. `activeSubmenu` is a single value, so exactly one ' +
          'row can carry it.',
      },
    },
  },
};

export const DestructiveRow: Story = {
  name: 'Destructive row',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cancel = canvas.getByRole('menuitem', { name: 'Cancel appointment' });
    const plain = canvas.getByRole('menuitem', { name: 'Open appointment' });
    // `text-text-error` vs `text-text-primary` - the destructive row is distinguished
    // by ink alone at rest, so the two must not resolve to the same colour.
    await expect(getComputedStyle(cancel).color).not.toBe(getComputedStyle(plain).color);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Cancel is the only row carrying `destructive`, which swaps its ink to `text-text-error` ' +
          'and its hover fill to `danger-100/72`. At rest there is no icon and no divider treatment ' +
          'setting it apart, so the colour is doing all the work.',
      },
    },
  },
};

export const SingleAction: Story = {
  name: 'Single action (no divider)',
  args: { actions: [ACTIONS[0]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('menuitem')).toHaveLength(1);
    // `index > 0` guards the rule, so a one-row menu must render none.
    await expect(canvasElement.querySelectorAll('div[aria-hidden="true"]')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A read-only appointment offers one action. The between-rows divider rule must not render ' +
          'at all here, and the 22px container radius has to hold against a single 13px row.',
      },
    },
  },
};

export const LongLabels: Story = {
  name: 'Long labels truncate',
  args: {
    actions: [
      { key: 'open', label: 'Open appointment in the clinical workspace', onSelect: fn() },
      { key: 'status', label: 'Change appointment status', submenu: 'status' },
      { key: 'room', label: 'Move to a different consulting room', submenu: 'room' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'The label is `truncate` and the chevron is `shrink-0`, so an over-long action gives up ' +
          'width rather than pushing the chevron out of the 220px menu.',
      },
    },
  },
};
