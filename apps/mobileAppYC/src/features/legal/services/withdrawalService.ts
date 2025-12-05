import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {ensureAccessContext, toErrorMessage} from '@/shared/utils/serviceHelpers';

export type WithdrawalRequestPayload = {
  fullName: string;
  email: string;
  address: string;
  signatureText: string;
  message: string;
  checkboxConfirmed: boolean;
};

export const withdrawalService = {
  async submitWithdrawal(payload: WithdrawalRequestPayload) {
    try {
      const {accessToken, userId} = await ensureAccessContext();
      const headers = withAuthHeaders(
        accessToken,
        userId ? {'x-user-id': userId} : undefined,
      );

      const {data} = await apiClient.post(
        '/v1/account-withdrawal/withdraw',
        payload,
        {headers},
      );

      return data;
    } catch (error) {
      throw new Error(
        toErrorMessage(error, 'Unable to submit withdrawal request. Please try again.'),
      );
    }
  },
};

export default withdrawalService;
