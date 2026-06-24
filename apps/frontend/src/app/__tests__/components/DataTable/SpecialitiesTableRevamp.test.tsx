import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="next-image" role="img" aria-label={alt} />,
}));

jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="generic-table">
      {data.map((item: any, i: number) => (
        <div key={i} data-testid="table-row">
          {columns.map((col: any) => (
            <div key={col.key} data-testid={`col-${col.key}`}>
              {col.render(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/cards/SpecialitiesCard', () => ({
  __esModule: true,
  default: ({ speciality, handleViewSpeciality }: any) => (
    <div data-testid="speciality-card">
      <span>{speciality.name}</span>
      <button type="button" onClick={handleViewSpeciality}>
        View
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/tables/common', () => ({
  Column: {},
  NoDataMessage: () => <div data-testid="no-data">No data</div>,
  ViewButton: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      View
    </button>
  ),
  ProfileTitle: ({ children }: any) => <span data-testid="profile-title">{children}</span>,
}));

let mockAllServices: any[] = [];
let mockAllPackages: any[] = [];
jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: (selector: any) =>
    selector({ services: mockAllServices, packages: mockAllPackages }),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

let mockTeams: any[] = [];
jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => mockTeams,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: (url: any) => url ?? '/fallback.png',
}));

jest.mock('./DataTable.css', () => ({}), { virtual: true });
jest.mock('@/app/ui/tables/DataTable.css', () => ({}), { virtual: true });

import SpecialitiesTableRevamp from '@/app/ui/tables/SpecialitiesTableRevamp';

const makeSpeciality = (overrides: any = {}): any => ({
  _id: 'spec-1',
  name: 'Dermatology',
  services: [{ id: 's1' }, { id: 's2' }],
  teamMemberIds: ['t1', 't2', 't3'],
  headName: null,
  headUserId: null,
  headProfilePicUrl: null,
  ...overrides,
});

describe('SpecialitiesTableRevamp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllServices = [];
    mockAllPackages = [];
    mockTeams = [];
  });

  it('renders speciality name as a link in table', () => {
    render(<SpecialitiesTableRevamp filteredList={[makeSpeciality()]} onManageTeam={jest.fn()} />);
    const link = screen.getByRole('link', { name: 'Dermatology' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/organization/specialities?open=spec-1');
  });

  it('shows service count from store when revampId is present', () => {
    mockAllServices = [
      { specialityId: 'spec-1', status: 'ACTIVE' },
      { specialityId: 'spec-1', status: 'ACTIVE' },
      { specialityId: 'spec-1', status: 'ARCHIVED' },
    ];
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ revampId: 'spec-1' })]}
        onManageTeam={jest.fn()}
      />
    );
    const serviceCols = screen.getAllByTestId('col-Services');
    expect(serviceCols[0]).toHaveTextContent('2');
  });

  it('falls back to item.services.length when no revampId', () => {
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ _id: undefined })]}
        onManageTeam={jest.fn()}
      />
    );
    const serviceCols = screen.getAllByTestId('col-Services');
    expect(serviceCols[0]).toHaveTextContent('2');
  });

  it('shows package count from store when revampId present', () => {
    mockAllPackages = [
      { specialityId: 'spec-1', status: 'ACTIVE' },
      { specialityId: 'spec-1', status: 'ACTIVE' },
    ];
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ revampId: 'spec-1' })]}
        onManageTeam={jest.fn()}
      />
    );
    const pkgCols = screen.getAllByTestId('col-Packages');
    expect(pkgCols[0]).toHaveTextContent('2');
  });

  it('shows 0 packages when no revampId', () => {
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ _id: undefined })]}
        onManageTeam={jest.fn()}
      />
    );
    const pkgCols = screen.getAllByTestId('col-Packages');
    expect(pkgCols[0]).toHaveTextContent('0');
  });

  it('shows em-dash when headName is null', () => {
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ headName: null })]}
        onManageTeam={jest.fn()}
      />
    );
    const headCols = screen.getAllByTestId('col-Head');
    expect(headCols[0]).toHaveTextContent('—');
  });

  it('shows head image and name when headName is set', () => {
    mockTeams = [{ practionerId: 'u-1', name: 'Dr. Lee', image: '/dr-lee.png' }];
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ headName: 'Dr. Lee', headUserId: 'u-1' })]}
        onManageTeam={jest.fn()}
      />
    );
    expect(screen.getByRole('img', { name: 'Dr. Lee' })).toBeInTheDocument();
    const headCols = screen.getAllByTestId('col-Head');
    expect(headCols[0]).toHaveTextContent('Dr. Lee');
  });

  it('resolves head name from team list when only headUserId is present', () => {
    mockTeams = [{ practionerId: 'u-1', name: 'Dr. Team Lead', image: '/lead.png' }];
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ headName: null, headUserId: 'u-1' })]}
        onManageTeam={jest.fn()}
      />
    );
    expect(screen.getByRole('img', { name: 'Dr. Team Lead' })).toBeInTheDocument();
    const headCols = screen.getAllByTestId('col-Head');
    expect(headCols[0]).toHaveTextContent('Dr. Team Lead');
  });

  it('shows team member count', () => {
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ teamMemberIds: ['t1', 't2'] })]}
        onManageTeam={jest.fn()}
      />
    );
    const teamCols = screen.getAllByTestId('col-Team members');
    expect(teamCols[0]).toHaveTextContent('2');
  });

  it('shows 0 team members when teamMemberIds is undefined', () => {
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ teamMemberIds: undefined })]}
        onManageTeam={jest.fn()}
      />
    );
    const teamCols = screen.getAllByTestId('col-Team members');
    expect(teamCols[0]).toHaveTextContent('0');
  });

  it('calls onManageTeam when View button is clicked in table', () => {
    const onManageTeam = jest.fn();
    const spec = makeSpeciality();
    render(<SpecialitiesTableRevamp filteredList={[spec]} onManageTeam={onManageTeam} />);
    const viewBtns = screen.getAllByRole('button', { name: 'View' });
    fireEvent.click(viewBtns[0]);
    expect(onManageTeam).toHaveBeenCalledWith(spec);
  });

  it('renders NoDataMessage in mobile view when list is empty', () => {
    render(<SpecialitiesTableRevamp filteredList={[]} onManageTeam={jest.fn()} />);
    expect(screen.getByTestId('no-data')).toBeInTheDocument();
  });

  it('renders speciality cards in mobile view', () => {
    render(
      <SpecialitiesTableRevamp
        filteredList={[
          makeSpeciality({ name: 'Cardiology' }),
          makeSpeciality({ _id: 'spec-2', name: 'Neurology' }),
        ]}
        onManageTeam={jest.fn()}
      />
    );
    expect(screen.getAllByTestId('speciality-card').length).toBe(2);
    expect(screen.getAllByText('Cardiology').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Neurology').length).toBeGreaterThan(0);
  });

  it('link href omits query param when no revampId', () => {
    render(
      <SpecialitiesTableRevamp
        filteredList={[makeSpeciality({ _id: undefined })]}
        onManageTeam={jest.fn()}
      />
    );
    const link = screen.getByRole('link', { name: 'Dermatology' });
    expect(link).toHaveAttribute('href', '/organization/specialities');
  });
});
