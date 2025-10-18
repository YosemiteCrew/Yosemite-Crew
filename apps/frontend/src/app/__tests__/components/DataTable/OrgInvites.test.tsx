import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrgInvites from '../../../components/DataTable/OrgInvites';

jest.mock('react-icons/fa', () => ({
  FaCheckCircle: () => <div data-testid="check-icon" />,
}));
jest.mock('react-icons/io', () => ({
  IoIosCloseCircle: () => <div data-testid="close-icon" />,
}));

const mockGenericTableProps: any = {};
jest.mock('@/app/components/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(mockGenericTableProps, props);
    return <div data-testid="mock-generic-table" />;
  },
}));

const demoData = [
    {
      details: "Invite Details 1",
      time: "10:00 AM",
      expires: "2023-12-31",
    },
];

describe('OrgInvites Component', () => {

  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test('should pass the correct data, columns, and props to GenericTable', () => {
    render(<OrgInvites />);

    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();

    expect(mockGenericTableProps.data).toEqual(demoData);
    expect(mockGenericTableProps.columns).toHaveLength(4);
    expect(mockGenericTableProps.bordered).toBe(false);
    expect(mockGenericTableProps.pagination).toBe(true);
    expect(mockGenericTableProps.pageSize).toBe(3);
  });

  test('should render all column content correctly for 100% coverage', () => {
    render(<OrgInvites />);
    const { columns } = mockGenericTableProps;
    const item = demoData[0];

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key)?.render;

    const detailsRender = getColumnRender('details');
    expect(render(<>{detailsRender(item)}</>).getByText('Invite Details 1')).toBeInTheDocument();

    const timeRender = getColumnRender('time');
    expect(render(<>{timeRender(item)}</>).getByText('10:00 AM')).toBeInTheDocument();

    const expiresRender = getColumnRender('expires');
    expect(render(<>{expiresRender(item)}</>).getByText('2023-12-31')).toBeInTheDocument();

    const actionsRender = getColumnRender('actions');
    const { container: actionsContainer } = render(<>{actionsRender(item)}</>);
    expect(within(actionsContainer).getByText('Accept')).toBeInTheDocument();
    expect(within(actionsContainer).getByTestId('check-icon')).toBeInTheDocument();
    expect(within(actionsContainer).getByText('Decline')).toBeInTheDocument();
    expect(within(actionsContainer).getByTestId('close-icon')).toBeInTheDocument();
  });
});
