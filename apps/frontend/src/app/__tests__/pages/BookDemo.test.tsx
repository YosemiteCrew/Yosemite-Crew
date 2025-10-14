import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BookDemo from '../../pages/BookDemo/BookDemo';
import { getCalApi } from '@calcom/embed-react';

jest.mock('@calcom/embed-react', () => {
  const mockGetCalApi = jest.fn();
  const MockCal = ({ calLink, ...restProps }: any) => (
    <div data-testid="mock-cal" {...restProps} />
  );

  return {
    __esModule: true,
    getCalApi: mockGetCalApi,
    default: MockCal,
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