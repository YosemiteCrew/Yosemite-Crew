import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import { createEmptyFormData } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import type { FormsProps } from '@/app/features/forms/types/forms';
import { useFormsStore } from '@/app/stores/formsStore';
import { useOrgStore } from '@/app/stores/orgStore';

import Objective from './Objective';

const ORG_ID = 'org-storybook-objective';
const FORM_ID = 'form-clinical-examination';

/** The strings this wrapper hands `PrescriptionFormSection`, so the assertions read as the screen. */
const SECTION = {
  title: 'Objective (clinical examination)',
  submissionsTitle: 'Previous objective submissions',
  searchPlaceholder: 'Search',
};

const VETERINARIAN: UserOrganization = {
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const EXAM_FORM: FormsProps = {
  _id: FORM_ID,
  orgId: ORG_ID,
  name: 'Clinical examination',
  category: 'SOAP',
  usage: 'Internal',
  requiredSigner: 'VET',
  updatedBy: 'Dr. Amara Weber',
  lastUpdated: '2026-02-20T09:00:00.000Z',
  status: 'Published',
  schema: [
    {
      id: 'vitals',
      type: 'group',
      label: 'Vitals',
      fields: [
        { id: 'temperature_c', type: 'input', label: 'Temperature (C)' },
        { id: 'heart_rate', type: 'input', label: 'Heart rate (bpm)' },
        { id: 'respiratory_rate', type: 'input', label: 'Respiratory rate (rpm)' },
      ],
    },
    { id: 'body_condition', type: 'input', label: 'Body condition score' },
    { id: 'findings', type: 'textarea', label: 'Examination findings' },
  ],
};

const APPOINTMENT: Appointment = {
  id: 'appt-objective-1',
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
    formsById: { [FORM_ID]: EXAM_FORM },
    formIds: [FORM_ID],
  });

  return () => {
    useFormsStore.setState(formsSnapshot);
    useOrgStore.setState(orgSnapshot);
  };
};

const meta = {
  title: 'Appointments/Prescription/Objective',
  component: Objective,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Objective section of the appointment SOAP record: the clinical examination. A ' +
          'thin wrapper over `PrescriptionFormSection` with the "Objective (clinical ' +
          'examination)" title, the `SOAP` category and the `formData.objective` key.\n\n' +
          'The seeded form carries a nested Vitals group, because that is the shape an ' +
          'examination form actually takes and the one a renderer that fails to recurse into ' +
          'groups would silently flatten. Picking it draws all five fields read-only; a locked ' +
          'appointment keeps only the submissions history.',
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
} satisfies Meta<typeof Objective>;

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
  name: 'Examination form picked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('textbox', { name: SECTION.searchPlaceholder }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Clinical examination' }));

    // The group is drawn with its heading and every nested field, all read-only.
    await expect(await canvas.findByText('Vitals')).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Temperature (C)' })).toHaveAttribute(
      'readonly'
    );
    await expect(canvas.getByRole('textbox', { name: 'Heart rate (bpm)' })).toHaveAttribute(
      'readonly'
    );
    await expect(canvas.getByRole('textbox', { name: 'Examination findings' })).toHaveAttribute(
      'readonly'
    );
    /* Six textboxes: the picker plus five schema fields. Counting is what catches a
       group that failed to recurse - three of the five live inside `vitals`. */
    await expect(canvas.getAllByRole('textbox')).toHaveLength(6);
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
