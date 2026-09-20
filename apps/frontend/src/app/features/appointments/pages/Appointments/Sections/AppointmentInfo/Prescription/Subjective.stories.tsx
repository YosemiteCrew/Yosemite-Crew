import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import { createEmptyFormData } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import type { FormsProps } from '@/app/features/forms/types/forms';
import { useFormsStore } from '@/app/stores/formsStore';
import { useOrgStore } from '@/app/stores/orgStore';

import Subjective from './Subjective';

const ORG_ID = 'org-storybook-subjective';
const FORM_ID = 'form-history-intake';

/** The strings this wrapper hands `PrescriptionFormSection`, so the assertions read as the screen. */
const SECTION = {
  title: 'Subjective (history)',
  submissionsTitle: 'Previous subjective submissions',
  searchPlaceholder: 'Search',
};

const VETERINARIAN: UserOrganization = {
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const HISTORY_FORM: FormsProps = {
  _id: FORM_ID,
  orgId: ORG_ID,
  name: 'History intake',
  category: 'SOAP',
  usage: 'Internal',
  requiredSigner: 'VET',
  updatedBy: 'Dr. Amara Weber',
  lastUpdated: '2026-02-20T09:00:00.000Z',
  status: 'Published',
  schema: [
    { id: 'presenting_complaint', type: 'textarea', label: 'Presenting complaint' },
    { id: 'duration', type: 'input', label: 'Duration of signs' },
    { id: 'appetite', type: 'input', label: 'Appetite and thirst' },
    { id: 'current_medication', type: 'input', label: 'Current medication' },
  ],
};

const APPOINTMENT: Appointment = {
  id: 'appt-subjective-1',
  patient: {
    id: 'companion-poppy',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-lena', name: 'Lena Hartmann' },
  },
  lead: { id: 'vet-weber', name: 'Dr. Amara Weber' },
  organisationId: ORG_ID,
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

/** Seeds the membership and the SOAP form the picker lists, and restores both. */
const seed = () => {
  const orgSnapshot = useOrgStore.getState();
  const formsSnapshot = useFormsStore.getState();

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: VETERINARIAN },
    status: 'loaded',
  });
  useFormsStore.setState({
    formsById: { [FORM_ID]: HISTORY_FORM },
    formIds: [FORM_ID],
  });

  return () => {
    useFormsStore.setState(formsSnapshot);
    useOrgStore.setState(orgSnapshot);
  };
};

const meta = {
  title: 'Appointments/Prescription/Subjective',
  component: Subjective,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Subjective section of the appointment SOAP record: the owner-reported history. A ' +
          'thin wrapper over `PrescriptionFormSection` with the "Subjective (history)" title, ' +
          'the `SOAP` category and the `formData.subjective` key.\n\n' +
          'It is the first section a vet fills on a visit, so the seeded form is an intake: ' +
          'the presenting complaint as a textarea and three short answers. Picking it draws ' +
          'the fields read-only under the picker; a locked appointment keeps only the ' +
          'submissions history.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-[640px]">
        <Story />
      </div>
    ),
  ],
  args: {
    activeAppointment: APPOINTMENT,
    formData: createEmptyFormData(),
    setFormData: fn(),
    canEdit: true,
  },
  beforeEach: () => seed(),
} satisfies Meta<typeof Subjective>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AtRest: Story = {
  name: 'Nothing picked yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: SECTION.title })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(canvas.getByRole('button', { name: SECTION.submissionsTitle })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(canvas.getByRole('textbox', { name: SECTION.searchPlaceholder })).toHaveValue('');
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  },
};

export const FormPicked: Story = {
  name: 'History intake picked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('textbox', { name: SECTION.searchPlaceholder }));
    await userEvent.click(await canvas.findByRole('button', { name: 'History intake' }));

    const complaint = await canvas.findByRole('textbox', { name: 'Presenting complaint' });
    await expect(complaint.tagName).toBe('TEXTAREA');
    await expect(complaint).toHaveAttribute('readonly');
    await expect(canvas.getByRole('textbox', { name: 'Duration of signs' })).toHaveAttribute(
      'readonly'
    );
    await expect(canvas.getByRole('textbox', { name: 'Current medication' })).toHaveAttribute(
      'readonly'
    );
    // The picker stays mounted above the rendered form, so five textboxes, not four.
    await expect(canvas.getAllByRole('textbox')).toHaveLength(5);
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Locked appointment (canEdit false)',
  args: { canEdit: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.queryByRole('textbox', { name: SECTION.searchPlaceholder })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(
      canvas.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    ).toEqual([SECTION.title, SECTION.submissionsTitle]);
  },
};
