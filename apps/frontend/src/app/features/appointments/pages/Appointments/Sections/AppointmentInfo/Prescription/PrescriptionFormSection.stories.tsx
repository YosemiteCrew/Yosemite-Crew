import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { Appointment, UserOrganization } from '@yosemite-crew/types';
import { createEmptyFormData } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import type { FormsProps } from '@/app/features/forms/types/forms';
import { useFormsStore } from '@/app/stores/formsStore';
import { useOrgStore } from '@/app/stores/orgStore';

import PrescriptionFormSection from './PrescriptionFormSection';

const ORG_ID = 'org-storybook';
const VET_FORM_ID = 'form-soap-assessment';
const CLIENT_FORM_ID = 'form-sedation-consent';

/** The Assessment caller's strings, so the story reads as the screen it ships in. */
const SECTION = {
  title: 'Assessment (diagnosis)',
  submissionsTitle: 'Previous assessment submissions',
  searchPlaceholder: 'Search',
};

/**
 * A veterinarian membership. `usePermissions` derives the effective set from
 * `roleCode` against the role table, so seeding the role is enough - there is no
 * permission list to keep in step. Without it the whole section renders as the
 * `Fallback` notice and every assertion below fails on an empty canvas.
 */
const VETERINARIAN: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const VET_FORM: FormsProps = {
  _id: VET_FORM_ID,
  orgId: ORG_ID,
  name: 'SOAP assessment',
  category: 'SOAP',
  usage: 'Internal',
  requiredSigner: 'VET',
  updatedBy: 'Dr. Weber',
  lastUpdated: '2026-05-04T09:00:00.000Z',
  status: 'Published',
  schema: [
    { id: 'presenting_complaint', type: 'input', label: 'Presenting complaint' },
    {
      id: 'vitals_group',
      type: 'group',
      label: 'Vitals',
      fields: [
        { id: 'temperature_c', type: 'input', label: 'Temperature (C)' },
        { id: 'weight_kg', type: 'input', label: 'Weight (kg)' },
      ],
    },
  ],
};

const CLIENT_FORM: FormsProps = {
  _id: CLIENT_FORM_ID,
  orgId: ORG_ID,
  name: 'Sedation consent',
  category: 'SOAP',
  usage: 'External',
  requiredSigner: 'CLIENT',
  updatedBy: 'Dr. Weber',
  lastUpdated: '2026-05-02T08:30:00.000Z',
  status: 'Published',
  schema: [{ id: 'owner_consent', type: 'textarea', label: 'Consent statement' }],
};

const APPOINTMENT: Appointment = {
  id: 'appt-storybook-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  companion: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'vet-1', name: 'Dr. Weber' },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

/**
 * Only the "Sending" story needs this: the label exists solely while
 * `linkAppointmentForms` is in flight, which is a few frames against a real API.
 * Axios uses the XHR adapter in a browser, so holding `send` freezes the request
 * without touching the service module - the component, the store and the service
 * are all the real ones, and no request leaves the preview iframe.
 */
const REAL_XHR_SEND = XMLHttpRequest.prototype.send;

const stallTransport = () => {
  XMLHttpRequest.prototype.send = function stalledSend() {
    return undefined;
  };
  // Restored to the module-level original, so a meta-level and a story-level
  // cleanup cannot strand the stub whichever order they run in.
  return () => {
    XMLHttpRequest.prototype.send = REAL_XHR_SEND;
  };
};

const seed = (options: { stalled?: boolean } = {}) => {
  const orgSnapshot = useOrgStore.getState();
  const formsSnapshot = useFormsStore.getState();
  const restoreTransport = options.stalled ? stallTransport() : undefined;

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: VETERINARIAN },
    status: 'loaded',
  });
  // `useFormsForPrimaryOrgByCategory` filters on orgId AND category, so both
  // forms have to carry this org and the SOAP category to reach the picker.
  useFormsStore.setState({
    formsById: { [VET_FORM_ID]: VET_FORM, [CLIENT_FORM_ID]: CLIENT_FORM },
    formIds: [VET_FORM_ID, CLIENT_FORM_ID],
  });

  return () => {
    restoreTransport?.();
    useFormsStore.setState(formsSnapshot);
    useOrgStore.setState(orgSnapshot);
  };
};

const setFormData = fn();

/**
 * PrescriptionFormSection is generic over the SOAP key and takes the whole
 * `formData` bag plus its dispatch. This pins it to the Assessment caller so the
 * stories vary only what the surface actually depends on: whether the section is
 * editable. Everything rendered below is the real component.
 */
const AssessmentSection = ({ canEdit }: { canEdit: boolean }) => (
  <PrescriptionFormSection
    title={SECTION.title}
    submissionsTitle={SECTION.submissionsTitle}
    searchPlaceholder={SECTION.searchPlaceholder}
    category="SOAP"
    formDataKey="assessment"
    formData={createEmptyFormData()}
    setFormData={setFormData}
    activeAppointment={APPOINTMENT}
    canEdit={canEdit}
  />
);

const pickForm = async (canvas: ReturnType<typeof within>, name: string) => {
  await userEvent.click(canvas.getByRole('textbox', { name: SECTION.searchPlaceholder }));
  await userEvent.click(await canvas.findByRole('button', { name }));
};

const meta = {
  title: 'Appointments/PrescriptionFormSection',
  component: AssessmentSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The body of every SOAP section - Subjective, Objective, Assessment, Plan and Discharge ' +
          'all render this one component with different strings and a different form category. ' +
          'At rest it is a search box and a collapsed history list, and that resting state is all ' +
          'a snapshot ever showed: **picking a form is what draws the section**, and nothing had ' +
          'ever picked one.\n\n' +
          'Selecting an entry sets the active form, seeds the answer map from the schema defaults ' +
          'and renders the whole form through `FormRenderer` in `readOnly` mode - the section ' +
          'shows what will be submitted, it is not where a vet types. Only then does the footer ' +
          'CTA exist at all.\n\n' +
          'That CTA is two different actions wearing one button. `requiredSigner: VET` gives ' +
          '**Save**, which posts a submission straight into the record. `requiredSigner: CLIENT` ' +
          'gives **Send to parent**, which cannot save anything - a client-signed form has to go ' +
          'out for signature, so it links the form to the appointment instead and reads ' +
          '**Sending** while that request is in flight. Same button, same position, opposite ' +
          'meaning, and the only thing that tells them apart is the label.\n\n' +
          'The picker runs with `minChars={0}` rather than the SearchDropdown default of 2, so ' +
          'the full list opens on focus instead of waiting for two characters - these lists are ' +
          'short and a vet should not have to guess a form name.\n\n' +
          'The CTA is a sibling of the accordion, not part of it, so it stays pinned under a ' +
          'section whose body scrolls. The history list nested inside has its own stories under ' +
          'Appointments/SoapSubmissions.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    canEdit: true,
  },
  beforeEach: () => seed(),
} satisfies Meta<typeof AssessmentSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AtRest: Story = {
  name: 'Nothing picked yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The section itself is open by default; the history under it is not.
    await expect(canvas.getByRole('button', { name: SECTION.title })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(canvas.getByRole('button', { name: SECTION.submissionsTitle })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // One textbox: the picker. No form is rendered, so no field exists yet.
    await expect(canvas.getAllByRole('textbox')).toHaveLength(1);
    await expect(canvas.getByRole('textbox', { name: SECTION.searchPlaceholder })).toHaveValue('');
    /* Two buttons, both accordion toggles. There is no third: the CTA is not
       rendered disabled while nothing is picked, it does not exist, and only a
       count says so. */
    await expect(
      canvas.getAllByRole('button').map((item) => item.getAttribute('aria-label'))
    ).toEqual([SECTION.title, SECTION.submissionsTitle]);
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Send to parent' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'How the section mounts. There is no CTA at all until a form is chosen, which is why ' +
          'the footer looks empty rather than showing a disabled button.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (canEdit false)',
  args: { canEdit: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `canEdit` drops the picker, the rendered form AND the CTA - it is not a
       disabled state, the controls are absent. The history list stays, so a
       locked appointment can still be read back. */
    await expect(
      canvas.queryByRole('textbox', { name: SECTION.searchPlaceholder })
    ).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('textbox')).toHaveLength(0);

    /* Two controls in the entire section and nothing else: the section toggle
       and the history toggle. Counting them is what proves the CTA is gone
       rather than merely renamed - a disabled Save would still be a button
       here, and three named absences cannot rule that out. */
    await expect(
      canvas.getAllByRole('button').map((item) => item.getAttribute('aria-label'))
    ).toEqual([SECTION.title, SECTION.submissionsTitle]);
    // The section frame keeps its shape: still open, with the history inside it.
    await expect(canvas.getByRole('button', { name: SECTION.title })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(canvas.getByRole('button', { name: SECTION.submissionsTitle })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a completed or locked appointment shows. Only the accordion frame and the ' +
          'submissions history survive, so the section keeps its shape instead of collapsing to a ' +
          'bare title.',
      },
    },
  },
};

export const VetFormSelected: Story = {
  name: 'Form picked: Save',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('textbox', { name: SECTION.searchPlaceholder }));
    // Both published SOAP forms for this org, listed on focus with an empty query.
    expect(await canvas.findByRole('button', { name: 'SOAP assessment' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Sedation consent' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'SOAP assessment' }));

    // The schema is drawn in full, nested group included.
    expect(await canvas.findByText('Vitals')).toBeInTheDocument();
    const complaint = await canvas.findByRole('textbox', { name: 'Presenting complaint' });
    await expect(complaint).toHaveAttribute('readonly');
    await expect(canvas.getByRole('textbox', { name: 'Temperature (C)' })).toHaveAttribute(
      'readonly'
    );
    await expect(canvas.getByRole('textbox', { name: 'Weight (kg)' })).toHaveAttribute('readonly');
    /* Four, not three: the picker stays mounted above the rendered form, so a
       second form can be chosen without clearing the first. Counting the fields
       is what catches a group that failed to recurse - two of these three are
       inside `vitals_group`. */
    await expect(canvas.getAllByRole('textbox')).toHaveLength(4);

    const save = canvas.getByRole('button', { name: 'Save' });
    await expect(save).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Send to parent' })).not.toBeInTheDocument();

    /* The CTA is a sibling of the accordion, not a child of it. That is what keeps
       it pinned to the bottom of the section while the accordion body scrolls -
       move it inside and it scrolls away with the form. */
    const accordion = canvas
      .getByRole('button', { name: SECTION.title })
      .closest('div.flex.flex-col.w-full');
    await expect(accordion).not.toBeNull();
    await expect(accordion?.contains(save)).toBe(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A vet-signed form, rendered read-only under the picker. Every input is `readonly` ' +
          'rather than `disabled`, so the values stay full-contrast and selectable instead of ' +
          'greying out - this is a preview of a submission, not a dead form.',
      },
    },
  },
};

export const ClientFormSelected: Story = {
  name: 'Form picked: Send to parent',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await pickForm(canvas, 'Sedation consent');

    /* Same button, same place, different action. The vet cannot sign a
       client-signed form, so Save is not offered in a disabled state - it is
       replaced. Asserting the CTA's own text, not just that a button with that
       accessible name exists, because the label IS the whole difference between
       the two actions. */
    const cta = await canvas.findByRole('button', { name: 'Send to parent' });
    await expect(cta).toHaveTextContent('Send to parent');
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    /* Two textboxes: the picker, which stays mounted, and the consent field.
       The consent form is a single `textarea`, so a count of two also proves
       the picker did not clear itself on selection. */
    await expect(canvas.getAllByRole('textbox')).toHaveLength(2);
    await expect(canvas.getByRole('textbox', { name: 'Consent statement' }).tagName).toBe(
      'TEXTAREA'
    );
    await expect(canvas.getByText('Consent statement')).toBeInTheDocument();

    // The option list closed on selection rather than staying over the form.
    await expect(canvas.queryByRole('button', { name: 'SOAP assessment' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Picked out of the same list as the story above - the only difference is which ' +
          '`requiredSigner` the form carries. Nothing else on the surface says which kind of form ' +
          'this is, which is the argument for drawing both.',
      },
    },
  },
};

export const SendingToParent: Story = {
  name: 'Sending to the pet parent',
  beforeEach: () => seed({ stalled: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await pickForm(canvas, 'Sedation consent');
    await userEvent.click(await canvas.findByRole('button', { name: 'Send to parent' }));

    // Held open by stalling the request, because this label lives only for the
    // duration of the call.
    const cta = await canvas.findByRole('button', { name: 'Sending' });
    await expect(cta).toHaveTextContent('Sending');
    await expect(canvas.queryByRole('button', { name: 'Send to parent' })).not.toBeInTheDocument();

    /* The claim this story exists to show: the label changes but nothing is
       locked. `PrescriptionFormSection` never passes `isDisabled`, so the
       control stays live and a second click re-enters `handleSendToParent`
       while the first POST is still open. Compare the Assign room dialog, which
       disables both actions for exactly this window. */
    await expect(cta).toBeEnabled();
    await expect(cta).not.toHaveAttribute('aria-disabled', 'true');

    // The form stays rendered underneath, so the vet can still see what went out.
    await expect(canvas.getByText('Consent statement')).toBeInTheDocument();
    await expect(canvas.getAllByRole('textbox')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Worth looking at closely: the button relabels but is never disabled, so a second click ' +
          'lands on a live control while the first request is still open. Compare with the Assign ' +
          'room dialog, which disables both of its actions for exactly this window.',
      },
    },
  },
};
