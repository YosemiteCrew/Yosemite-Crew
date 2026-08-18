import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import DispensaryTable from './DispensaryTable';
import type { DispensaryRecord } from '@/app/features/inventory/pages/Inventory/types';

const record = (
  id: string,
  status: DispensaryRecord['status'],
  overrides: Partial<DispensaryRecord> = {}
): DispensaryRecord => ({
  id,
  prescriptionId: `RX-${id}`,
  patient: { name: 'Poppy', appointmentId: 'AP-2043', petBreed: 'Beagle' },
  status,
  prescriptionItems: ['Carprofen 50 mg', 'Nobivac Rabies 1 ml'],
  prescriptionCreated: '2026-06-30T09:12:00.000Z',
  amountCents: 8620,
  currency: 'USD',
  lead: 'Ruth Baumann',
  petParentName: 'Lena Hartmann',
  location: 'Shelf B2',
  requestType: 'PATIENT',
  items: [
    { name: 'Carprofen 50 mg', quantity: 14, priceCents: 168 },
    { name: 'Nobivac Rabies 1 ml', quantity: 1, priceCents: 2480 },
  ],
  ...overrides,
});

const ROWS: DispensaryRecord[] = [
  record('1', 'PENDING'),
  record('2', 'DISPENSED', {
    patient: { name: 'Biscuit', appointmentId: 'AP-2042', petBreed: 'Domestic Shorthair' },
    petParentName: 'Martha Ellis',
    timeDispensed: '2026-06-30T10:31:00.000Z',
    amountCents: 5837,
  }),
  record('3', 'NOT_DISPENSED', {
    patient: { name: 'Bruno', appointmentId: 'AP-2041', petBreed: 'German Shepherd' },
    petParentName: 'Amelia Ross',
    amountCents: 4200,
  }),
];

const viewButton = (canvasElement: HTMLElement, patient: string) =>
  within(canvasElement).getByRole('button', { name: `View prescription for ${patient}` });

const tooltips = () => within(document.body).queryAllByRole('tooltip');

const meta = {
  title: 'Tables/DispensaryTable',
  component: DispensaryTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Dispensary request queue rendered through the shared PaginatedGridTable shell. ' +
          'Status badges follow the design micro-badge (fully round, padding 3px 9px, 9.5px / 700, ' +
          'no tracking). Swaps to wrapped cards at <=1023px.\n\n' +
          'The row action at the end of each line is wrapped in a `GlassTooltip`, and that bubble is ' +
          'the surface this file was extended for. It is `createPortal`ed to `document.body` at a ' +
          '`position: fixed` rect measured from the trigger on `mouseenter`/`focusin`, so it does ' +
          'not exist in any static render: the icon button is a 30px circle with no text, and the ' +
          'tooltip is the only thing that ever says what it does.\n\n' +
          'Three properties of it are only checkable with it up. The bubble is positioned by script ' +
          '(`side="top"` puts it at `rect.top - 10` with a `translate(-50%,-100%)`), so a dropped ' +
          'measurement pins it to the top-left of the viewport while still reading as a healthy ' +
          'tooltip. It is `pointer-events: none`, so it can never eat the click on the button it ' +
          'describes. And the listeners are added imperatively on the wrapper span with a matching ' +
          '`mouseleave`/`focusout` teardown - a leak there leaves one bubble per row hovered, all ' +
          'stacked over the table, which is why these stories assert **exactly one** bubble exists ' +
          'after moving between two rows rather than merely that one appeared.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: ROWS,
    onView: fn(),
    onDispense: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ height: 520, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DispensaryTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyState: Story = {
  name: 'Empty state',
  args: { filteredList: [] },
};

export const RowActionTooltip: Story = {
  name: 'Row action tooltip (hover)',
  play: async ({ canvasElement }) => {
    const trigger = viewButton(canvasElement, 'Poppy');
    await expect(tooltips()).toHaveLength(0);

    await userEvent.hover(trigger);

    const bubble = await within(document.body).findByRole('tooltip');
    // Assert the bubble has its label, not merely that something mounted.
    await expect(bubble).toHaveTextContent('View details');
    await expect(canvasElement.contains(bubble)).toBe(false);
    await expect(getComputedStyle(bubble).position).toBe('fixed');
    // It must never intercept the click on the button it describes.
    await expect(getComputedStyle(bubble).pointerEvents).toBe('none');

    /* The 10px gap above the trigger is computed in an effect, so the first
       paint sits at 0,0. Waiting for the measured position is what distinguishes
       a positioned tooltip from one stranded in the corner of the viewport. */
    await waitFor(async () => {
      const gap = trigger.getBoundingClientRect().top - bubble.getBoundingClientRect().bottom;
      await expect(gap).toBeGreaterThan(0);
      await expect(gap).toBeLessThanOrEqual(12);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only state in which the 30px eye button carries a name. `side="top"` sits it ten ' +
          'pixels clear of the trigger and centres it with a `-50%` X translate, clamped to eight ' +
          'pixels of viewport padding - so on the rightmost column it slides inward rather than ' +
          'overflowing.',
      },
    },
  },
};

export const TooltipDoesNotAccumulate: Story = {
  name: 'Moving between rows keeps one bubble',
  play: async ({ canvasElement }) => {
    const first = viewButton(canvasElement, 'Poppy');
    const second = viewButton(canvasElement, 'Biscuit');

    await userEvent.hover(first);
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(
      'View details'
    );

    // Each row owns its own portal, so leaving one must tear its bubble down.
    await userEvent.unhover(first);
    await waitFor(async () => {
      await expect(tooltips()).toHaveLength(0);
    });

    await userEvent.hover(second);
    await waitFor(async () => {
      await expect(tooltips()).toHaveLength(1);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every row wraps its action in its own `GlassTooltip`, each with its own imperative ' +
          '`mouseenter`/`mouseleave` pair. Dragging down a ten-row page is therefore ten open/close ' +
          'cycles, and a missing teardown shows up not as a broken tooltip but as a pile of them ' +
          'over the table. One bubble at a time is the property worth pinning.',
      },
    },
  },
};

export const TooltipOnKeyboardFocus: Story = {
  name: 'Row action tooltip (keyboard focus)',
  play: async ({ canvasElement }) => {
    const trigger = viewButton(canvasElement, 'Bruno');
    trigger.focus();

    // `focusin` bubbles to the wrapper span, so the tooltip is not hover-only.
    const bubble = await within(document.body).findByRole('tooltip');
    await expect(bubble).toHaveTextContent('View details');

    trigger.blur();
    await waitFor(async () => {
      await expect(tooltips()).toHaveLength(0);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same bubble reached without a pointer. It matters because the icon button has no ' +
          'visible label: a tooltip bound to `mouseenter` alone would leave a keyboard user with an ' +
          'unnamed circle, and the `focusin`/`focusout` pair is what prevents that.',
      },
    },
  },
};

export const RowActionsFire: Story = {
  name: 'Row actions',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // Dispense only exists on a PENDING row - the other two statuses are terminal.
    const dispense = canvas.getAllByRole('button', { name: /^Dispense prescription for / });
    await expect(dispense).toHaveLength(1);

    await userEvent.click(dispense[0]);
    await expect(args.onDispense).toHaveBeenCalledWith(ROWS[0]);

    // The tooltip is pointer-events:none, so hovering first cannot swallow the click.
    const view = viewButton(canvasElement, 'Poppy');
    await userEvent.hover(view);
    await userEvent.click(view);
    await expect(args.onView).toHaveBeenCalledWith(ROWS[0]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both row actions, driven through the tooltip rather than around it. The click is fired ' +
          'while the bubble is up on purpose: the bubble is centred directly over the trigger, so ' +
          'it would cover it entirely if it ever stopped being click-through.',
      },
    },
  },
};
