import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BookDemo from '@/app/features/marketing/pages/BookDemo/BookDemo';
import { getCalApi } from '@calcom/embed-react';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamicCal = ({ calLink, ...restProps }: any) => (
      <div data-testid="mock-cal" data-cal-link={calLink} {...restProps} />
    );
    MockDynamicCal.displayName = 'MockDynamicCal';
    return MockDynamicCal;
  },
}));

jest.mock('@calcom/embed-react', () => {
  const mockGetCalApi = jest.fn();

  return {
    __esModule: true,
    getCalApi: mockGetCalApi,
    default: () => null,
  };
});

const mockedGetCalApi = getCalApi as jest.Mock;

describe('BookDemo Page', () => {
  beforeEach(() => {
    const mockCalApiFunction = jest.fn();
    mockedGetCalApi.mockResolvedValue(mockCalApiFunction);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the mock Cal component with correct props', () => {
    render(<BookDemo />);

    expect(screen.getByRole('heading', { level: 1, name: 'Book a demo' })).toBeInTheDocument();
    const calComponent = screen.getByTestId('mock-cal');
    expect(calComponent).toBeInTheDocument();
  });

  it('should call getCalApi and configure the UI inside useEffect', async () => {
    render(<BookDemo />);

    await waitFor(() => {
      expect(mockedGetCalApi).toHaveBeenCalledWith({ namespace: '30min' });
    });

    const calApiFunction = await mockedGetCalApi.mock.results[0].value;

    expect(calApiFunction).toHaveBeenCalledWith('ui', {
      hideEventTypeDetails: false,
      layout: 'month_view',
    });
  });
});
