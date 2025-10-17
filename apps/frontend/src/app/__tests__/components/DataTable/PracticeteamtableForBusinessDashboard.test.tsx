import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PracticeteamtableForBusinessDashboard from '../../../components/DataTable/PracticeteamtableForBusinessDashboard';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

const mockGetData = jest.fn();
jest.mock('@/app/services/axios', () => ({
  getData: (url: string) => mockGetData(url),
}));

jest.mock('@yosemite-crew/fhir', () => ({
  PractitionerDatafromFHIR: (data: any) => data,
}));

jest.mock('@/app/stores/oldAuthStore', () => ({
  useOldAuthStore: (selector: (state: any) => any) => {
    const state = { userId: 'mock-user-id' };
    return selector(state);
  },
}));

const mockGenericTableProps: any = {};
jest.mock('@/app/components/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(mockGenericTableProps, props);
    return <div data-testid="mock-generic-table" />;
  },
}));

const mockPractitioners = [
    { cognitoId: '1', name: 'Dr. John Smith', departmentName: 'Cardiology', image: '/image1.png', status: 'Active', weekWorkingHours: 40 },
    { cognitoId: '2', name: 'Dr. Jane Doe', departmentName: 'Neurology', image: '', status: 'On Leave', weekWorkingHours: 0 },
];

const mockApiResponse = {
  status: 200,
  data: {
    data: mockPractitioners,
  },
};

describe('PracticeteamtableForBusinessDashboard Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetData.mockResolvedValue(mockApiResponse);
  });

  test('should fetch data on mount and pass correct props to GenericTable', async () => {
    render(<PracticeteamtableForBusinessDashboard departmentId="dept-1" role="all" />);

    await waitFor(() => {
      expect(mockGetData).toHaveBeenCalledWith('/fhir/v1/getpractionarList?userId=mock-user-id&departmentId=dept-1');
    });

    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();
  });

  test('should include role in the API call if not "all"', async () => {
    render(<PracticeteamtableForBusinessDashboard departmentId="dept-2" role="vet" />);

    await waitFor(() => {
      expect(mockGetData).toHaveBeenCalledWith('/fhir/v1/getpractionarList?userId=mock-user-id&departmentId=dept-2&role=vet');
    });
  });

  test('should handle API errors gracefully', async () => {
    mockGetData.mockRejectedValue(new Error('API Error'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<PracticeteamtableForBusinessDashboard departmentId="dept-1" role="all" />);

    await waitFor(() => {
      expect(mockGenericTableProps.data).toEqual([]);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching practitioners:", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  test('should render all column content correctly for 100% coverage', async () => {
    render(<PracticeteamtableForBusinessDashboard departmentId="dept-1" role="all" />);

    await waitFor(() => expect(mockGetData).toHaveBeenCalled());

    const { columns, data } = mockGenericTableProps;
    const itemWithImage = data[0];
    const itemWithoutImage = data[1];

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key)?.render;

    const imageRender = getColumnRender('image');
    const { getByAltText, rerender } = render(<>{imageRender(itemWithImage)}</>);
    expect(getByAltText('Dr. John Smith')).toHaveAttribute('src', '/image1.png');

    rerender(<>{imageRender(itemWithoutImage)}</>);
    expect(getByAltText('Dr. Jane Doe')).toHaveAttribute('src', 'https://d2il6osz49gpup.cloudfront.net/Images/default-avatar.png');

    const nameRender = getColumnRender('name');
    const { getByText } = render(<>{nameRender(itemWithImage)}</>);
    expect(getByText('Dr. John Smith')).toBeInTheDocument();
    expect(getByText('Cardiology')).toBeInTheDocument();

    const hoursRender = getColumnRender('weekWorkingHours');
    expect(render(<>{hoursRender(itemWithImage)}</>).getByText('40 hrs')).toBeInTheDocument();

    const statusRender = getColumnRender('status');
    expect(render(<>{statusRender(itemWithImage)}</>).getByText('Active')).toBeInTheDocument();
  });
});
