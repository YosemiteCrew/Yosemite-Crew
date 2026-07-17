import {
  getDiscountSettingsErrorMessage,
  getOrganisationDiscountSettings,
  updateOrganisationDiscountSettings,
} from '@/app/features/finance/services/discountSettingsService';
import { getData, putData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  putData: jest.fn(),
}));

const mockGetData = getData as jest.Mock;
const mockPutData = putData as jest.Mock;

const DISCOUNT_SETTINGS_PATH = '/v1/finance/organisation/org-1/discount-settings';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getOrganisationDiscountSettings', () => {
  it('reads the cap from the finance envelope', async () => {
    mockGetData.mockResolvedValue({
      data: {
        data: { organisationId: 'org-1', maxOverallDiscountPercent: 20 },
        meta: null,
        error: null,
      },
    });

    const settings = await getOrganisationDiscountSettings('org-1');

    expect(mockGetData).toHaveBeenCalledWith(DISCOUNT_SETTINGS_PATH);
    expect(settings).toEqual({ organisationId: 'org-1', maxOverallDiscountPercent: 20 });
  });

  it('reads an unwrapped body too', async () => {
    mockGetData.mockResolvedValue({
      data: { organisationId: 'org-1', maxOverallDiscountPercent: 35 },
    });

    await expect(getOrganisationDiscountSettings('org-1')).resolves.toEqual({
      organisationId: 'org-1',
      maxOverallDiscountPercent: 35,
    });
  });

  it('treats a null cap as "no cap configured", not zero', async () => {
    mockGetData.mockResolvedValue({
      data: { data: { organisationId: 'org-1', maxOverallDiscountPercent: null }, error: null },
    });

    const settings = await getOrganisationDiscountSettings('org-1');

    expect(settings.maxOverallDiscountPercent).toBeNull();
  });

  it('keeps a configured cap of 0 as 0 rather than collapsing it to null', async () => {
    mockGetData.mockResolvedValue({
      data: { data: { organisationId: 'org-1', maxOverallDiscountPercent: 0 }, error: null },
    });

    const settings = await getOrganisationDiscountSettings('org-1');

    expect(settings.maxOverallDiscountPercent).toBe(0);
  });

  it('falls back to the requested org id when the body omits it', async () => {
    mockGetData.mockResolvedValue({ data: { maxOverallDiscountPercent: 10 } });

    await expect(getOrganisationDiscountSettings('org-1')).resolves.toEqual({
      organisationId: 'org-1',
      maxOverallDiscountPercent: 10,
    });
  });

  it('throws the envelope error message', async () => {
    mockGetData.mockResolvedValue({
      data: { data: null, meta: null, error: { message: 'Organisation not found.' } },
    });

    await expect(getOrganisationDiscountSettings('org-1')).rejects.toThrow(
      'Organisation not found.'
    );
  });

  it('throws when the organisation id is missing', async () => {
    await expect(getOrganisationDiscountSettings('')).rejects.toThrow('Organisation ID missing');
    expect(mockGetData).not.toHaveBeenCalled();
  });

  it('propagates a transport failure', async () => {
    mockGetData.mockRejectedValue(new Error('network down'));

    await expect(getOrganisationDiscountSettings('org-1')).rejects.toThrow('network down');
  });
});

describe('updateOrganisationDiscountSettings', () => {
  it('PUTs the cap and returns the saved settings', async () => {
    mockPutData.mockResolvedValue({
      data: {
        data: { organisationId: 'org-1', maxOverallDiscountPercent: 15 },
        meta: null,
        error: null,
      },
    });

    const settings = await updateOrganisationDiscountSettings('org-1', {
      maxOverallDiscountPercent: 15,
    });

    expect(mockPutData).toHaveBeenCalledWith(DISCOUNT_SETTINGS_PATH, {
      maxOverallDiscountPercent: 15,
    });
    expect(settings).toEqual({ organisationId: 'org-1', maxOverallDiscountPercent: 15 });
  });

  it('clears the cap by sending null', async () => {
    mockPutData.mockResolvedValue({
      data: { data: { organisationId: 'org-1', maxOverallDiscountPercent: null }, error: null },
    });

    const settings = await updateOrganisationDiscountSettings('org-1', {
      maxOverallDiscountPercent: null,
    });

    expect(mockPutData).toHaveBeenCalledWith(DISCOUNT_SETTINGS_PATH, {
      maxOverallDiscountPercent: null,
    });
    expect(settings.maxOverallDiscountPercent).toBeNull();
  });

  it('throws when the organisation id is missing', async () => {
    await expect(
      updateOrganisationDiscountSettings('', { maxOverallDiscountPercent: 10 })
    ).rejects.toThrow('Organisation ID missing');
    expect(mockPutData).not.toHaveBeenCalled();
  });

  it('propagates an API rejection', async () => {
    mockPutData.mockRejectedValue(new Error('Request failed with status code 400'));

    await expect(
      updateOrganisationDiscountSettings('org-1', { maxOverallDiscountPercent: 101 })
    ).rejects.toThrow('Request failed with status code 400');
  });
});

describe('getDiscountSettingsErrorMessage', () => {
  it('prefers the API response body message over the axios message', () => {
    const error = {
      message: 'Request failed with status code 409',
      response: {
        data: { message: 'Overall invoice discount of 40% exceeds the maximum of 20%.' },
      },
    };

    expect(getDiscountSettingsErrorMessage(error, 'fallback')).toBe(
      'Overall invoice discount of 40% exceeds the maximum of 20%.'
    );
  });

  it('reads a nested envelope error message', () => {
    const error = { response: { data: { error: { message: 'Invalid request body' } } } };

    expect(getDiscountSettingsErrorMessage(error, 'fallback')).toBe('Invalid request body');
  });

  it('falls back to the Error message when there is no response body', () => {
    expect(getDiscountSettingsErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('uses the fallback for a blank body message', () => {
    const error = { response: { data: { message: '   ' } } };

    expect(getDiscountSettingsErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('uses the fallback for a non-object error', () => {
    expect(getDiscountSettingsErrorMessage('nope', 'fallback')).toBe('fallback');
    expect(getDiscountSettingsErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('uses the fallback when the response data is not an object', () => {
    expect(getDiscountSettingsErrorMessage({ response: { data: 'oops' } }, 'fallback')).toBe(
      'fallback'
    );
  });
});
