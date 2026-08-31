import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PackageTopFields from './PackageTopFields';

/**
 * The `@2xl:grid-cols-2` split is a CONTAINER query, not a media query, so it is
 * measured against the nearest `@container` ancestor - `SectionContainer` in the
 * real form. Without one the block silently stays a single column at every browser
 * width and the two-column story would be testing nothing. Every story therefore
 * renders inside an explicit `@container` of a known width, and `containerWidth`
 * is the knob: 42rem (672px) is the `@2xl` threshold.
 */
const meta = {
  title: 'Organization/PackageTopFields',
  component: PackageTopFields,
  parameters: {
    layout: 'padded',
    containerWidth: 880,
    docs: {
      description: {
        component:
          'The head of the package draft form: Name and Description on the left, Approx. duration ' +
          'plus the Lead/Support pair and the two scheduling checkboxes on the right.\n\n' +
          'The pair of checkboxes is the part worth pinning. Each takes *two* booleans, not one - ' +
          '`effectiveBookable` drives `checked` while `requiredBookable` drives `disabled` - because ' +
          'the controller derives the requirement from the package breakdown ' +
          '(`effectiveBookable = isBookable || requiredBookable`). Add a bookable service to the ' +
          'breakdown and the box locks itself on: the package inherits the flag and the user is no ' +
          'longer allowed to clear it. Nothing on screen explains that, so a mis-wired pair looks ' +
          'like a checkbox that has simply stopped responding.\n\n' +
          'The two dropdowns are also not interchangeable despite sitting in one 2-up row: Lead is ' +
          'a Yes/No pair (`LEAD_OPTIONS`) and Support is a 0-5 count (`STAFF_COUNT_OPTIONS`). A ' +
          'swapped options array renders a perfectly plausible control that writes the wrong value.\n\n' +
          'One thing the stories record rather than fix: each checkbox carries an `aria-label` ' +
          '("Package bookable", "Package in-patient") that overrides the visible text beside it ' +
          '("Is this package bookable?", "In-patient preferred"), so the announced name and the ' +
          'read name are not the same string.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    name: '',
    onNameChange: fn(),
    description: '',
    onDescriptionChange: fn(),
    descId: 'pkg-top-fields-desc',
    durationText: '',
    onDurationTextChange: fn(),
    leadCount: '',
    onLeadCountSelect: fn(),
    supportCount: '',
    onSupportCountSelect: fn(),
    effectiveBookable: false,
    requiredBookable: false,
    onIsBookableChange: fn(),
    effectiveInpatientPreferred: false,
    requiredInpatient: false,
    onIsInpatientPreferredChange: fn(),
  },
  decorators: [
    (Story, context) => (
      <div
        className="@container"
        style={{ width: (context.parameters.containerWidth as number | undefined) ?? 880 }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PackageTopFields>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The block's own root is the only `.grid` that both columns live inside. */
const outerGrid = (canvas: ReturnType<typeof within>) =>
  canvas.getByLabelText('Name').closest('.grid') as HTMLElement;

export const NewPackage: Story = {
  name: 'New package, nothing filled in',
  args: { descId: 'pkg-top-new-desc' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Two tracks AND two children. A template that loses a track does not error -
       it drops the right-hand column under the left one and still looks like a
       form, which is exactly how this regressed without anyone noticing. */
    const grid = outerGrid(canvas);
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(grid.children).toHaveLength(2);

    // A blank draft: no field may claim to be invalid before the user saves.
    await expect(canvas.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'false');
    await expect(canvas.getByLabelText('Approx. duration')).toHaveAttribute(
      'aria-invalid',
      'false'
    );
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);

    /* An empty count string matches no option, so both triggers must announce the
       bare placeholder. A trigger reading "Lead: Yes" here would mean the control
       had invented a selection the draft does not hold. */
    await expect(canvas.getByRole('button', { name: 'Lead' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Support' })).toBeInTheDocument();

    // Nothing in the breakdown yet, so both flags are the user's to set.
    const bookable = canvas.getByRole('checkbox', { name: 'Package bookable' });
    const inpatient = canvas.getByRole('checkbox', { name: 'Package in-patient' });
    await expect(bookable).not.toBeChecked();
    await expect(bookable).toBeEnabled();
    await expect(inpatient).not.toBeChecked();
    await expect(inpatient).toBeEnabled();
  },
};

export const Filled: Story = {
  name: 'A filled draft',
  args: {
    descId: 'pkg-top-filled-desc',
    name: 'Senior wellness package',
    description: 'Two-visit workup for patients over eight, bloods and dental grading included.',
    durationText: '90 mins',
    leadCount: '1',
    supportCount: '2',
    effectiveBookable: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* The trigger's accessible name is "<placeholder>: <label>", so this is the
       only place the *resolved* selection is visible. `leadCount` is "1" and
       LEAD_OPTIONS maps that to "Yes" - a raw "Lead: 1" would mean the value was
       never matched against the options at all. */
    await expect(canvas.getByRole('button', { name: 'Lead: Yes' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Support: 2' })).toBeInTheDocument();

    /* The two checkboxes are visually identical and adjacent, which makes a
       crossed pair of handlers invisible. Click one, assert the other stayed
       silent. */
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Package bookable' }));
    await expect(args.onIsBookableChange).toHaveBeenCalledWith(false);
    await expect(args.onIsInpatientPreferredChange).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Package in-patient' }));
    await expect(args.onIsInpatientPreferredChange).toHaveBeenCalledWith(true);
    await expect(args.onIsBookableChange).toHaveBeenCalledTimes(1);
  },
};

export const LeadAndSupportAreDifferentScales: Story = {
  name: 'Lead is Yes/No, Support is a count',
  args: {
    descId: 'pkg-top-dropdowns-desc',
    name: 'Dental scale and polish',
    durationText: '45 mins',
    leadCount: '1',
    supportCount: '2',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // Both menus portal to document.body, so they are never inside canvasElement.
    const body = within(globalThis.document.body);

    await userEvent.click(canvas.getByRole('button', { name: 'Lead: Yes' }));
    /* Lead is a yes/no question wearing a count control's clothes. If it ever
       inherits STAFF_COUNT_OPTIONS the trigger still reads "Lead: ..." and the
       menu still opens - only the answers change. */
    await expect(await body.findByRole('button', { name: 'No' })).toBeInTheDocument();
    await expect(body.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    await userEvent.click(body.getByRole('button', { name: 'No' }));
    await expect(args.onLeadCountSelect).toHaveBeenCalledWith('0');
    await expect(args.onSupportCountSelect).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: 'Support: 2' }));
    // Support runs 0-5, so the top of the range proves it is the other list.
    await expect(await body.findByRole('button', { name: '5' })).toBeInTheDocument();
    await userEvent.click(body.getByRole('button', { name: '5' }));
    await expect(args.onSupportCountSelect).toHaveBeenCalledWith('5');
    await expect(args.onLeadCountSelect).toHaveBeenCalledTimes(1);
  },
};

export const ValidationErrors: Story = {
  name: 'Name and duration rejected on save',
  args: {
    descId: 'pkg-top-errors-desc',
    name: '',
    durationText: '',
    nameError: 'Name is required.',
    durationTextError: 'Enter a duration.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nameInput = canvas.getByLabelText('Name');
    const durationInput = canvas.getByLabelText('Approx. duration');

    await expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    await expect(durationInput).toHaveAttribute('aria-invalid', 'true');

    /* The two messages sit in different columns and are wired through separate
       `useId()` values the story cannot predict. Assert each input points at ITS
       OWN alert: crossed ids leave both messages on screen, both fields red, and
       a screen reader reading the wrong reason for the wrong field. */
    const alerts = canvas.getAllByRole('alert');
    await expect(alerts).toHaveLength(2);
    const nameAlert = alerts.find((a) => a.textContent?.includes('Name is required.'));
    const durationAlert = alerts.find((a) => a.textContent?.includes('Enter a duration.'));
    await expect(nameAlert).toBeDefined();
    await expect(durationAlert).toBeDefined();
    await expect(nameInput.getAttribute('aria-describedby')).toBe(nameAlert?.id);
    await expect(durationInput.getAttribute('aria-describedby')).toBe(durationAlert?.id);
    await expect(nameAlert?.id).not.toBe(durationAlert?.id);

    // The Description textarea shares the left column but is never validated here.
    await expect(canvas.getByLabelText('Description')).not.toHaveAttribute('aria-invalid');
  },
};

export const LockedByBreakdown: Story = {
  name: 'Both flags forced by the breakdown',
  args: {
    descId: 'pkg-top-locked-desc',
    name: 'Dental day patient package',
    durationText: '3 hrs',
    leadCount: '1',
    supportCount: '1',
    effectiveBookable: true,
    requiredBookable: true,
    effectiveInpatientPreferred: true,
    requiredInpatient: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const bookable = canvas.getByRole('checkbox', { name: 'Package bookable' });
    const inpatient = canvas.getByRole('checkbox', { name: 'Package in-patient' });

    /* Checked AND disabled together. Checked-but-enabled would let the user clear
       a flag the package genuinely inherits from its contents; disabled-but-
       unchecked would show a package as non-bookable while it saves as bookable,
       since the controller writes `effectiveBookable` either way. */
    await expect(bookable).toBeChecked();
    await expect(bookable).toBeDisabled();
    await expect(inpatient).toBeChecked();
    await expect(inpatient).toBeDisabled();

    await userEvent.click(bookable, { pointerEventsCheck: 0 });
    await userEvent.click(inpatient, { pointerEventsCheck: 0 });
    await expect(args.onIsBookableChange).not.toHaveBeenCalled();
    await expect(args.onIsInpatientPreferredChange).not.toHaveBeenCalled();
  },
};

export const NarrowContainer: Story = {
  name: 'Narrow container: one column',
  parameters: { containerWidth: 420 },
  args: {
    descId: 'pkg-top-narrow-desc',
    name: 'Senior wellness package',
    description: 'Two-visit workup for patients over eight.',
    durationText: '90 mins',
    leadCount: '1',
    supportCount: '2',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = outerGrid(canvas);

    // 420px is under the 672px `@2xl` threshold, so the split must not apply.
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(1);

    /* Stacked, in source order: Name/Description above Duration. A collapsed grid
       that kept the columns side by side would squeeze both to ~200px instead. */
    const nameBox = canvas.getByLabelText('Name').getBoundingClientRect();
    const durationBox = canvas.getByLabelText('Approx. duration').getBoundingClientRect();
    await expect(durationBox.top).toBeGreaterThan(nameBox.bottom);
    await expect(Math.round(durationBox.width)).toBe(Math.round(nameBox.width));

    /* The checkbox row is `flex-wrap ... whitespace-nowrap`: the labels never
       break mid-phrase, they drop onto a second line. At 420 that is the only
       thing keeping the row inside the card. */
    const row = canvas.getByRole('checkbox', { name: 'Package bookable' }).closest('div');
    await expect(row).not.toBeNull();
    await expect((row as HTMLElement).scrollWidth).toBeLessThanOrEqual(
      (row as HTMLElement).clientWidth
    );
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
