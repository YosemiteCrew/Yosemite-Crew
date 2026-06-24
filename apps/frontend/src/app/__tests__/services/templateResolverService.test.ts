import { resolveTemplate } from '@/app/features/forms/services/templateResolverService';
import { getData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
}));

describe('templateResolverService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the backend-owned template resolver with context params', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { templateId: 'tpl-1' } });

    const result = await resolveTemplate({
      organisationId: 'org-1',
      kind: 'SOAP_NOTE',
      appointmentId: 'appt-1',
      serviceId: 'svc-1',
      species: 'CANINE',
      mode: 'OUTPATIENT',
    });

    expect(getData).toHaveBeenCalledWith('/v1/templates/pms/resolve', {
      organisationId: 'org-1',
      kind: 'SOAP_NOTE',
      appointmentId: 'appt-1',
      serviceId: 'svc-1',
      species: 'CANINE',
      mode: 'OUTPATIENT',
    });
    expect(result).toEqual({ templateId: 'tpl-1' });
  });
});
