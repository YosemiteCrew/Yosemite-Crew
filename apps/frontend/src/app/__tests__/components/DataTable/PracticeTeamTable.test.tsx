import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PracticeTeamTable from '../../../components/DataTable/PracticeTeamTable';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));
jest.mock('react-icons/bs', () => ({
  BsEye: () => <span data-testid="eye-icon" />,
}));

const mockGenericTableProps: any = {};
jest.mock('@/app/components/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(mockGenericTableProps, props);
    return <div data-testid="mock-generic-table" />;
  },
}));

const mockDataSample = {
    avatar: "https://d2il6osz49gpup.cloudfront.net/Images/pet1.png",
    name: "Kizie",
    subName: "Sky B",
    appointmentId: "DRO01-03-23-2024",
    reason: "Annual Health Check-Up",
    petType: "Dog",
    petSubType: "Beagle",
    time: "10:15 AM",
    date: "24 Apr 2025",
    doctor: "Dr. Emily Johnson",
    doctorDept: "Cardiology",
};

describe('PracticeTeamTable Component', () => {
  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test('should pass the correct data and columns to GenericTable', () => {
    render(<PracticeTeamTable />);

    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sell All' })).toBeInTheDocument();

    expect(mockGenericTableProps.data).toHaveLength(3);
    expect(mockGenericTableProps.columns).toHaveLength(8);
    expect(mockGenericTableProps.bordered).toBe(false);
  });

  test('should render all column content correctly for 100% coverage', () => {
    render(<PracticeTeamTable />);
    const { columns } = mockGenericTableProps;

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key)?.render;

    const item = mockDataSample;

    const avatarRender = getColumnRender('avatar');
    const { getByAltText } = render(<>{avatarRender(item)}</>);
    expect(getByAltText('Kizie')).toBeInTheDocument();

    const nameRender = getColumnRender('name');
    const { getByText } = render(<>{nameRender(item)}</>);
    expect(getByText('Kizie')).toBeInTheDocument();
    expect(getByText('Sky B')).toBeInTheDocument();

    const idRender = getColumnRender('appointmentId');
    expect(render(<>{idRender(item)}</>).getByText('DRO01-03-23-2024')).toBeInTheDocument();

    const reasonRender = getColumnRender('reason');
    expect(render(<>{reasonRender(item)}</>).getByText('Annual Health Check-Up')).toBeInTheDocument();

    const petTypeRender = getColumnRender('petType');
    const { container: petTypeContainer } = render(<>{petTypeRender(item)}</>);
    expect(within(petTypeContainer).getByText('Dog')).toBeInTheDocument();
    expect(within(petTypeContainer).getByText('Beagle')).toBeInTheDocument();

    const timeRender = getColumnRender('time');
    const { container: timeContainer } = render(<>{timeRender(item)}</>);
    expect(within(timeContainer).getByText('10:15 AM')).toBeInTheDocument();
    expect(within(timeContainer).getByText('24 Apr 2025')).toBeInTheDocument();

    const doctorRender = getColumnRender('doctor');
    const { container: doctorContainer } = render(<>{doctorRender(item)}</>);
    expect(within(doctorContainer).getByText('Dr. Emily Johnson')).toBeInTheDocument();
    expect(within(doctorContainer).getByText('Cardiology')).toBeInTheDocument();

    const actionsRender = getColumnRender('actions');
    const { getByRole } = render(<>{actionsRender(item)}</>);
    expect(getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
  });
});
