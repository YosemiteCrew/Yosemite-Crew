import { getData, postData } from '@/app/services/axios';
import {
  dismissPossibleDuplicate,
  loadPossibleDuplicates,
} from '@/app/features/companions/services/patientDuplicateReviewService';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

const mockGetData = getData as jest.MockedFunction<typeof getData>;
const mockPostData = postData as jest.MockedFunction<typeof postData>;

describe('patientDuplicateReviewService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads possible duplicate pairs for the selected clinic', async () => {
    const matches = [
      {
        patientA: { id: 'patient-a', name: 'Poppy', dateOfBirth: '2020-01-02' },
        patientB: { id: 'patient-b', name: 'Poppy', dateOfBirth: '2020-01-02' },
        matchingOn: 'name-and-birth-date' as const,
      },
    ];
    mockGetData.mockResolvedValue({ data: { matches } } as never);

    await expect(loadPossibleDuplicates('practice/1')).resolves.toEqual(matches);
    expect(mockGetData).toHaveBeenCalledWith(
      '/fhir/v1/companion/org/practice%2F1/possible-duplicates'
    );
  });

  it('dismisses a selected patient pair', async () => {
    mockPostData.mockResolvedValue({} as never);

    await dismissPossibleDuplicate('practice/1', 'patient/a', 'patient/b');

    expect(mockPostData).toHaveBeenCalledWith(
      '/fhir/v1/companion/org/practice%2F1/possible-duplicates/patient%2Fa/patient%2Fb/dismiss'
    );
  });
});
