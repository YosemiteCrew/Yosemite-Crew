import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import { createEmptyFormData } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import type { FormsProps } from '@/app/features/forms/types/forms';
import { useFormsStore } from '@/app/stores/formsStore';
import { useOrgStore } from '@/app/stores/orgStore';

import Assessment from './Assessment';

const ORG_ID = 'org-storybook-assessment';
const FORM_ID = 'form-assessment-diagnosis';

/** The strings this wrapper hands `PrescriptionFormSection`, so the assertions read as the screen. */
const SECTION = {
  title: 'Assessment (diagnosis)',
  submissionsTitle: 'Previous assessment submissions',
  searchPlaceholder: 'Search',
};

/**
 * `usePermissions` derives the effective set from `roleCode`, so seeding the
 * role is the whole fixture. Without it the section renders the permission
 * notice instead of the picker.
 */
const VETERINARIAN: UserOrganization = {
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const ASSESSMENT_FORM: FormsProps = {
  _id: FORM_ID,
  orgId: ORG_ID,
  name: 'Diagnosis and problem list',
  category: 'SOAP',
  usage: 'Internal',
  requiredSigner: 'VET',
  updatedBy: 'Dr. Amara Weber',
  lastUpdated: '2026-02-20T09:00:00.000Z',
  status: 'Published',
  schema: [
    { id: 'primary_diagnosis', type: 'input', label: 'Primary diagnosis' },
    { id: 'differentials', type: 'textarea', label: 'Differential diagnoses' },
    { id: 'prognosis', type: 'input', label: 'Prognosis' },
  ],
};

const APPOINTMENT: Appointment = {
  id: 'appt-assessment-1',
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

/**
 * Seeds the org membership and the SOAP form the picker lists, and restores both.
 * `useFormsForPrimaryOrgByCategory` filters on orgId AND category, so the form
 * has to carry this org and the SOAP category to reach the dropdown.
 */
const seed = () => {
  const orgSnapshot = useOrgStore.getState();
  const formsSnapshot = useFormsStore.getState();

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: VETERINARIAN },
    status: 'loaded',
  });
  useFormsStore.setState({
    formsById: { [FORM_ID]: ASSESSMENT_FORM },
    formIds: [FORM_ID],
  });

  return () => {
    useFormsStore.setState(formsSnapshot);
    useOrgStore.setState(orgSnapshot);
  };
};

const meta = {
  title: 'Appointments/Prescription/Assessment',
  component: Assessment,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Assessment section of the appointment SOAP record. It is a thin wrapper: it ' +
          'hands `PrescriptionFormSection` the "Assessment (diagnosis)" title, the submissions ' +
          'heading and the `SOAP` form category, and stores whatever is saved under ' +
          '`formData.assessment`.\n\n' +
          "At rest it is a search box over the practice's published SOAP forms plus a collapsed " +
          'history of earlier submissions. Picking a form draws it read-only underneath the ' +
          'picker and adds the Save action; a locked appointment (`canEdit` false) drops the ' +
          'picker and the action and keeps only the history.\n\n' +
          'The stories seed the org membership and one published SOAP form, so the picker has ' +
          'something to list without a request leaving the browser.',
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
} satisfies Meta<typeof Assessment>;

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
    // No form picked, so there is no Save action at all - not a disabled one.
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  },
};

export const FormPicked: Story = {
  name: 'Diagnosis form picked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('textbox', { name: SECTION.searchPlaceholder }));
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Diagnosis and problem list' })
    );

    // The schema is drawn read-only: a preview of what will be submitted, not a form to type in.
    await expect(await canvas.findByRole('textbox', { name: 'Primary diagnosis' })).toHaveAttribute(
      'readonly'
    );
    await expect(canvas.getByRole('textbox', { name: 'Differential diagnoses' })).toHaveAttribute(
      'readonly'
    );
    await expect(canvas.getByRole('textbox', { name: 'Prognosis' })).toHaveAttribute('readonly');
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
    // The frame survives: section toggle and history toggle, nothing else.
    await expect(
      canvas.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    ).toEqual([SECTION.title, SECTION.submissionsTitle]);
  },
};
