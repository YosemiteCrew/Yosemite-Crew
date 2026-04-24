'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

import OrgCard from '@/app/ui/cards/OrgCard/OrgCard';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { useOrgStore } from '@/app/stores/orgStore';
import { OrgWithMembership } from '@/app/features/organization/types/org';

import './DataTable.css';
import { toTitleCase } from '@/app/lib/validators';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type OrganizationListProps = {
  orgs: OrgWithMembership[];
};

export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return { color: 'var(--color-success-400)', backgroundColor: 'var(--color-success-100)' };
    case 'pending':
      return { color: 'var(--color-warning-600)', backgroundColor: '#FEF3E9' };
    default:
      return { color: 'var(--color-neutral-0)', backgroundColor: 'var(--color-badge-blue-bg)' };
  }
};

const OrganizationList = ({ orgs }: OrganizationListProps) => {
  const router = useRouter();
  const setPrimaryOrg = useOrgStore((s) => s.setPrimaryOrg);

  const handleOrgClick = async (org: OrgWithMembership) => {
    const id = org.org._id?.toString() || org.org.name;
    setPrimaryOrg(id);
    startRouteLoader();
    try {
      const role = org.membership?.roleDisplay ?? org.membership?.roleCode;
      const nextRoute = await resolveOrgScopedRedirect({ orgId: id, fallbackRole: role });
      router.push(nextRoute);
    } catch {
      stopRouteLoader();
    }
  };

  const columns: Column<OrgWithMembership>[] = [
    {
      label: 'Name',
      key: 'name',
      width: '30%',
      render: (item: OrgWithMembership) => (
        <button onClick={() => handleOrgClick(item)} className="OrgListDetails text-left">
          {item.org.name}
        </button>
      ),
    },
    {
      label: 'Type',
      key: 'type',
      width: '25%',
      render: (item: OrgWithMembership) => (
        <div className="InviteTime">{toTitleCase(item.org.type)}</div>
      ),
    },
    {
      label: 'Role',
      key: 'role',
      width: '25%',
      render: (item: OrgWithMembership) => (
        <div className="InviteExpires">{toTitleCase(item.membership?.roleDisplay)}</div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '20%',
      render: (item: OrgWithMembership) => (
        <div
          className="OrgStatus"
          style={getStatusStyle(item.org.isVerified ? 'Active' : 'Pending')}
        >
          {item.org.isVerified ? 'Active' : 'Pending'}
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable data={orgs} columns={columns} bordered={false} pageSize={5} pagination />
      </div>
      <div className="card-list">
        {(() => {
          if (orgs.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return orgs.map((org, index) => (
            <OrgCard key={org.org.name + index} org={org} handleOrgClick={handleOrgClick} />
          ));
        })()}
      </div>
    </div>
  );
};

export default OrganizationList;
