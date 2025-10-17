import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import UpcomingConsultationsTable from '../../../components/DataTable/UpcomingConsultationsTable';

jest.mock('@iconify/react/dist/iconify.js', () => ({
  Icon: (props: { icon: string }) => <div data-testid={props.icon} />,
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
    appointmentId: "DRO01-03-23-2024",
    date: "24 Apr 2025",
    time: "10:15 AM",
    reason: "Annual Health Check-Up",
    vetname: "Dr. Emily Johnson",
    vetrole: "Dr. Emily Johnson",
  },
];

describe('UpcomingConsultationsTable Component', () => {

  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test('should pass the correct data and columns to GenericTable', () => {
    render(<UpcomingConsultationsTable />);

    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();

    expect(mockGenericTableProps.data).toHaveLength(2);
    expect(mockGenericTableProps.columns).toHaveLength(5);
    expect(mockGenericTableProps.bordered).toBe(false);
  });

  test('should render all column content correctly for 100% coverage', () => {
    render(<UpcomingConsultationsTable />);
    const { columns } = mockGenericTableProps;
    const item = demoData[0];

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key)?.render;

    const idRender = getColumnRender('appointmentId');
    expect(render(<>{idRender(item)}</>).getByText('DRO01-03-23-2024')).toBeInTheDocument();

    const dateRender = getColumnRender('date');
    const { container: dateContainer } = render(<>{dateRender(item)}</>);
    expect(within(dateContainer).getByText('24 Apr 2025')).toBeInTheDocument();
    expect(within(dateContainer).getByText('10:15 AM')).toBeInTheDocument();

    const reasonRender = getColumnRender('petType');
    expect(render(<>{reasonRender(item)}</>).getByText('Annual Health Check-Up')).toBeInTheDocument();

    const vetRender = getColumnRender('attendvet');
    const { container: vetContainer } = render(<>{vetRender(item)}</>);
    expect(within(vetContainer).getAllByText('Dr. Emily Johnson')).toHaveLength(2);

    const actionsRender = getColumnRender('actions');
    const { getAllByRole } = render(<>{actionsRender(item)}</>);
    expect(getAllByRole('button')).toHaveLength(2);
    expect(screen.getByTestId('solar:eye-bold')).toBeInTheDocument();
    expect(screen.getByTestId('solar:file-download-bold')).toBeInTheDocument();
  });
});
