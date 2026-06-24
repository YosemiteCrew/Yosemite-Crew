import {
  cancelFormAssignment,
  createAppointmentFormAssignment,
  listAppointmentFormAssignments,
  listCompanionFormAssignments,
  resendFormAssignment,
} from '@/app/features/forms/services/formAssignmentService';
import { getData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
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
