import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type {
  DispensaryItem,
  DispensaryRecord,
} from '@/app/features/inventory/pages/Inventory/types';
import DispensaryDetailModal from './DispensaryDetailModal';

/** Tablets with a whole-number course: 1 x 2/day x 10 days = 20, over a 10-pack. */
const AMOXICILLIN: DispensaryItem = {
  name: 'Amoxicillin/clavulanate 50 mg',
  quantity: 1,
  priceCents: 1840,
  isRx: true,
  doseQty: 1,
  doseUnit: 'tablet',
  frequency: 'BID',
  durationDays: 10,
  durationUnit: 'days',
  refillsRemaining: 1,
  stockUnitQty: 10,
  stockUnitType: 'Pack',
};

/** A controlled liquid: fractional dose, so the course lands on 3.6 ml. */
const METHADONE: DispensaryItem = {
  name: 'Methadone 10 mg/ml',
  quantity: 0.4,
  priceCents: 900,
  isRx: true,
  isControlled: true,
  doseQty: 0.4,
  doseUnit: 'ml',
  frequency: 'q8h',
  durationDays: 3,
  durationUnit: 'days',
  refillsRemaining: 0,
  stockUnitQty: 10,
  stockUnitType: 'Vial',
};

/** Weekly dosing drives the other calculation branch (frequency below 1/day). */
const MILBEMAX: DispensaryItem = {
  name: 'Milbemax chewable',
  quantity: 1,
  priceCents: 2200,
  isRx: true,
  doseQty: 1,
  doseUnit: 'tablet',
  frequency: 'once weekly',
  durationDays: 4,
  durationUnit: 'weeks',
  refillsRemaining: 2,
  stockUnitQty: 6,
  stockUnitType: 'Pack',
};

/** No enriched fields at all - only the legacy free-text prescription block. */
const LEGACY_ITEM: DispensaryItem = {
  name: 'Otic cleanser',
  quantity: 1,
  priceCents: 1450,
  prescription: {
    dose: '5 drops',
    freq: 'Twice daily',
    duration: '7 days',
    refill: 'None',
    route: 'Otic',
  },
};

const record = (overrides: Partial<DispensaryRecord> = {}): DispensaryRecord => ({
  id: 'disp-4410',
  prescriptionId: 'rx-4410',
  patient: {
    name: 'Poppy',
    appointmentId: 'APT-8841',
    petBreed: 'Beagle',
    petAge: '4y',
  },
  status: 'PENDING',
  prescriptionItems: ['Amoxicillin/clavulanate 50 mg', 'Methadone 10 mg/ml'],
  prescriptionCreated: '2026-03-12T08:40:00.000Z',
  amountCents: 2740,
  currency: 'EUR',
  lead: 'Dr. Ravi Menon',
  petParentName: 'Maya Whitfield',
  location: 'Ward 2',
  requestType: 'PATIENT',
  items: [AMOXICILLIN, METHADONE],
  ...overrides,
});

type DispensaryModalProps = ComponentProps<typeof DispensaryDetailModal>;

/**
 * The panel is a right-side drawer portalled to `document.body` by `Modal`, so
 * it only exists while a parent keeps it mounted. The harness mounts it on the
 * trigger the way the Inventory page does from a dispensary row, and keeps it
 * off the docs page at rest where `ModalBase`'s shared scroll lock would
 * otherwise stay held.
 */
const DispensaryFlowHarness = ({
  showModal: _showModal,
  setShowModal: _setShowModal,
  ...args
}: DispensaryModalProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[520px] items-start p-6">
      <button
        type="button"
        className="rounded-2xl bg-[var(--cta)] px-6 py-3 text-body-3-emphasis text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open dispense request
      </button>
      {open && <DispensaryDetailModal {...args} showModal setShowModal={setOpen} />}
    </div>
  );
};

const openPanel = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Open dispense request' }));
  const panel = document.body.querySelector('dialog.yc-modal-dialog') as HTMLElement | null;
  await expect(panel).toBeInTheDocument();
  return panel as HTMLElement;
};

const meta = {
  title: 'Inventory/DispensaryDetailModal',
  component: DispensaryDetailModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'What a pharmacist sees before handing medication over: the request, every line on it, ' +
          'and the arithmetic that turns a prescription into a number of packs off the shelf. It ' +
          'had no story, and it cannot have one that simply renders - `Modal` `createPortal`s a ' +
          '470px right-side drawer to `document.body`, so the panel exists only while the ' +
          'Inventory page keeps it mounted.\n\n' +
          '**The dispense calculation is the part that was invisible and matters most.** ' +
          '`quantity x frequency/day x duration` is computed here, in the component, from a ' +
          'free-text frequency parsed by keyword ("BID", "q8h", "once weekly"), and the result is ' +
          'what the shelf is emptied by. It renders through two different branches: at or above ' +
          'once a day it prints `1 x 2/day x 10 days = 20 tablets`, and below once a day it drops ' +
          'the per-day term for `1 x 4 weeks (once weekly) = 4 tablets`. The same total is shown ' +
          'twice - as the blue summary beside the item name and again as the green "To dispense" ' +
          'value - so the two agreeing is a property worth asserting rather than eyeballing.\n\n' +
          'The footer is a third state machine on top of that: `PENDING` gets the ' +
          '`Dispense all (n)` / `Not dispensed` pair, `DISPENSED` swaps the whole row for a single ' +
          'Label button and puts a green check in the header, and `NOT_DISPENSED` renders **no ' +
          'footer at all** - a panel that is read-only with nothing saying so. All three are drawn ' +
          'below.\n\n' +
          'The stories drive the panel through its trigger and assert it has its rows, its ' +
          'arithmetic and the right footer. They deliberately stop short of pressing Dispense, ' +
          'Not dispensed or Label: those call the prescription and label services.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    record: record(),
    showModal: true,
    setShowModal: fn(),
    organisationId: 'org-storybook',
    onActionComplete: fn(),
  },
  render: (args) => <DispensaryFlowHarness {...args} />,
} satisfies Meta<typeof DispensaryDetailModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingRequest: Story = {
  name: 'Pending request',
  play: async ({ canvasElement }) => {
    const panel = within(await openPanel(canvasElement));
    // Assert the drawer drew its header, its lines AND its arithmetic - not
    // merely that something portalled.
    await expect(panel.getByRole('heading', { name: 'Poppy • Whitfield' })).toBeInTheDocument();
    await expect(panel.getByText('Dispense request')).toBeInTheDocument();
    await expect(panel.getByText('Maya Whitfield')).toBeInTheDocument();
    await expect(panel.getByText('APT-8841')).toBeInTheDocument();
    await expect(panel.getByText('Amoxicillin/clavulanate 50 mg')).toBeInTheDocument();
    await expect(panel.getByText('Methadone 10 mg/ml')).toBeInTheDocument();
    await expect(panel.getByText('Controlled')).toBeInTheDocument();
    // The course total, and the pack count derived from it. Both are rendered
    // twice - item summary and "To dispense" - and must agree.
    await expect(panel.getByText('20 tablets')).toBeInTheDocument();
    await expect(panel.getAllByText('2 packs')).toHaveLength(2);
    await expect(panel.getAllByText('1 vial')).toHaveLength(2);
    await expect(panel.getByRole('button', { name: 'Dispense all (2)' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Not dispensed' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two lines, one of them controlled. The blue figure beside each name is what leaves the ' +
          'shelf; the card under it shows the prescription as written and then the working that got ' +
          'there, with the pack maths on the right.',
      },
    },
  },
};

export const WeeklyDosing: Story = {
  name: 'Weekly dosing (sub-daily branch)',
  args: { record: record({ items: [MILBEMAX], prescriptionItems: ['Milbemax chewable'] }) },
  play: async ({ canvasElement }) => {
    const panel = within(await openPanel(canvasElement));
    // The other calculation branch: no "/day" term, the duration unit carried
    // through, and the frequency quoted in brackets.
    await expect(panel.getByText('4 tablets')).toBeInTheDocument();
    await expect(panel.getByText('1 pack of 6 tablet')).toBeInTheDocument();
    await expect(panel.getAllByText('1 pack')).toHaveLength(2);
    await expect(panel.getByRole('button', { name: 'Dispense all (1)' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A once-weekly course over four weeks. `parseFrequencyPerDay` returns 1/7, so the ' +
          'component takes its second branch and rounds the total up rather than printing a ' +
          'fraction of a tablet.',
      },
    },
  },
};

export const LegacyPrescription: Story = {
  name: 'Legacy line (no calculation)',
  args: { record: record({ items: [LEGACY_ITEM], prescriptionItems: ['Otic cleanser'] }) },
  play: async ({ canvasElement }) => {
    const panel = within(await openPanel(canvasElement));
    // With no frequency or duration there is nothing to calculate, so the card
    // falls back to the free-text block and the summary is the raw quantity.
    await expect(panel.queryByText('Dispense qnt. calculation:')).not.toBeInTheDocument();
    await expect(panel.getByText('Twice daily')).toBeInTheDocument();
    await expect(panel.getByText('7 days')).toBeInTheDocument();
    await expect(panel.getByText('1 unit')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An older prescription with none of the enriched fields. This is the fallback shape - ' +
          'freq/duration/refill as plain strings, no working shown - and it is the only frame where ' +
          'the summary reads in bare "units" because no stock unit is known.',
      },
    },
  },
};

export const DispensedRecord: Story = {
  name: 'Already dispensed',
  args: { record: record({ status: 'DISPENSED', timeDispensed: '2026-03-12T09:20:00.000Z' }) },
  play: async ({ canvasElement }) => {
    const panel = within(await openPanel(canvasElement));
    await expect(panel.getByText('Dispensed request')).toBeInTheDocument();
    // The whole footer is replaced, not disabled: the two queue actions are
    // gone and a single label reprint takes their place.
    await expect(panel.getByRole('button', { name: 'Label' })).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: /Dispense all/ })).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Not dispensed' })).not.toBeInTheDocument();
    // The lines stay readable after the fact - this is the receipt view.
    await expect(panel.getByText('Amoxicillin/clavulanate 50 mg')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'After the fact. The eyebrow changes tense, a green check joins the header beside the ' +
          'close button, and the only remaining action reprints the label.',
      },
    },
  },
};

export const NotDispensedRecord: Story = {
  name: 'Marked not dispensed (no footer)',
  args: { record: record({ status: 'NOT_DISPENSED' }) },
  play: async ({ canvasElement }) => {
    const panel = within(await openPanel(canvasElement));
    // Neither branch matches, so `DispensaryFooter` returns null outright.
    // Nothing in the panel says it is closed - worth seeing.
    await expect(panel.queryByRole('button', { name: /Dispense all/ })).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Label' })).not.toBeInTheDocument();
    await expect(panel.getByText('Amoxicillin/clavulanate 50 mg')).toBeInTheDocument();
    await expect(panel.getByText('Dispense request')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A refused request. The footer disappears entirely and the eyebrow still reads "Dispense ' +
          'request", so the panel looks live and simply has no actions - the state this frame exists ' +
          'to make visible.',
      },
    },
  },
};

export const NoItems: Story = {
  name: 'No items recorded',
  args: { record: record({ items: [], prescriptionItems: [] }) },
  play: async ({ canvasElement }) => {
    const panel = within(await openPanel(canvasElement));
    await expect(panel.getByText('No items recorded')).toBeInTheDocument();
    // The count in the confirm comes from the same list, so it reads zero.
    await expect(panel.getByRole('button', { name: 'Dispense all (0)' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A request whose lines never loaded. The body shows the empty notice while the footer ' +
          'still offers "Dispense all (0)" - two halves of the panel disagreeing, which only a ' +
          'rendered frame shows.',
      },
    },
  },
};

export const NoOwnerName: Story = {
  name: 'No owner on record',
  args: { record: record({ petParentName: undefined }) },
  play: async ({ canvasElement }) => {
    const panel = within(await openPanel(canvasElement));
    // Without an owner the title drops the bullet and the meta line vanishes,
    // so the header is a single line instead of two.
    await expect(panel.getByRole('heading', { name: 'Poppy' })).toBeInTheDocument();
    await expect(panel.queryByText('Maya Whitfield')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'In-house requests carry no pet parent. The title falls back to the patient name alone, ' +
          'which changes the height of the header row and everything below it.',
      },
    },
  },
};
