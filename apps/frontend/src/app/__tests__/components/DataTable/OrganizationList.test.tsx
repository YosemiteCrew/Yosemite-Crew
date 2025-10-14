import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrganizationList from '../../../components/DataTable/OrganizationList';

jest.mock('react-icons/ai', () => ({
  AiFillMinusCircle: () => <div data-testid="minus-icon" />,
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
      details: "Organizations Details 1",
      plan: "Paid",
      role: "Owner",
      status: "Verification Pending",
    },
];

describe('OrganizationList Component', () => {

  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test('should pass the correct data, columns, and props to GenericTable', () => {
    render(<OrganizationList />);

    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();

    expect(mockGenericTableProps.data).toEqual(demoData);
    expect(mockGenericTableProps.columns).toHaveLength(4);
    expect(mockGenericTableProps.bordered).toBe(false);
    expect(mockGenericTableProps.pagination).toBe(true);
    expect(mockGenericTableProps.pageSize).toBe(3);
  });

  test('should render all column content correctly for 100% coverage', () => {
    render(<OrganizationList />);
    const { columns } = mockGenericTableProps;
    const item = demoData[0];

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key)?.render;

    const detailsRender = getColumnRender('details');
    const { container: detailsContainer } = render(<>{detailsRender(item)}</>);
    expect(within(detailsContainer).getByText('Organizations Details 1')).toBeInTheDocument();
    expect(within(detailsContainer).getByText('Verification Pending')).toBeInTheDocument();

    const planRender = getColumnRender('plan');
    expect(render(<>{planRender(item)}</>).getByText('Paid')).toBeInTheDocument();

    const roleRender = getColumnRender('role');
    expect(render(<>{roleRender(item)}</>).getByText('Owner')).toBeInTheDocument();

    const actionsRender = getColumnRender('actions');
    const { container: actionsContainer } = render(<>{actionsRender(item)}</>);
    expect(within(actionsContainer).getByText('Leave')).toBeInTheDocument();
    expect(within(actionsContainer).getByTestId('minus-icon')).toBeInTheDocument();
  });
});
