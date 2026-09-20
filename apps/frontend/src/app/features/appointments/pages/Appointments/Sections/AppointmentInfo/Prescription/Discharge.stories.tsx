import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import { createEmptyFormData } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import type { FormsProps } from '@/app/features/forms/types/forms';
import { useFormsStore } from '@/app/stores/formsStore';
import { useOrgStore } from '@/app/stores/orgStore';

import Discharge from './Discharge';

const ORG_ID = 'org-storybook-discharge';
const DISCHARGE_FORM_ID = 'form-discharge-instructions';
const SOAP_FORM_ID = 'form-soap-assessment';

/** The strings this wrapper hands `PrescriptionFormSection`, so the assertions read as the screen. */
const SECTION = {
  title: 'Discharge summary',
  submissionsTitle: 'Previous discharge submissions',
  searchPlaceholder: 'Search',
};

const VETERINARIAN: UserOrganization = {
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const DISCHARGE_FORM: FormsProps = {
  _id: DISCHARGE_FORM_ID,
  orgId: ORG_ID,
  name: 'Discharge instructions',
  category: 'Discharge Form',
  usage: 'Internal',
  requiredSigner: 'VET',
  updatedBy: 'Dr. Amara Weber',
  lastUpdated: '2026-02-20T09:00:00.000Z',
  status: 'Published',
  schema: [
    { id: 'home_care', type: 'textarea', label: 'Home care instructions' },
    { id: 'medications_dispensed', type: 'input', label: 'Medications dispensed' },
    { id: 'recheck_date', type: 'input', label: 'Recheck date' },
  ],
};

/**
 * A SOAP form in the same org. It exists to prove the category filter: this
 * section lists `Discharge Form` templates only, so the SOAP one must NOT be
 * offered here even though the store holds it.
 */
const SOAP_FORM: FormsProps = {
  _id: SOAP_FORM_ID,
  orgId: ORG_ID,
  name: 'SOAP assessment',
  category: 'SOAP',
  usage: 'Internal',
  requiredSigner: 'VET',
  updatedBy: 'Dr. Amara Weber',
  lastUpdated: '2026-02-20T09:00:00.000Z',
  status: 'Published',
  schema: [{ id: 'primary_diagnosis', type: 'input', label: 'Primary diagnosis' }],
};

const APPOINTMENT: Appointment = {
  id: 'appt-discharge-1',
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

/** Seeds the membership and both forms, and restores both stores. */
const seed = () => {
  const orgSnapshot = useOrgStore.getState();
  const formsSnapshot = useFormsStore.getState();

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: VETERINARIAN },
    status: 'loaded',
  });
  useFormsStore.setState({
    formsById: { [DISCHARGE_FORM_ID]: DISCHARGE_FORM, [SOAP_FORM_ID]: SOAP_FORM },
    formIds: [DISCHARGE_FORM_ID, SOAP_FORM_ID],
  });

  return () => {
    useFormsStore.setState(formsSnapshot);
    useOrgStore.setState(orgSnapshot);
  };
};

const meta = {
  title: 'Appointments/Prescription/Discharge',
  component: Discharge,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Discharge summary section of the appointment record. A thin wrapper over ' +
          '`PrescriptionFormSection` - but the one sibling that does not use the `SOAP` ' +
          'category: it lists `Discharge Form` templates, and stores what is saved under ' +
          '`formData.discharge`.\n\n' +
          'That category is the thing worth pinning. The forms store here holds a discharge ' +
          'template AND a SOAP template for the same organisation, and only the discharge one ' +
          'may reach the picker - a wrapper that fell back to `SOAP` would look identical at ' +
          'rest and offer the wrong templates on click.',
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
} satisfies Meta<typeof Discharge>;

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
  name: 'Discharge instructions picked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('textbox', { name: SECTION.searchPlaceholder }));
    // Only the discharge template is offered; the SOAP one in the same store is filtered out.
    await expect(
      await canvas.findByRole('button', { name: 'Discharge instructions' })
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'SOAP assessment' })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Discharge instructions' }));

    const homeCare = await canvas.findByRole('textbox', { name: 'Home care instructions' });
    await expect(homeCare.tagName).toBe('TEXTAREA');
    await expect(homeCare).toHaveAttribute('readonly');
    await expect(canvas.getByRole('textbox', { name: 'Medications dispensed' })).toHaveAttribute(
      'readonly'
    );
    await expect(canvas.getByRole('textbox', { name: 'Recheck date' })).toHaveAttribute('readonly');
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
