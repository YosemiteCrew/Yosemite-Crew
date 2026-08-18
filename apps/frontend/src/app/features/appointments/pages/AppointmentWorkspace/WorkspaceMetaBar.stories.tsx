import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type {
  AppointmentEncounter,
  EncounterMode,
} from '@/app/features/appointments/types/workspace';
import WorkspaceMetaBar from './WorkspaceMetaBar';

const ROOM_OPTIONS = [
  { label: 'Consult 1', value: 'room-1' },
  { label: 'Consult 2', value: 'room-2' },
  { label: 'Theatre A', value: 'room-3' },
  { label: 'Isolation', value: 'room-4' },
];

const UNIT_OPTIONS = [
  { label: 'ICU', value: 'unit-icu' },
  { label: 'Ward B', value: 'unit-ward-b' },
  { label: 'Recovery', value: 'unit-recovery' },
];

const ENCOUNTER: AppointmentEncounter = {
  appointmentId: 'appt-meta-1',
  mode: 'INPATIENT',
  consultationType: 'Inpatient admission',
  leadId: 'user-lead',
  leadName: 'Dr. Amara Weber',
  nurseId: 'user-nurse',
  nurseName: 'Jonah Pike',
  alerts: [],
  soap: [],
  soapTemplates: [],
  vitals: [],
  observations: [],
  diagnosticTests: [],
  diagnosticOrders: [],
  services: [],
  prescription: [],
  schedule: [],
  roomId: 'room-2',
  unitId: 'unit-icu',
  invoiceLineItems: [],
  pastInvoices: [],
  depositCents: 0,
  currency: 'USD',
  withdrawDeposit: false,
  taxPercent: 0,
  overallDiscountPercent: 0,
  dischargeSummary: '',
  documents: [],
  readyForBilling: { value: false },
  readyForDischarge: { value: false },
  stepStatus: {
    SOAP: 'IN_PROGRESS',
    DIAGNOSTICS: 'EMPTY',
    TREATMENT: 'EMPTY',
    PASSPORT: 'EMPTY',
    INVOICE: 'EMPTY',
    SUMMARY: 'EMPTY',
  },
  viewOnly: false,
};

const withEncounter = (patch: Partial<AppointmentEncounter>): AppointmentEncounter => ({
  ...ENCOUNTER,
  ...patch,
});

const outpatient = (patch: Partial<AppointmentEncounter> = {}): AppointmentEncounter =>
  withEncounter({
    mode: 'OUTPATIENT' as EncounterMode,
    consultationType: 'Outpatient consult',
    unitId: undefined,
    ...patch,
  });

/** The listbox portals to `document.body`, so the bar needs room below it. */
const Room = (Story: React.ComponentType) => (
  <div className="min-h-[420px] w-full p-6" style={{ background: 'var(--screen)' }}>
    <Story />
  </div>
);

const openListbox = async (trigger: HTMLElement) => {
  await userEvent.click(trigger);
  const panel = document.querySelector('[data-portal-dropdown]');
  await expect(panel).toBeInTheDocument();
  return panel as HTMLElement;
};

const meta = {
  title: 'Appointments/WorkspaceMetaBar',
  component: WorkspaceMetaBar,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The workspace header strip: assigned lead, support staff, consultation type, and - when ' +
          'the encounter has them - the Room and Unit pickers, with the Ready toggles and the ' +
          'step CTA held in a second column.\n\n' +
          'The surface that had never been drawn is the Room/Unit **listbox**, and it is a ' +
          'genuinely fragile one. `EditableMetaDropdown` does not wrap `LabelDropdown` in a styled ' +
          'shell; it reaches *into* it with descendant selectors keyed on its exact DOM nesting. ' +
          "`[&>div>span]` takes LabelDropdown's ordinary stacked 12px label and re-renders it " +
          'notched into the border - `absolute -top-[7px] left-3`, `bg-[var(--screen)]`, ' +
          '`px-[5px]`, 10.5px on `--ink-faint` - so it lines up with the `MetaFieldShell` labels ' +
          'beside it. `[&>div>div>button]` then overrides the trigger to a 14px radius, a ' +
          '`--field-bg` fill and 13.5px/600 text so it matches the read-only fields rather than ' +
          "washing out transparently. Both selectors depend on LabelDropdown's internal tree " +
          '(label `<span>`, then the positioned `<div>` holding the trigger `<button>`); any ' +
          'restructuring there silently un-styles this bar, and nothing but a rendered story ' +
          'would show it.\n\n' +
          'The panel itself is `createPortal`ed to `document.body`, outside the canvas, and only ' +
          'exists after a click - the same class of surface as the four production layout bugs on ' +
          'this branch. The stories below open it and assert it carries its option rows, not ' +
          'merely that the trigger flipped `aria-expanded`.\n\n' +
          'Which fields appear at all is data, not decoration: Room shows when the encounter is ' +
          'inpatient, already has a `roomId`, or has room options to choose from; Unit is ' +
          'inpatient-only; and `roomAssignmentLocked` swaps both for static `ReadOnlyMetaField` ' +
          'boxes rather than disabling the dropdowns.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    encounter: ENCOUNTER,
    activeStep: 'SOAP',
    roomOptions: ROOM_OPTIONS,
    unitOptions: UNIT_OPTIONS,
    onSelectRoom: fn(),
    onSelectUnit: fn(),
    onSaveAndNext: fn(),
    onToggleReadyForBilling: fn(),
    onToggleReadyForDischarge: fn(),
    billingTogglesLocked: false,
    dischargeTogglesLocked: false,
  },
} satisfies Meta<typeof WorkspaceMetaBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inpatient: Story = {
  name: 'Inpatient (closed)',
  parameters: {
    docs: {
      description: {
        story:
          'All five fields at rest. The two editable dropdowns must read as the same box as the ' +
          'three read-only fields beside them - same 14px radius, same `--field-bg` fill, same ' +
          'notched 10.5px label - even though only the latter three are built from `MetaFieldShell`.',
      },
    },
  },
};

export const RoomListboxOpen: Story = {
  name: 'Room listbox open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = await openListbox(canvas.getByRole('button', { name: 'Room: Consult 2' }));
    // Options are plain <button>s, not role="option".
    await expect(within(panel).getAllByRole('button')).toHaveLength(ROOM_OPTIONS.length);
    await expect(within(panel).getByText('Theatre A')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The Room panel, measured off the trigger rect and dropped 4px below it. The trigger is ' +
          'only 160px wide here (`w-40`), so the panel inherits that width and the longer room names ' +
          'are the first thing that would truncate.',
      },
    },
  },
};

export const UnitListboxOpen: Story = {
  name: 'Unit listbox open (narrowest trigger)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = await openListbox(canvas.getByRole('button', { name: 'Unit: ICU' }));
    await expect(within(panel).getAllByRole('button')).toHaveLength(UNIT_OPTIONS.length);
    await expect(within(panel).getByText('Recovery')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same panel on the 128px (`w-32`) Unit field - the narrowest trigger in the bar, and ' +
          "where `LabelDropdown`'s own `min-w-30` floor starts to fight the column width.",
      },
    },
  },
};

export const RoomAssignmentLocked: Story = {
  name: 'Room assignment locked',
  args: { roomAssignmentLocked: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The locked branch renders static boxes: there is no dropdown trigger at all.
    await expect(canvas.queryByRole('button', { name: /^Room:/ })).not.toBeInTheDocument();
    await expect(canvas.getByText('Consult 2')).toBeInTheDocument();
    await expect(canvas.getByText('ICU')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The locked branch resolves the selected ids to labels through ' +
          '`getSelectedDropdownLabel` and renders plain `MetaFieldShell` boxes. It drops the ' +
          'affordance entirely instead of disabling it, which is the correct choice but also means ' +
          'the two branches share no markup - they can drift apart without any test noticing.',
      },
    },
  },
};

export const OutpatientWithRoom: Story = {
  name: 'Outpatient (room only, no unit)',
  args: { encounter: outpatient() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Room: Consult 2' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Unit/ })).not.toBeInTheDocument();
    await expect(canvas.getByText('Outpatient')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Outpatient keeps Room (the encounter has one) but drops Unit, and the consultation-type ' +
          'glyph swaps from the bed to the footprints. One fewer field changes how the left column ' +
          'wraps, so it is worth seeing beside the inpatient bar rather than inferred from it.',
      },
    },
  },
};

export const ReadyAndLocked: Story = {
  name: 'Ready stamped, toggles locked',
  args: {
    encounter: withEncounter({
      readyForBilling: { value: true, byName: 'Dr. Amara Weber', at: '2026-03-12T09:14:00.000Z' },
      readyForDischarge: { value: false },
      viewOnly: true,
    }),
    billingTogglesLocked: true,
    dischargeTogglesLocked: false,
    activeStep: 'INVOICE',
  },
  parameters: {
    docs: {
      description: {
        story:
          'A checked Ready toggle grows: it appends " · <name> <stamp>" inline, so the right column ' +
          'gets materially wider exactly when the encounter is furthest along. Paired here with a ' +
          'view-only encounter, which disables the step CTA while the discharge checkbox stays live.',
      },
    },
  },
};
