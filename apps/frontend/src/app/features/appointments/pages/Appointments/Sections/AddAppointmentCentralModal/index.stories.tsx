import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { Slot } from '@/app/features/appointments/types/appointments';
import { AppointmentFormContent } from './index';

const TODAY = new Date('2026-03-12T00:00:00');

/**
 * Labels in the real modal are built by `formatCompanionNameWithOwnerLastName`,
 * which joins the companion to the owner's LAST name with a middle dot -
 * `Poppy · Hartmann`, never `Poppy (Hartmann)`. Worth matching exactly here,
 * because `AppointmentAvatar` derives its initials from the first and last
 * whitespace-separated token of this very string: with the real separator two of
 * these read 'PH', with brackets the second initial would be the bracket itself.
 */
const PATIENT_OPTIONS = [
  { value: 'companion-1', label: 'Poppy · Hartmann' },
  { value: 'companion-2', label: 'Mochi · Ruiz' },
  { value: 'companion-3', label: 'Bruno · Fabre' },
  { value: 'companion-4', label: 'Pepper · Hartmann' },
];

const CLIENT_OPTIONS = [
  { value: 'parent-1', label: 'Lena Hartmann' },
  { value: 'parent-2', label: 'Tomas Ruiz' },
];

const TIME_SLOTS: Slot[] = [
  { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1'] },
  { startTime: '09:30', endTime: '10:00', vetIds: ['vet-1', 'vet-2'] },
  { startTime: '10:00', endTime: '10:30', vetIds: ['vet-2'] },
];

const LEAD_OPTIONS = [
  { label: 'Dr. Weber', value: 'vet-1' },
  { label: 'Dr. Nadia Iqbal', value: 'vet-2' },
];

const SUPPORT_OPTIONS = [
  { label: 'Ana Silva', value: 'tech-1' },
  { label: 'Jonas Berg', value: 'tech-2' },
];

const SUBMIT_ERRORS: Record<string, string> = {
  companionId: 'Select a patient',
  slot: 'Select a time slot',
  leadId: 'Select a lead',
  specialityId: 'Select a speciality',
  serviceId: 'Select a service',
  concern: 'Describe the reason for the visit',
};

const SPECIALITY_OPTIONS = [{ label: 'General practice', value: 'spec-general' }];
const SERVICE_OPTIONS = [{ label: 'Annual check-up', value: 'svc-annual' }];

const FORM_DATA = {
  concern: '',
  isEmergency: false,
  lead: { id: '' },
  supportStaff: [] as Array<{ id?: string }>,
  appointmentType: { id: '', speciality: { id: '' } },
};

type FormProps = ComponentProps<typeof AppointmentFormContent>;

/**
 * Annotated with the prop's own type rather than written inline. An inline
 * `() => undefined` narrows the meta arg to a zero-argument signature, and every
 * per-story override that actually reads `field` then fails to type-check against it.
 */
const noFieldErrors: FormProps['showError'] = () => undefined;

/**
 * The form is fully controlled by `useAddAppointmentCentralModalView`, which owns the
 * modal, the companion loader and the booking request. Only the presentational half is
 * exported, and only that half is mounted here - the two person pickers still need
 * their query strings to live somewhere or their result lists can never open, so the
 * harness holds exactly those two values and forwards everything else to the story's
 * mocks.
 */
const FormHarness = (args: FormProps) => {
  const [patientQuery, setPatientQuery] = useState(args.patientQuery);
  const [clientQuery, setClientQuery] = useState(args.clientQuery);

  return (
    <AppointmentFormContent
      {...args}
      patientQuery={patientQuery}
      setPatientQuery={(value) => {
        setPatientQuery(value);
        args.setPatientQuery(value);
      }}
      clientQuery={clientQuery}
      setClientQuery={(value) => {
        setClientQuery(value);
        args.setClientQuery(value);
      }}
    />
  );
};

/** Both the person list and the slot list portal their panel and tag it the same way. */
const findPortalPanel = async (): Promise<HTMLElement> => {
  await waitFor(() => expect(document.querySelector('[data-portal-dropdown]')).toBeInTheDocument());
  return document.querySelector('[data-portal-dropdown]') as HTMLElement;
};

/**
 * The field grid: `grid-cols-1` with `md:grid-cols-2`, so it is the outermost `.grid`
 * in the tree and the first one in document order. Read as tracks rather than as a
 * class name, because the class only means anything once Tailwind has resolved it.
 */
const getFieldGrid = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('.grid') as HTMLElement;

const trackCount = (element: HTMLElement): number =>
  getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length;

const meta = {
  title: 'Appointments/AddAppointmentCentralModal',
  component: FormHarness,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The body of the Add appointment panel. Three of its surfaces exist only after an ' +
          'interaction or only after a failed submit, and none of them had ever been drawn.\n\n' +
          '**Submit-time validation.** Nothing on this form validates as you type. `showError` ' +
          'returns a message only once a submit has been attempted, so the first time a user ' +
          'sees any of it is the moment they press Book - at which point up to six fields ' +
          'change at once. They are not all the same control either: the patient picker and the ' +
          'time dropdown render a `FieldError` with `role="alert"`, while Lead, Speciality, ' +
          'Service and Chief Complaint render their own inline error rows with no alert ' +
          'semantics, so a screen reader hears two of the six. Below the grid a separate ' +
          'booking-level banner appears for `formDataErrors.booking`, which is the server ' +
          'refusing the booking rather than a field being wrong.\n\n' +
          '**The companion search list.** `PersonRow` measures its trigger in a layout effect ' +
          'and `createPortal`s the result list to `document.body`, so it is not a descendant of ' +
          'this form at all and no snapshot of the closed field contains a single row of it. It ' +
          'is also where "no matches" and "no options" are worded differently on purpose.\n\n' +
          '**The time-slot dropdown.** Same portal trick, three different bodies: a spinner ' +
          'row, the slot list, or a sentence explaining which upstream field is still empty.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    patientLabel: 'Patient',
    patientQuery: '',
    setPatientQuery: fn(),
    patientOptions: PATIENT_OPTIONS,
    handlePatientSelect: fn(),
    handlePatientClear: fn(),
    clientQuery: '',
    setClientQuery: fn(),
    clientOptions: CLIENT_OPTIONS,
    handleClientSelect: fn(),
    handleClientClear: fn(),
    setAddCompanionTarget: fn(),
    selectedDate: TODAY,
    handleDateChange: fn(),
    today: TODAY,
    timeSlots: [],
    selectedSlot: null,
    onSlotSelect: fn(),
    formState: {
      loadingTimeSlots: false,
      loadingSlotScopedOptions: false,
      serviceSelected: false,
      submitted: false,
      loading: false,
    },
    noSlotsMessage: 'Select a speciality and service first',
    prefillTimeLabel: null,
    durationDisplay: null,
    visitType: 'Outpatient',
    handleVisitTypeSelect: fn(),
    LeadOptions: LEAD_OPTIONS,
    formData: FORM_DATA,
    formDataErrors: {},
    handleLeadSelectWithReset: fn(),
    supportOptions: SUPPORT_OPTIONS,
    handleSupportStaffChange: fn(),
    SpecialitiesOptions: SPECIALITY_OPTIONS,
    handleSpecialitySelect: fn(),
    ServicesOptions: SERVICE_OPTIONS,
    handleServiceSelect: fn(),
    setFormData: fn(),
    ServiceInfoData: { cost: 82, maxDiscount: 12 },
    showError: noFieldErrors,
    handleSubmit: fn(),
    onCancel: fn(),
  },
  render: (args) => <FormHarness {...args} />,
} satisfies Meta<typeof FormHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Empty form',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Left column.
    await expect(canvas.getByLabelText('Patient')).toHaveValue('');
    await expect(canvas.getByLabelText('Client')).toHaveValue('');
    await expect(canvas.getByRole('button', { name: 'Time' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(canvas.getByRole('button', { name: 'Type of Visit: Outpatient' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Lead' })).toBeVisible();

    // Right column, including the estimate derived from the selected service.
    await expect(canvas.getByRole('button', { name: 'Speciality' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Services / Packages' })).toBeVisible();
    await expect(canvas.getByLabelText('Chief Complaint')).toHaveValue('');
    await expect(canvas.getByText('Cost (USD):')).toBeInTheDocument();
    /* Cost and Estimate print the SAME number here: `computeEstimate` is
       `max(0, cost)` and ignores maxDiscount entirely, while the appointment overview
       modal subtracts it from the same catalogue figures. Two nodes, not one - and the
       two are formatted differently as well ('$ 82.00' against '$12.00'). */
    await expect(canvas.getAllByText('$ 82.00')).toHaveLength(2);
    await expect(canvas.getByText('$12.00')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Mark appointment as emergency')).not.toBeChecked();

    // Nothing has been submitted, so no error surface exists at all.
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
    await expect(canvas.getByRole('button', { name: 'Book appointment' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeEnabled();

    // The two-column claim, measured rather than asserted from a class name. Two
    // resolved tracks and exactly two children: the left field stack and the right one.
    const grid = getFieldGrid(canvasElement);
    await expect(trackCount(grid)).toBe(2);
    await expect(grid.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel as it opens: a two-column grid from md up, single column below. Every ' +
          'field is in its resting state and the estimate already shows the catalogue price, ' +
          'because it comes from the selected service rather than from anything typed.',
      },
    },
  },
};

export const SubmitValidationErrors: Story = {
  name: 'Submit-time field errors',
  args: {
    formState: {
      loadingTimeSlots: false,
      loadingSlotScopedOptions: false,
      serviceSelected: false,
      submitted: true,
      loading: false,
    },
    formDataErrors: SUBMIT_ERRORS,
    showError: (field: string) => SUBMIT_ERRORS[field],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Only two of the six errors are announced. `FieldError` carries role="alert" and
       is used by the patient picker and the time dropdown; the LabelDropdown and
       FormDesc errors are plain rows. Asserting the exact contents of the alert set is
       the point - a change that dropped the role would still leave all six visible. */
    const alerts = canvas.getAllByRole('alert').map((node) => node.textContent?.trim());
    await expect(alerts).toContain('Select a patient');
    await expect(alerts).toContain('Select a time slot');
    await expect(alerts).toHaveLength(2);

    // The other four are on screen, just not announced.
    await expect(canvas.getByText('Select a lead')).toBeInTheDocument();
    await expect(canvas.getByText('Select a speciality')).toBeInTheDocument();
    await expect(canvas.getByText('Select a service')).toBeInTheDocument();
    await expect(canvas.getByText('Describe the reason for the visit')).toBeInTheDocument();

    // The error state is a border swap on the control itself as well as a message.
    await waitFor(() => {
      const patient = canvas.getByLabelText('Patient').closest('div') as HTMLElement;
      const client = canvas.getByLabelText('Client').closest('div') as HTMLElement;
      expect(getComputedStyle(patient).borderColor).not.toBe(getComputedStyle(client).borderColor);
    });

    // No booking-level banner: that one is a separate failure mode.
    await expect(canvas.queryByText(/could not be booked/i)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What Book produces on an empty form. Six messages at once, in four different ' +
          'renderings - two alerts, two dropdown rows, one textarea row - which is the ' +
          'inconsistency this story exists to make visible.',
      },
    },
  },
};

export const BookingWarningBanner: Story = {
  name: 'Booking-level warning banner',
  args: {
    formState: {
      loadingTimeSlots: false,
      loadingSlotScopedOptions: false,
      serviceSelected: true,
      submitted: true,
      loading: false,
    },
    formDataErrors: {
      booking: 'This slot could not be booked. The lead was taken while you were filling this in.',
    },
    selectedPatientName: 'Poppy · Hartmann',
    selectedClientName: 'Lena Hartmann',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const banner = await canvas.findByText(
      'This slot could not be booked. The lead was taken while you were filling this in.'
    );
    await expect(banner).toBeInTheDocument();

    // It sits BELOW the whole field grid, not beside a field - it is a booking
    // failure, not a field failure, and nothing above it is marked.
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
    const bannerBox = banner.closest('div.rounded-2xl') as HTMLElement;
    await waitFor(() => {
      expect(getComputedStyle(bannerBox).borderStyle).toBe('solid');
      expect(getComputedStyle(bannerBox).borderTopWidth).not.toBe('0px');
    });

    // The form is still filled in and still submittable - the banner is not a block.
    await expect(canvas.getByLabelText('Patient')).toHaveValue('Poppy · Hartmann');
    await expect(canvas.getByRole('button', { name: 'Book appointment' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Gated on `formState.submitted && formDataErrors.booking`, so it only ever appears ' +
          'after a rejected booking - unreachable without a server that says no. It is the one ' +
          'error on this form that is not attached to a field, and the only one that survives ' +
          'a fully valid form.',
      },
    },
  },
};

export const CompanionSearchResults: Story = {
  name: 'Companion search - results list',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Patient');

    await userEvent.click(input);
    await userEvent.type(input, 'hartmann');

    // The list is portalled to document.body, so it is NOT inside canvasElement.
    const panel = await findPortalPanel();
    const options = within(panel).getAllByRole('button');

    /* Two rows for two matches - and each row's `textContent` is TWO strings, not
       one. `AppointmentAvatar` renders the initials as real text in the same
       button, ahead of the label, so the row reads 'PH' + 'Poppy · Hartmann'
       concatenated. That is not a duplicate row and not the preview decorator's
       sr-only story-title banner leaking in; it is one button with an avatar in
       it. Pinned whole rather than sliced, so the initials stay in the diff. */
    await expect(options.map((option) => option.textContent?.trim())).toEqual([
      'PHPoppy · Hartmann',
      'PHPepper · Hartmann',
    ]);

    /* And the avatar does NOT tell the two apart: `getInitials` takes the first
       and last whitespace-separated token, the label ends in the owner's surname,
       so every companion belonging to one owner gets the same two letters. Both
       rows read 'PH'. The name is the only distinguishing mark on this list -
       worth knowing before leaning on the avatar in a denser layout. */
    await expect(options.map((option) => within(option).getByText('PH').textContent)).toEqual([
      'PH',
      'PH',
    ]);
    await expect(within(options[0]).getByText('Poppy · Hartmann')).toBeInTheDocument();
    await expect(within(options[1]).getByText('Pepper · Hartmann')).toBeInTheDocument();

    /* The initials block is `aria-hidden`, so a screen reader hears only the name
       and the concatenation above is a sighted-DOM fact, not an announced one. */
    await expect(within(options[0]).getByText('PH').closest('[aria-hidden="true"]')).not.toBeNull();

    // The field is in its open shape: the trigger loses its bottom border and radius so
    // it reads as one control with the list beneath it.
    const trigger = input.parentElement as HTMLElement;
    await expect(getComputedStyle(trigger).borderBottomWidth).toBe('0px');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing filters the loaded companions client-side on a plain substring match. The ' +
          'panel is positioned from the trigger rect in a layout effect, so it is applied ' +
          'before paint and lands flush under the field however the modal is scrolled.\n\n' +
          'Both rows here belong to the same owner, which is the case worth looking at: the ' +
          'initials avatar is derived from the first and last word of the label, and the label ' +
          'ends in the owner surname, so Poppy and Pepper get the same "PH" disc. The avatar ' +
          "reads as an identifier and is not one. A row's text content is the initials and the " +
          'name run together for the same reason, so query the label span, never the button.',
      },
    },
  },
};

export const CompanionSearchNoMatches: Story = {
  name: 'Companion search - no matches',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Patient');

    await userEvent.click(input);
    await userEvent.type(input, 'qqq');

    const panel = await findPortalPanel();
    // Wording is deliberately different from the empty-list case: "No matches found"
    // means the query excluded everything, "No options available" means nothing loaded.
    await expect(within(panel).getByText('No matches found')).toBeInTheDocument();
    await expect(within(panel).queryAllByRole('button')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same portal with an empty result. It is the state that follows a typo in a ' +
          'companion name, and the point of the story is that the two empty wordings are not ' +
          'interchangeable.',
      },
    },
  },
};

export const TimeSlotLoading: Story = {
  name: 'Time slots - loading row',
  args: {
    formState: {
      loadingTimeSlots: true,
      loadingSlotScopedOptions: false,
      serviceSelected: true,
      submitted: false,
      loading: false,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Time' });

    // The trigger itself already says Loading..., before the list is even opened.
    await expect(within(trigger).getByText('Loading...')).toBeInTheDocument();

    await userEvent.click(trigger);
    const panel = await findPortalPanel();
    await expect(within(panel).getByText('Loading slots…')).toBeInTheDocument();
    // The spinner row replaces the whole menu, so there is nothing to pick meanwhile.
    await expect(within(panel).queryAllByRole('button')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'While availability is in flight. Two different spinners are on screen at once - a ' +
          'small inline one in the trigger and the row inside the panel - and they are separate ' +
          'components, so they can drift apart.',
      },
    },
  },
};

export const TimeSlotOptions: Story = {
  name: 'Time slots - available slots',
  args: {
    timeSlots: TIME_SLOTS,
    selectedSlot: TIME_SLOTS[1],
    formState: {
      loadingTimeSlots: false,
      loadingSlotScopedOptions: false,
      serviceSelected: true,
      submitted: false,
      loading: false,
    },
    durationDisplay: '30 mins',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Slot labels are rendered in the preferred time zone (Europe/Berlin by default),
    // not the machine's, so 09:00 UTC reads as 10:00 AM everywhere this runs. The
    // separator between time and meridiem varies by ICU build, hence the \s? here.
    const trigger = canvas.getByRole('button', { name: /^Time, / });
    await userEvent.click(trigger);

    const panel = await findPortalPanel();
    const options = within(panel).getAllByRole('button');
    await expect(options).toHaveLength(3);
    await expect(options[0].textContent?.trim()).toMatch(/^10:00\s?AM$/);
    await expect(options[1].textContent?.trim()).toMatch(/^10:30\s?AM$/);
    await expect(options[2].textContent?.trim()).toMatch(/^11:00\s?AM$/);

    // The selected row is the only one on the blue wash - poll, because these rows
    // carry `transition-colors` and one synchronous read can catch a midpoint value.
    await waitFor(() => {
      expect(getComputedStyle(options[1]).backgroundColor).not.toBe(
        getComputedStyle(options[0]).backgroundColor
      );
    });

    // Slot duration is a sibling field, filled from the chosen slot rather than typed.
    await expect(canvas.getByText('30 mins')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The populated menu. Times come from the API as UTC clock strings and are rendered ' +
          "through the org's preferred time zone, so what a user reads here is not what the " +
          'payload contains - the reason a slot list is worth drawing rather than trusting.',
      },
    },
  },
};

export const TimeSlotBlocked: Story = {
  name: 'Time slots - upstream field missing',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Time' }));

    const panel = await findPortalPanel();
    // Not an error and not an empty list: the menu explains which field is blocking it.
    await expect(
      within(panel).getByText('Select a speciality and service first')
    ).toBeInTheDocument();
    await expect(within(panel).queryAllByRole('button')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opening Time before a service is chosen. The sentence is computed upstream by ' +
          '`getNoSlotsMessage`, which has three wordings for three stages of the form, and this ' +
          'menu is the only place any of them are shown.',
      },
    },
  },
};

export const RestingNarrow: Story = {
  name: 'Empty form at 375px',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Same two children, one track: the right column falls under the left rather than
    // the fields compressing. The default `laptop` global gives two tracks, so this is
    // the only story that proves the breakpoint is wired at all.
    const grid = getFieldGrid(canvasElement);
    await expect(trackCount(grid)).toBe(1);
    await expect(grid.children).toHaveLength(2);

    // Every field survives the collapse - the grid reflows, it does not drop controls.
    await expect(canvas.getByLabelText('Patient')).toHaveValue('');
    await expect(canvas.getByLabelText('Chief Complaint')).toHaveValue('');
    await expect(canvas.getByRole('button', { name: 'Speciality' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Book appointment' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The stacked form. `md:grid-cols-2` is the only thing separating this from the ' +
          'desktop layout, so the order a user reads the fields in changes completely below ' +
          '768px: Speciality and Service now sit under Lead rather than beside it, which puts ' +
          'the estimate at the very bottom of a long scroll instead of at eye level.',
      },
    },
  },
};
