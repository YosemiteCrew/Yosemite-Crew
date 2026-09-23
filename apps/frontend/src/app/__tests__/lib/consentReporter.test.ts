import {
  CONSENT_ID_KEY,
  CONSENT_ENDPOINT,
  getOrCreateConsentId,
  reportConsentDecision,
} from '@/app/lib/consentReporter';

const postDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  postData: (...args: unknown[]) => postDataMock(...args),
}));

describe('consentReporter', () => {
  beforeEach(() => {
    localStorage.clear();
    postDataMock.mockReset();
    postDataMock.mockResolvedValue({ data: { ok: true } });
  });

  describe('getOrCreateConsentId', () => {
    it('generates and persists an id on first call', () => {
      const id = getOrCreateConsentId();
      expect(id).toBeTruthy();
      expect(localStorage.getItem(CONSENT_ID_KEY)).toBe(id);
    });

    it('reuses the persisted id on later calls', () => {
      localStorage.setItem(CONSENT_ID_KEY, 'stable-id');
      expect(getOrCreateConsentId()).toBe('stable-id');
      expect(getOrCreateConsentId()).toBe('stable-id');
    });
  });

  describe('reportConsentDecision', () => {
    it('posts the stable consentId with the decision', async () => {
      localStorage.setItem(CONSENT_ID_KEY, 'subject-1');
      await reportConsentDecision(true);

      expect(postDataMock).toHaveBeenCalledWith(CONSENT_ENDPOINT, {
        consentId: 'subject-1',
        granted: true,
      });
    });

    it('does not regenerate the consentId when reporting', async () => {
      await reportConsentDecision(false);
      const firstId = localStorage.getItem(CONSENT_ID_KEY);

      await reportConsentDecision(true);
      expect(localStorage.getItem(CONSENT_ID_KEY)).toBe(firstId);
      expect(postDataMock).toHaveBeenCalledTimes(2);
    });

    it('resolves without throwing when the relay is unreachable', async () => {
      postDataMock.mockRejectedValueOnce(new Error('network down'));
      await expect(reportConsentDecision(true)).resolves.toBeUndefined();
    });
  });
});
