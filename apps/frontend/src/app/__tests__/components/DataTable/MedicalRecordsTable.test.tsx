import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import MedicalRecordsTable from '../../../components/DataTable/MedicalRecordsTable';

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

const mockData = [
    {
      appointmentId: "Dr. Laura Evans",
      date: "24 Apr 2025",
      time: "10:15 AM",
      reason: "Elevated Heart Rate",
      vetname: "Atenolol 5mg tablets — 1 tab daily",
      followup: "Revisit in 2 weeks",
    },
];

describe('MedicalRecordsTable Component', () => {

  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test('should render GenericTable and pass the correct props', () => {
    render(<MedicalRecordsTable />);

    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();

    expect(mockGenericTableProps.data).toHaveLength(3);
    expect(mockGenericTableProps.columns).toHaveLength(6);
    expect(mockGenericTableProps.bordered).toBe(false);
  });

  test('should render all column content correctly for 100% coverage', () => {
    render(<MedicalRecordsTable />);
    const { columns } = mockGenericTableProps;
    const item = mockData[0];

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key)?.render;

    const vetRender = getColumnRender('Attending Veterinarian');
    expect(render(<>{vetRender(item)}</>).getByText('Dr. Laura Evans')).toBeInTheDocument();

    const dateRender = getColumnRender('date');
    const { container: dateContainer } = render(<>{dateRender(item)}</>);
    expect(within(dateContainer).getByText('24 Apr 2025')).toBeInTheDocument();
    expect(within(dateContainer).getByText('10:15 AM')).toBeInTheDocument();

    const diagnosisRender = getColumnRender('petType');
    expect(render(<>{diagnosisRender(item)}</>).getByText('Elevated Heart Rate')).toBeInTheDocument();

    const treatmentRender = getColumnRender('attendvet');
    expect(render(<>{treatmentRender(item)}</>).getByText(/Atenolol 5mg/)).toBeInTheDocument();

    const followupRender = getColumnRender('attendvet');

    const actionsRender = getColumnRender('actions');
    const { getByRole } = render(<>{actionsRender(item)}</>);
    expect(getByRole('button')).toBeInTheDocument();
    expect(screen.getByTestId('solar:eye-bold')).toBeInTheDocument();
  });
});
