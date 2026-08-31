import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { MdPets } from 'react-icons/md';

import type { CompanionAlert } from '@/app/features/companions/components/AddCompanion/type';
import {
  AddCompanionWizardFooter,
  AlertChipEdit,
  AlertChipView,
  FooterLeft,
  InfoRow,
  PhotoDropzone,
  SectionHeading,
  SexRadioRow,
  StepDots,
  WizardStepHeader,
} from './AddCompanionPresentational';

/**
 * A 1x1 transparent GIF. The dropzone paints `photoUrl` as a CSS
 * `background-image`, so the story needs a URL that resolves without a network
 * round trip - a remote src would leave the "chosen" state indistinguishable
 * from the empty one whenever the runner is offline.
 */
const PHOTO_DATA_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const ALERTS: CompanionAlert[] = [
  { id: 'alert-low', label: 'Nervous', priority: 'low' },
  { id: 'alert-medium', label: 'Needs muzzle', priority: 'medium' },
  { id: 'alert-high', label: 'Bite risk', priority: 'high' },
  { id: 'alert-critical', label: 'Anaphylaxis', priority: 'critical' },
];

/**
 * `fromStoredCompanionAlerts` casts any unrecognised `severity` straight through
 * to `priority`, so a chip whose priority is not one of the four really can
 * reach the view chip at runtime. That is the branch `?? ALERT_PRIORITY_CONFIG.medium`
 * exists for.
 */
const UNKNOWN_PRIORITY_ALERT = {
  id: 'alert-unknown',
  label: 'Imported flag',
  priority: 'urgent',
} as unknown as CompanionAlert;

const childrenOf = (root: HTMLElement, selector: string) =>
  Array.from(root.querySelector(selector)?.children ?? []) as HTMLElement[];

const paneOf = (root: HTMLElement, testId: string) =>
  root.querySelector(`[data-testid="${testId}"]`) as HTMLElement;

/** The visible dropzone is the `<label>` wrapping the sr-only file input. */
const dropzoneOf = (input: HTMLElement) => input.closest('label') as HTMLLabelElement;

const meta = {
  title: 'Companions/AddCompanionPresentational',
  component: AddCompanionWizardFooter,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The presentational half of the companion central modal: a file of small components ' +
          'that render purely from props, with no store, no fetch and no router between them ' +
          'and the pixels. They are catalogued here because they are the pieces the modal is ' +
          'assembled from, and each one carries a branch that is invisible until it is wrong - ' +
          'the dash `InfoRow` falls back to, the per-priority palette on the alert chips, the ' +
          '`label`/`input` id pairing that makes the photo dropzone clickable at all, and the ' +
          'three-way secondary-action branch in the wizard footer.\n\n' +
          '`AddCompanionWizardFooter` is the meta component, so the controls table below ' +
          'describes it; the other stories drive their own component through `render`.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    step: 1,
    variant: 'modal',
    hasUnsavedChanges: false,
    onAdvance: fn(),
    onBack: fn(),
    onCancel: fn(),
    onSubmit: fn(),
    setShowDiscardConfirm: fn(),
    pendingGoToAppointmentRef: { current: false },
  },
} satisfies Meta<typeof AddCompanionWizardFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InfoRows: Story = {
  name: 'Info rows fall back to a dash',
  render: () => (
    <div className="w-[320px]">
      <SectionHeading icon={<MdPets size={16} />} title="Patient Details" />
      <div className="mt-2" data-testid="info-rows">
        <InfoRow label="Breed" value="Beagle" />
        <InfoRow label="Microchip" value="" />
        <InfoRow label="Current weight" value={0} />
        <InfoRow label="Allergies" value={<span>Chicken protein</span>} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Two dashes, not one. `{value || '-'}` is falsy-checked rather than
       null-checked, so a recorded weight of 0 kg is displayed as "not recorded"
       exactly like a missing microchip. Pinning the count here means anyone who
       changes that guard has to decide about 0 on purpose. */
    await expect(canvas.getAllByText('-')).toHaveLength(2);

    /* `first:border-t-0` is what stops the section heading being followed by a
       stray rule. Measured, because the class silently does nothing if the rows
       ever stop being direct siblings. */
    const rows = childrenOf(canvasElement, '[data-testid="info-rows"]');
    await expect(rows).toHaveLength(4);
    await expect(getComputedStyle(rows[0]).borderTopWidth).toBe('0px');
    await expect(getComputedStyle(rows[1]).borderTopWidth).toBe('1px');
  },
};

export const AlertChips: Story = {
  name: 'Alert chips: one palette per priority',
  render: () => (
    <div className="flex flex-wrap items-center gap-2" data-testid="alert-chips">
      {ALERTS.map((alert) => (
        <AlertChipView key={alert.id} alert={alert} />
      ))}
      <AlertChipView alert={UNKNOWN_PRIORITY_ALERT} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const chips = childrenOf(canvasElement, '[data-testid="alert-chips"]');
    await expect(chips).toHaveLength(5);

    /* Four priorities, four backgrounds. A regression that resolves every chip
       through the same config entry still renders every label, so the labels
       prove nothing - the colours are the only visible difference. */
    const backgrounds = chips.slice(0, 4).map((chip) => getComputedStyle(chip).backgroundColor);
    await expect(new Set(backgrounds).size).toBe(4);

    // An imported priority nobody recognises lands on Medium rather than blank.
    await expect(getComputedStyle(chips[4]).backgroundColor).toBe(backgrounds[1]);
  },
};

export const AlertChipRemoval: Story = {
  name: 'Removing an alert reports its id',
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {ALERTS.slice(0, 3).map((alert) => (
        <AlertChipEdit key={alert.id} alert={alert} onRemove={args.onCancel} />
      ))}
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* Three identical-looking X buttons sit side by side, so the only thing
       telling a screen reader (or this test) them apart is the label. */
    const remove = canvas.getByRole('button', { name: 'Remove alert Bite risk' });
    await userEvent.click(remove);

    // The id, not the label - the parent list de-dupes on id.
    await expect(args.onCancel).toHaveBeenCalledWith('alert-high');
  },
};

export const WizardProgress: Story = {
  name: 'Step header and dots, step 1 vs step 2',
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3" data-testid="progress-1">
        <StepDots step={1} />
        <WizardStepHeader step={1} />
      </div>
      <div className="flex items-center gap-3" data-testid="progress-2">
        <StepDots step={2} />
        <WizardStepHeader step={2} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Step 1 of 2 · patient details')).toBeVisible();
    await expect(canvas.getByText('Step 2 of 2 · parent details')).toBeVisible();

    const first = childrenOf(canvasElement, '[data-testid="progress-1"] [aria-hidden="true"]');
    const second = childrenOf(canvasElement, '[data-testid="progress-2"] [aria-hidden="true"]');
    await expect(first).toHaveLength(2);
    await expect(second).toHaveLength(2);

    // 22x5 each: the dots are the only progress indicator, so a collapsed one
    // (an arbitrary value that failed to compile) would read as "no progress".
    for (const dot of [...first, ...second]) {
      const box = dot.getBoundingClientRect();
      await expect(box.width).toBe(22);
      await expect(box.height).toBe(5);
    }

    /* Exactly one dot changes between the steps. Comparing dot 2 against dot 1
       of the same row rather than against a hard-coded rgb keeps this honest in
       both themes. */
    const filled = getComputedStyle(first[0]).backgroundColor;
    await expect(getComputedStyle(second[0]).backgroundColor).toBe(filled);
    await expect(getComputedStyle(second[1]).backgroundColor).toBe(filled);
    await expect(getComputedStyle(first[1]).backgroundColor).not.toBe(filled);
  },
};

export const PhotoDropzoneStates: Story = {
  name: 'Photo dropzone: empty and chosen',
  render: (args) => (
    <div className="flex items-center gap-6">
      <div data-testid="dropzone-empty">
        <PhotoDropzone photoUrl="" onPhotoSelected={args.onCancel} />
      </div>
      <div data-testid="dropzone-chosen">
        <PhotoDropzone
          photoUrl={PHOTO_DATA_URL}
          onPhotoSelected={args.onCancel}
          className="size-14 sm:size-[72px]"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The visible target is the <label>; the real control is an sr-only file
       input positioned off-screen. If `useId` ever stops feeding `htmlFor`, the
       circle still renders and still looks clickable but opens nothing. */
    const [empty, chosen] = canvas.getAllByLabelText(
      'Upload companion photo'
    ) as HTMLInputElement[];
    for (const input of [empty, chosen]) {
      await expect(input.id).not.toBe('');
      await expect(dropzoneOf(input)).toHaveAttribute('for', input.id);
      await expect(input.type).toBe('file');
    }

    // The camera + "PHOTO" caption is the empty state only - once a photo is in
    // place it would print over the image.
    await expect(canvas.getAllByText('PHOTO')).toHaveLength(1);
    await expect(within(paneOf(canvasElement, 'dropzone-chosen')).queryByText('PHOTO')).toBeNull();

    await expect(getComputedStyle(dropzoneOf(chosen)).backgroundImage).toContain('data:image/gif');

    // Default sizing (`size-[72px]`) and the caller's `sm:` override land on the
    // same 72px circle above the sm breakpoint.
    await expect(dropzoneOf(empty).getBoundingClientRect().width).toBe(72);
    await expect(dropzoneOf(chosen).getBoundingClientRect().width).toBe(72);
  },
};

export const PhotoDropzonePhone: Story = {
  name: 'Phone: the dropzone follows the sm breakpoint',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  render: (args) => (
    <PhotoDropzone
      photoUrl=""
      onPhotoSelected={args.onCancel}
      className="size-14 sm:size-[72px]"
      iconSize={16}
    />
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Upload companion photo');
    const box = dropzoneOf(input).getBoundingClientRect();

    /* `size-14` below sm, `size-[72px]` above it - the exact class pair the
       form-mode patient column passes. The expectation is derived from the
       measured width rather than hard-coded at 56 because the viewport global
       only resizes the frame in the Storybook UI; a headless run of
       `iframe.html` gets the full window. Either way this fails if half the
       pair stops compiling, which is what would leave a 72px circle crowding
       the name field on a phone. */
    const expected = globalThis.window.innerWidth >= 640 ? 72 : 56;
    await expect(box.width).toBe(expected);
    await expect(box.height).toBe(expected);
  },
};

export const SexRow: Story = {
  name: 'Sex radios keep the neutered flag',
  render: (args) => <SexRadioRow gender="male" isNeutered onChange={args.onCancel} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* Both controls are sr-only inputs behind painted spans, so the checked
       state is carried entirely by the accessibility tree - if these stop being
       real radios the ring still fills and nothing announces. */
    await expect(canvas.getByRole('radio', { name: 'Male' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Female' })).not.toBeChecked();
    await expect(canvas.getByRole('checkbox', { name: 'Neutered' })).toBeChecked();

    await userEvent.click(canvas.getByRole('radio', { name: 'Female' }));
    // Sex and neutered share one callback, so switching sex has to carry the
    // existing neutered value or it silently resets to "not neutered".
    await expect(args.onCancel).toHaveBeenCalledWith('female', true);
  },
};

export const WizardFooterStep1: Story = {
  name: 'Wizard footer, step 1 (from an appointment)',
  args: { onGoToAppointment: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: /Parent details/ })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Save Patient Info/ })).toBeNull();
    // "Cancel" is replaced, not joined, when the modal was opened off an
    // appointment - two competing escape hatches in one footer.
    await expect(canvas.queryByRole('button', { name: 'Cancel' })).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: '← Go to Appointment' }));
    await expect(args.onGoToAppointment).toHaveBeenCalledTimes(1);
    await expect(args.setShowDiscardConfirm).not.toHaveBeenCalled();
  },
};

export const WizardFooterUnsavedChanges: Story = {
  name: 'Wizard footer, leaving with unsaved changes',
  args: {
    hasUnsavedChanges: true,
    onGoToAppointment: fn(),
    pendingGoToAppointmentRef: { current: false },
  },
  play: async ({ args, canvasElement }) => {
    // Reset so a re-run asserts the transition, not a value left behind.
    args.pendingGoToAppointmentRef.current = false;

    await userEvent.click(
      within(canvasElement).getByRole('button', { name: '← Go to Appointment' })
    );

    /* The navigation is deferred, not performed: the confirm dialog opens and
       the ref remembers where the user was heading. Calling `onGoToAppointment`
       here as well would navigate away behind the open dialog. */
    await expect(args.setShowDiscardConfirm).toHaveBeenCalledWith(true);
    await expect(args.pendingGoToAppointmentRef.current).toBe(true);
    await expect(args.onGoToAppointment).not.toHaveBeenCalled();
  },
};

export const WizardFooterStep2: Story = {
  name: 'Wizard footer, step 2',
  args: { step: 2, onGoToAppointment: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* Step 2 takes the left slot for "back" even when the modal was opened off
       an appointment, so the appointment link is genuinely gone rather than
       stacked behind it. */
    await expect(canvas.queryByRole('button', { name: '← Go to Appointment' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: /Parent details/ })).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: '← Patient details' }));
    await expect(args.onBack).toHaveBeenCalledTimes(1);

    await userEvent.click(canvas.getByRole('button', { name: /Save Patient Info/ }));
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onAdvance).not.toHaveBeenCalled();
  },
};

export const WizardFooterSheet: Story = {
  name: 'Phone sheet footer has no inline Cancel',
  args: { variant: 'sheet' },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The sheet is dismissed by its grabber, so the only button is the advance
       CTA. A "Cancel" leaking back in here is the kind of thing that reads fine
       in the modal story and crowds the phone footer into two rows. */
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: /Parent details/ })).toBeVisible();
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};

export const EditFooterLeft: Story = {
  name: 'Edit mode: discard changes',
  render: (args) => (
    <FooterLeft
      setMode={args.onCancel}
      setCompanionErrors={args.onAdvance}
      setParentErrors={args.onSubmit}
    />
  ),
  play: async ({ args, canvasElement }) => {
    /* `href="#"` never becomes a Link - BaseButton treats a bare hash as "not a
       link" - so this has to stay a real button or the click does nothing. */
    const discard = within(canvasElement).getByRole('button', { name: 'Discard changes' });
    await userEvent.click(discard);

    // Dropping back to view without clearing both error maps leaves stale
    // validation messages waiting to reappear on the next edit.
    await expect(args.onCancel).toHaveBeenCalledWith('view');
    await expect(args.onAdvance).toHaveBeenCalledWith({});
    await expect(args.onSubmit).toHaveBeenCalledWith({});
  },
};
