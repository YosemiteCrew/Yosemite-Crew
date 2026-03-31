import { fetchCompanionHistory } from '@/app/features/companionHistory/services/companionHistoryService';

const getDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...args: any[]) => getDataMock(...args),
}));

describe('fetchCompanionHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches companion history with default params', async () => {
    const mockData = { entries: [], nextCursor: null };
    getDataMock.mockResolvedValue({ data: mockData });

    const result = await fetchCompanionHistory({
      organisationId: 'org-1',
      companionId: 'comp-1',
    });

    expect(getDataMock).toHaveBeenCalledWith(
      '/v1/companion-history/pms/organisation/org-1/companion/comp-1',
      { limit: 50 }
    );
    expect(result).toEqual(mockData);
  });

  it('passes cursor param when provided', async () => {
    getDataMock.mockResolvedValue({ data: { entries: [] } });

    await fetchCompanionHistory({
      organisationId: 'org-1',
      companionId: 'comp-1',
      cursor: 'cursor-abc',
    });

    expect(getDataMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cursor: 'cursor-abc' })
    );
  });

  it('does not include cursor in params when null', async () => {
    getDataMock.mockResolvedValue({ data: { entries: [] } });

    await fetchCompanionHistory({
      organisationId: 'org-1',
      companionId: 'comp-1',
      cursor: null,
    });

    const callArgs = getDataMock.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('cursor');
  });

  it('passes types as comma-separated string', async () => {
    getDataMock.mockResolvedValue({ data: { entries: [] } });

    await fetchCompanionHistory({
      organisationId: 'org-1',
      companionId: 'comp-1',
      types: ['APPOINTMENT', 'DOCUMENT'] as any,
    });

    const callArgs = getDataMock.mock.calls[0][1];
    expect(callArgs.types).toBe('APPOINTMENT,DOCUMENT');
  });

  it('does not pass types when empty array', async () => {
    getDataMock.mockResolvedValue({ data: { entries: [] } });

    await fetchCompanionHistory({
      organisationId: 'org-1',
      companionId: 'comp-1',
      types: [],
    });

    const callArgs = getDataMock.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('types');
  });

  it('uses custom limit', async () => {
    getDataMock.mockResolvedValue({ data: { entries: [] } });

    await fetchCompanionHistory({
      organisationId: 'org-1',
      companionId: 'comp-1',
      limit: 10,
    });

    expect(getDataMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 10 })
    );
  });

  it('throws when organisationId is missing', async () => {
    await expect(
      fetchCompanionHistory({ organisationId: '', companionId: 'comp-1' })
    ).rejects.toThrow('Organisation ID missing');
  });

  it('throws when companionId is missing', async () => {
    await expect(
      fetchCompanionHistory({ organisationId: 'org-1', companionId: '' })
    ).rejects.toThrow('Companion ID missing');
  });
});
