import {
  dispensePrescription,
  reservePrescription,
  returnPrescriptionDispense,
  voidPrescriptionDispense,
} from '@/app/features/appointments/services/prescriptionWorkflowService';
import { postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  postData: jest.fn(),
}));

describe('prescriptionWorkflowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (postData as jest.Mock).mockResolvedValue({ data: { id: 'rx-1' } });
  });

  it('wraps prescription reserve, dispense, return, and void actions', async () => {
    await reservePrescription('org-1', 'rx-1', { batchId: 'batch-1' });
    await dispensePrescription('org-1', 'rx-1', { quantity: 1 });
    await returnPrescriptionDispense('org-1', 'rx-1', { reason: 'Returned' });
    await voidPrescriptionDispense('org-1', 'rx-1', { reason: 'Mistake' });

    expect(postData).toHaveBeenNthCalledWith(
      1,
      '/v1/prescriptions/organisations/org-1/rx-1/$reserve',
      { batchId: 'batch-1' }
    );
    expect(postData).toHaveBeenNthCalledWith(
      2,
      '/v1/prescriptions/organisations/org-1/rx-1/$dispense',
      { quantity: 1 }
    );
    expect(postData).toHaveBeenNthCalledWith(
      3,
      '/v1/prescriptions/organisations/org-1/rx-1/$return',
      { reason: 'Returned' }
    );
    expect(postData).toHaveBeenNthCalledWith(
      4,
      '/v1/prescriptions/organisations/org-1/rx-1/$void-dispense',
      { reason: 'Mistake' }
    );
  });
});
