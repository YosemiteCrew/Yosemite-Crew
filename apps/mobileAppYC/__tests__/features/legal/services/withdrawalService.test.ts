import withdrawalService from '../../../../src/features/legal/services/withdrawalService';
import apiClient, {withAuthHeaders} from '../../../../src/shared/services/apiClient';
import {ensureAccessContext, toErrorMessage} from '../../../../src/shared/utils/serviceHelpers';

// --- Mocks ---

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  withAuthHeaders: jest.fn(),
}));

jest.mock('@/shared/utils/serviceHelpers', () => ({
  ensureAccessContext: jest.fn(),
  toErrorMessage: jest.fn(),
}));

describe('withdrawalService', () => {
  const mockPayload = {
    fullName: 'John Doe',
    email: 'john@example.com',
    address: '123 Main St',
    signatureText: 'John Doe',
    message: 'I want to withdraw.',
    checkboxConfirmed: true,
  };

  const mockAccessToken = 'mock-access-token';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Successful Submission ---

  it('submits withdrawal request successfully with user ID', async () => {
    // Setup Mocks
    (ensureAccessContext as jest.Mock).mockResolvedValue({
      accessToken: mockAccessToken,
      userId: mockUserId,
    });

    const mockHeaders = {Authorization: 'Bearer mock-token', 'x-user-id': mockUserId};
    (withAuthHeaders as jest.Mock).mockReturnValue(mockHeaders);

    const mockResponse = {success: true};
    (apiClient.post as jest.Mock).mockResolvedValue({data: mockResponse});

    // Execute
    const result = await withdrawalService.submitWithdrawal(mockPayload);

    // Verify
    expect(ensureAccessContext).toHaveBeenCalled();
    expect(withAuthHeaders).toHaveBeenCalledWith(
      mockAccessToken,
      {'x-user-id': mockUserId}
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      '/v1/account-withdrawal/withdraw',
      mockPayload,
      {headers: mockHeaders}
    );
    expect(result).toEqual(mockResponse);
  });

  it('submits withdrawal request successfully without user ID', async () => {
    // Setup Mocks: userId is undefined
    (ensureAccessContext as jest.Mock).mockResolvedValue({
      accessToken: mockAccessToken,
      userId: undefined,
    });

    const mockHeaders = {Authorization: 'Bearer mock-token'};
    (withAuthHeaders as jest.Mock).mockReturnValue(mockHeaders);
    (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

    // Execute
    await withdrawalService.submitWithdrawal(mockPayload);

    // Verify
    expect(withAuthHeaders).toHaveBeenCalledWith(
      mockAccessToken,
      undefined // userId header object is undefined
    );
  });

  // --- 2. Error Handling ---

  it('throws a formatted error when API call fails', async () => {
    const apiError = new Error('Network Error');
    const formattedErrorMsg = 'Custom error message from helper';

    // Setup Mocks
    (ensureAccessContext as jest.Mock).mockResolvedValue({accessToken: mockAccessToken});
    (apiClient.post as jest.Mock).mockRejectedValue(apiError);
    (toErrorMessage as jest.Mock).mockReturnValue(formattedErrorMsg);

    // Execute & Verify
    await expect(withdrawalService.submitWithdrawal(mockPayload))
      .rejects
      .toThrow(formattedErrorMsg);

    // Verify helpers called correctly
    expect(toErrorMessage).toHaveBeenCalledWith(
      apiError,
      'Unable to submit withdrawal request. Please try again.'
    );
  });
});