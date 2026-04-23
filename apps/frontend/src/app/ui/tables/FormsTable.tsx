import { FormsProps, getFormCategoryDisplayLabel } from '@/app/features/forms/types/forms';
import React, { useMemo } from 'react';
import { IoEye } from 'react-icons/io5';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import FormCard from '@/app/ui/cards/FormCard';
import { useTeamStore } from '@/app/stores/teamStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { Organisation } from '@yosemite-crew/types';

import './DataTable.css';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type FormsTableProps = {
  filteredList: FormsProps[];
  setActiveForm: (companion: FormsProps) => void;
  setViewPopup: (open: boolean) => void;
  loading?: boolean;
};

export const getStatusStyle = (status: string) => {
  if (!status) {
    return {
      color: 'var(--color-pill-neutral-text)',
      backgroundColor: 'var(--color-pill-neutral-bg)',
      borderColor: 'var(--color-pill-neutral-border)',
    };
  }
  switch (status.toLowerCase()) {
    case 'published':
      return {
        color: 'var(--color-pill-info-text)',
        backgroundColor: 'var(--color-pill-info-bg)',
        borderColor: 'var(--color-pill-info-border)',
      };
    case 'draft':
      return {
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      };
    case 'archived':
      return {
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      };
    default:
      return {
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      };
  }
};

const FormsTable = ({
  filteredList,
  setActiveForm,
  setViewPopup,
  loading = false,
}: FormsTableProps) => {
  const { teamsById } = useTeamStore();
  const orgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE as
    | Organisation['type']
    | undefined;
  const effectiveOrgType = orgTypeOverride || orgType;

  // Create a lookup map from practitioner ID to team member name
  const userIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const team of Object.values(teamsById)) {
      if (team.practionerId && team.name) {
        map[team.practionerId] = team.name;
      }
    }
    return map;
  }, [teamsById]);

  const getUserName = (userId: string) => {
    return userIdToName[userId] || userId;
  };

  const handleViewForm = (companion: FormsProps) => {
    setActiveForm(companion);
    setViewPopup(true);
  };

  const columns: Column<FormsProps>[] = [
    {
      label: 'Form name',
      key: 'name',
      width: '20%',
      render: (item: FormsProps) => <div className="appointment-profile-title">{item.name}</div>,
    },
    {
      label: 'Category',
      key: 'category',
      width: '10%',
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">
          {getFormCategoryDisplayLabel(item.category, effectiveOrgType)}
        </div>
      ),
    },
    {
      label: 'Usage',
      key: 'usage',
      width: '15%',
      render: (item: FormsProps) => <div className="appointment-profile-title">{item.usage}</div>,
    },
    {
      label: 'Updated by',
      key: 'updatedBy',
      width: '15%',
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">{getUserName(item.updatedBy)}</div>
      ),
    },
    {
      label: 'Last updated',
      key: 'lastUpdated',
      width: '15%',
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">{item.lastUpdated}</div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '15%',
      render: (item: FormsProps) => (
        <div className="appointment-status" style={getStatusStyle(item.status || '')}>
          {item.status}
        </div>
      ),
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '10%',
      render: (item: FormsProps) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewForm(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="var(--color-neutral-900)" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper h-full min-h-0 overflow-hidden">
      <div className="table-list hidden xl:flex h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        {loading ? (
          <div className="w-full py-6 flex items-center justify-center text-grey-noti font-satoshi font-semibold">
            Loading forms...
          </div>
        ) : (
          <GenericTable
            data={filteredList}
            columns={columns}
            bordered={false}
            pagination
            pageSize={10}
          />
        )}
      </div>
      <div className="card-list flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (loading) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                Loading forms...
              </div>
            );
          }
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((form, index) => (
            <FormCard
              key={index + form.name}
              form={form}
              handleViewForm={handleViewForm}
              getUserName={getUserName}
              orgType={effectiveOrgType}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default FormsTable;
