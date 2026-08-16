import { getIdexxTestSearchProps } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/idexxTestSearchProps';
import type { UseLabTestsReturn } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';

const buildLabTestsStub = (overrides: Record<string, unknown> = {}) => {
  const setSelectedTestLabel = jest.fn();
  const setQuery = jest.fn();
  const loadMoreTests = jest.fn();
  const test = { code: 'CBC01', display: 'Complete Blood Count' };
  const stub = {
    tests: [test],
    selectedTestLabel: '',
    query: 'blood',
    setSelectedTestLabel,
    setQuery,
    loadMoreTests,
    testsHasMore: true,
    testsLoadingMore: false,
    ...overrides,
  };
  return {
    s: stub as unknown as UseLabTestsReturn,
    test,
    setSelectedTestLabel,
    setQuery,
    loadMoreTests,
  };
};

describe('getIdexxTestSearchProps', () => {
  it('maps tests into SearchDropdown options with code, display label and meta', () => {
    const { s, test } = buildLabTestsStub();
    const props = getIdexxTestSearchProps(s);
    expect(props.options).toEqual([
      { value: 'CBC01', label: 'Complete Blood Count (CBC01)', meta: test },
    ]);
  });

  it('prefers the selected test label over the raw query', () => {
    const { s } = buildLabTestsStub({ selectedTestLabel: 'Complete Blood Count (CBC01)' });
    expect(getIdexxTestSearchProps(s).query).toBe('Complete Blood Count (CBC01)');
  });

  it('falls back to the raw query when no test label is selected', () => {
    const { s } = buildLabTestsStub();
    expect(getIdexxTestSearchProps(s).query).toBe('blood');
  });

  it('setQuery updates both the selected test label and the search query', () => {
    const { s, setSelectedTestLabel, setQuery } = buildLabTestsStub();
    getIdexxTestSearchProps(s).setQuery('lipase');
    expect(setSelectedTestLabel).toHaveBeenCalledWith('lipase');
    expect(setQuery).toHaveBeenCalledWith('lipase');
  });

  it('passes through pagination state and the shared option styling', () => {
    const { s, loadMoreTests } = buildLabTestsStub({ testsLoadingMore: true, testsHasMore: false });
    const props = getIdexxTestSearchProps(s);
    expect(props.minChars).toBe(0);
    expect(props.onReachEnd).toBe(loadMoreTests);
    expect(props.hasMore).toBe(false);
    expect(props.isLoadingMore).toBe(true);
    expect(props.optionClassName).toContain('border-card-border');
  });
});
