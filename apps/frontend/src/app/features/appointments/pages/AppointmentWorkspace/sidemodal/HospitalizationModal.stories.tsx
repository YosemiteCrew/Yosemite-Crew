import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import HospitalizationModal from './HospitalizationModal';

type HospitalizationProps = ComponentProps<typeof HospitalizationModal>;

const ROOM_OPTIONS: HospitalizationProps['roomOptions'] = [
  { label: 'ICU 1', value: 'room-icu-1' },
  { label: 'Ward B', value: 'room-ward-b' },
  { label: 'Isolation', value: 'room-isolation' },
];

const UNIT_OPTIONS: HospitalizationProps['unitOptions'] = [
  { label: 'Critical care', value: 'unit-critical' },
  { label: 'General inpatient', value: 'unit-general' },
];

const UNITS_BY_ROOM: HospitalizationProps['unitOptionsByRoomId'] = {
  'room-icu-1': [{ label: 'Critical care', value: 'unit-critical' }],
  'room-ward-b': [
    { label: 'General inpatient', value: 'unit-general' },
    { label: 'Step-down', value: 'unit-stepdown' },
  ],
  'room-isolation': [{ label: 'Isolation unit', value: 'unit-isolation' }],
};

const SUPPORT_OPTIONS: HospitalizationProps['supportOptions'] = [
  { label: 'Ruth Baumann', value: 'staff-ruth' },
  { label: 'Amelia Ross', value: 'staff-amelia' },
];

const SERVICE_PACKAGES: HospitalizationProps['servicePackages'] = [
  { id: 'pkg-1', kind: 'PACKAGE', name: 'Inpatient day rate', cost: 180, maxDiscount: 20 },
  { id: 'svc-1', kind: 'SERVICE', name: 'IV fluid therapy', cost: 45, maxDiscount: 5 },
  { id: 'svc-2', kind: 'SERVICE', name: 'Overnight monitoring', cost: 90, maxDiscount: 10 },
];

/**
 * The modal returns `null` while closed, so it is opened from a trigger the way the
 * workspace opens it. Leaving it open at rest would also hold `ModalBase`'s shared
 * body scroll lock across the whole docs page.
 */
const HospitalizationHarness = (args: HospitalizationProps) => {
  const [open, setOpen] = useState(args.showModal);
  return (
    <div className="flex min-h-[560px] items-start p-6">
      <button
        type="button"
        className="px-6 py-3 bg-text-primary text-[var(--screen)] rounded-2xl text-body-3-emphasis"
        onClick={() => setOpen(true)}
      >
        Open hospitalization panel
      </button>
      <HospitalizationModal
        {...args}
        showModal={open}
        setShowModal={(value) => {
          setOpen(value);
          args.setShowModal(value);
        }}
      />
    </div>
  );
};

const openModal = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Open hospitalization panel' }));
  const dialog = document.body.querySelector('dialog.yc-modal-dialog') as HTMLElement | null;
  await expect(dialog).toBeInTheDocument();
  return dialog as HTMLElement;
};

const meta = {
  title: 'Workspace/HospitalizationModal',
  component: HospitalizationModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Converts an outpatient encounter to inpatient. It had no story and nothing about it ' +
          'is reachable from a plain render: `if (!showModal) return null` guards the entire ' +
          'tree, and what it returns is portalled to `document.body` by the shared central ' +
          'modal shell.\n\n' +
          'What that hid is a two-column form made almost entirely of *other* gated surfaces. ' +
          'The left column is a `grid gap-5 sm:grid-cols-2` of two `Datepicker`s and a ' +
          '`Timepicker`, each of which opens a react-datepicker popper, plus the Room and Unit ' +
          '`LabelDropdown`s, whose 200px-max listbox is `createPortal`ed to `document.body` ' +
          'with `data-portal-dropdown`. The right column adds a `MultiSelectDropdown` and the ' +
          'estimate panel. None of those panels had ever been composited inside this modal.\n\n' +
          'Two behaviours only exist after an interaction. Room selection rewrites the Unit ' +
          'options through `unitOptionsByRoomId` and re-picks the unit, so the second dropdown ' +
          'is not independent of the first. And the validation block - a `flex flex-col` of ' +
          '`text-caption-2 text-text-error` lines below the room/unit row - renders only once ' +
          'Convert has been pressed with something missing, pushing the rest of the column ' +
          'down.\n\n' +
          'Each story opens the panel through its trigger and asserts the panel has real ' +
          'content, rather than asserting a dialog merely appeared.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: false,
    setShowModal: fn(),
    leadName: 'Dr. Marta Feld',
    supportName: 'Ruth Baumann',
    supportOptions: SUPPORT_OPTIONS,
    roomOptions: ROOM_OPTIONS,
    unitOptions: UNIT_OPTIONS,
    unitOptionsByRoomId: UNITS_BY_ROOM,
    servicePackages: SERVICE_PACKAGES,
    defaultRoomId: 'room-icu-1',
    defaultUnitId: 'unit-critical',
    onConvert: fn(() => true),
  },
  render: (args) => <HospitalizationHarness {...args} />,
} satisfies Meta<typeof HospitalizationModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Closed (renders nothing)',
  play: async () => {
    // The guard is `return null`, so there is no parked dialog to find.
    await expect(document.body.querySelector('dialog.yc-modal-dialog')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'While closed the component returns `null` outright - deliberately, so its Room ' +
        'dropdown does not duplicate the workspace meta-bar Room control in the DOM.',
    },
  },
};

export const Open: Story = {
  name: 'Open',
  play: async ({ canvasElement }) => {
    const panel = within(await openModal(canvasElement));
    // The title runs through the org terminology, so it is matched loosely.
    await expect(panel.getByRole('heading', { name: /^Hospitalizing/i })).toBeInTheDocument();
    // Assert the form actually populated - every one of these is a distinct field
    // component, and an empty panel would satisfy "a dialog opened".
    await expect(panel.getByRole('button', { name: /^Date of admission/ })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: /^Time of admission/ })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: /^Date of discharge/ })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Room: ICU 1' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Unit: Critical care' })).toBeInTheDocument();
    await expect(panel.getByText('Dr. Marta Feld')).toBeInTheDocument();
    await expect(panel.getByText('Estimate')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Convert to Inpatient' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The full panel at rest: dates and room/unit on the left, staff, packages and the ' +
        'estimate on the right, with the footer rule above a single primary. The estimate reads ' +
        '`$ 00.00` in tertiary ink until a package is chosen, which is its own state.',
    },
  },
};

export const RoomMenuOpen: Story = {
  name: 'Room listbox open',
  play: async ({ canvasElement }) => {
    const panel = within(await openModal(canvasElement));
    await userEvent.click(panel.getByRole('button', { name: 'Room: ICU 1' }));
    // The listbox portals to document.body, outside both the canvas and the dialog.
    const listbox = await within(document.body).findByLabelText('Room');
    await expect(listbox).toHaveAttribute('data-portal-dropdown');
    // Assert it has its three rooms, not merely that aria-expanded flipped.
    await expect(within(listbox).getAllByRole('button')).toHaveLength(3);
    await expect(within(listbox).getByText('Isolation')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The room menu, portalled to `document.body` and positioned 4px below the trigger. ' +
        'Because it escapes the modal, `AppointmentCentralModalShell` has to whitelist ' +
        '`[data-portal-dropdown]` in `ignoreOutsideClick` - otherwise picking a room would read ' +
        'as a click outside the dialog and close the whole panel.',
    },
  },
};

export const UnitFollowsRoom: Story = {
  name: 'Unit re-picks when the room changes',
  play: async ({ canvasElement }) => {
    const panel = within(await openModal(canvasElement));
    await userEvent.click(panel.getByRole('button', { name: 'Room: ICU 1' }));
    const listbox = await within(document.body).findByLabelText('Room');
    await userEvent.click(within(listbox).getByText('Ward B'));
    // Ward B has no critical-care unit, so the unit falls to the room's first option.
    await expect(
      await panel.findByRole('button', { name: 'Unit: General inpatient' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The two dropdowns are coupled: choosing a room swaps the unit list through ' +
        '`unitOptionsByRoomId` and re-picks the unit when the current one is not in it. Nothing ' +
        'in a static render shows that the second field is downstream of the first.',
    },
  },
};

export const ValidationErrors: Story = {
  name: 'Validation errors after Convert',
  args: { defaultRoomId: undefined, defaultUnitId: undefined },
  play: async ({ canvasElement }) => {
    const panel = within(await openModal(canvasElement));
    await userEvent.click(panel.getByRole('button', { name: 'Convert to Inpatient' }));
    await expect(await panel.findByText('Room is required.')).toBeInTheDocument();
    await expect(panel.getByText('Unit is required.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'Pressing Convert with no room or unit surfaces the error block under the room/unit ' +
        'row. It is gated on `hasSubmitted`, so the fields show no error until the panel has ' +
        'been submitted once - and the block pushes the left column down when it appears.',
    },
  },
};

export const Converting: Story = {
  name: 'Converting (pending)',
  args: {
    // Never resolves, so the in-flight state stays on screen for review. Wrapped in
    // fn() because meta.args types onConvert as a mock, and a bare arrow is not one.
    onConvert: fn(() => new Promise<boolean>(() => {})),
  },
  play: async ({ canvasElement }) => {
    const panel = within(await openModal(canvasElement));
    await userEvent.click(panel.getByRole('button', { name: 'Convert to Inpatient' }));
    const pending = await panel.findByRole('button', { name: 'Converting' });
    await expect(pending).toBeDisabled();
  },
  parameters: {
    docs: {
      story:
        'While `onConvert` is in flight the primary relabels to "Converting" and disables. ' +
        'There is no prop for it - the only way to reach the state is to hold the promise open.',
    },
  },
};
