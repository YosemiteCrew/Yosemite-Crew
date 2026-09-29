import {
  cancelFormAssignment,
  createAppointmentFormAssignment,
  listAppointmentFormAssignments,
  listCompanionFormAssignments,
  resendFormAssignment,
  sendFormToParent,
} from '@/app/features/forms/services/formAssignmentService';
import { linkAppointmentForms } from '@/app/features/forms/services/appointmentFormsService';
import { getData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

jest.mock('@/app/features/forms/services/appointmentFormsService', () => ({
  linkAppointmentForms: jest.fn(),
}));

describe('formAssignmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getData as jest.Mock).mockResolvedValue({ data: [{ id: 'assignment-1' }] });
    (postData as jest.Mock).mockResolvedValue({ data: { id: 'assignment-1' } });
  });

  it('wraps appointment and companion assignment routes', async () => {
    await createAppointmentFormAssignment('org-1', 'appt-1', { templateId: 'tpl-1' });
    await listAppointmentFormAssignments('org-1', 'appt-1');
    await listCompanionFormAssignments('org-1', 'comp-1');

    expect(postData).toHaveBeenCalledWith(
      '/v1/forms/organisations/org-1/appointments/appt-1/assignments',
      { templateId: 'tpl-1' }
    );
    expect(getData).toHaveBeenNthCalledWith(
      1,
      '/v1/forms/organisations/org-1/appointments/appt-1/assignments'
    );
    expect(getData).toHaveBeenNthCalledWith(
      2,
      '/v1/forms/organisations/org-1/companions/comp-1/assignments'
    );
  });

  // A template reaches the pet parent as a request to fill it in and sign it;
  // a form as a link on the appointment.
  it('sends a template to the pet parent as a request', async () => {
    await expect(
      sendFormToParent('org-1', 'appt-1', {
        id: 'tpl-consent',
        templateId: 'tpl-consent-root',
        isTemplateBacked: true,
      })
    ).resolves.toEqual({ id: 'assignment-1' });

    expect(postData).toHaveBeenCalledWith(
      '/v1/forms/organisations/org-1/appointments/appt-1/assignments',
      { templateId: 'tpl-consent-root' }
    );
    expect(linkAppointmentForms).not.toHaveBeenCalled();
  });

  it('sends a template with no template id under its own id', async () => {
    await sendFormToParent('org-1', 'appt-1', { id: 'tpl-consent', isTemplateBacked: true });

    expect(postData).toHaveBeenCalledWith(
      '/v1/forms/organisations/org-1/appointments/appt-1/assignments',
      { templateId: 'tpl-consent' }
    );
  });

  it('links a form to the appointment', async () => {
    await expect(sendFormToParent('org-1', 'appt-1', { id: 'form-1' })).resolves.toBeUndefined();

    expect(linkAppointmentForms).toHaveBeenCalledWith({
      organisationId: 'org-1',
      appointmentId: 'appt-1',
      formIds: ['form-1'],
    });
    expect(postData).not.toHaveBeenCalled();
  });

  it('wraps assignment resend and cancel actions', async () => {
    await resendFormAssignment('org-1', 'assignment-1');
    await cancelFormAssignment('org-1', 'assignment-1');

    expect(postData).toHaveBeenNthCalledWith(
      1,
      '/v1/forms/organisations/org-1/assignments/assignment-1/$resend'
    );
    expect(postData).toHaveBeenNthCalledWith(
      2,
      '/v1/forms/organisations/org-1/assignments/assignment-1/$cancel'
    );
  });
});
