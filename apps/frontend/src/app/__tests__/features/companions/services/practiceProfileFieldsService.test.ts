import {
  createPracticeProfileField,
  deactivatePracticeProfileField,
  getPracticeProfileFields,
  savePracticeProfileFieldValues,
} from '@/app/features/companions/services/practiceProfileFieldsService';
import { deleteData, getData, postData, putData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  putData: jest.fn(),
  deleteData: jest.fn(),
}));

const mockedGetData = jest.mocked(getData);
const mockedPostData = jest.mocked(postData);
const mockedPutData = jest.mocked(putData);
const mockedDeleteData = jest.mocked(deleteData);

describe('practice profile field service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads fields for the selected patient', async () => {
    const fields = [{ id: 'field-1', label: 'Coat color' }];
    mockedGetData.mockResolvedValue({ data: fields } as never);

    await expect(getPracticeProfileFields('PATIENT', 'patient/1')).resolves.toEqual(fields);
    expect(mockedGetData).toHaveBeenCalledWith(
      '/fhir/v1/companion/org/profile-fields/PATIENT/patient%2F1'
    );
  });

  it('creates a practice field definition', async () => {
    const field = { id: 'field-1', label: 'Coat color' };
    const input = { label: 'Coat color', type: 'TEXT' as const, options: [] };
    mockedPostData.mockResolvedValue({ data: field } as never);

    await expect(createPracticeProfileField('PATIENT', input)).resolves.toEqual(field);
    expect(mockedPostData).toHaveBeenCalledWith(
      '/fhir/v1/companion/org/profile-fields/PATIENT',
      input
    );
  });

  it('saves values for the selected client', async () => {
    const values = [{ fieldId: 'field-1', value: 'Blue' }];
    mockedPutData.mockResolvedValue({ status: 204 } as never);

    await savePracticeProfileFieldValues('CLIENT', 'client/1', values);
    expect(mockedPutData).toHaveBeenCalledWith(
      '/fhir/v1/companion/org/profile-fields/CLIENT/client%2F1/values',
      { values }
    );
  });

  it('deactivates a field definition', async () => {
    mockedDeleteData.mockResolvedValue({ status: 204 } as never);

    await deactivatePracticeProfileField('field/1');
    expect(mockedDeleteData).toHaveBeenCalledWith(
      '/fhir/v1/companion/org/profile-fields/fields/field%2F1'
    );
  });
});
