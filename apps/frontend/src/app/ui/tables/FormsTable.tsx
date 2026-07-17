import { FormsProps, getFormCategoryDisplayLabel } from '@/app/features/forms/types/forms';
import React, { useMemo } from 'react';
import { IoEye } from 'react-icons/io5';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import FormCard from '@/app/ui/cards/FormCard';
import { useTeamStore } from '@/app/stores/teamStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { Organisation } from '@yosemite-crew/types';

import { getFormsStatusStyle } from '@/app/ui/tables/tableUtils';

import './DataTable.css';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

/** Minimal shape needed to resolve a linked service id to a display name. */
type LinkedServiceOption = { label: string; value: string };

type FormsTableProps = {
  filteredList: FormsProps[];
  setActiveForm: (companion: FormsProps) => void;
  setViewPopup: (open: boolean) => void;
  loading?: boolean;
  /**
   * Opt-in: when true, renders a "Linked services" chips column resolving each template's
   * `services` ids via `serviceOptions`. Defaults to false so other callers of this shared
   * table render the exact same columns as before.
   */
  showLinkedServices?: boolean;
  /** Service id -> label source used only when `showLinkedServices` is true. */
  serviceOptions?: LinkedServiceOption[];
};

const FormsTable = ({
  filteredList,
  setActiveForm,
  setViewPopup,
  loading = false,
  showLinkedServices = false,
  serviceOptions,
}: FormsTableProps) => {
  const { teamsById } = useTeamStore();
  const orgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE as
    Organisation['type'] | undefined;
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

  // Resolve linked-service ids to display names (opt-in column only).
  const serviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of serviceOptions ?? []) {
      if (option?.value) map.set(String(option.value), option.label);
    }
    return map;
  }, [serviceOptions]);

  const handleViewForm = (companion: FormsProps) => {
    setActiveForm(companion);
    setViewPopup(true);
  };

  const columns: Column<FormsProps>[] = [
    {
      label: 'Form name',
      key: 'name',
      width: '200px',
      render: (item: FormsProps) => <div className="appointment-profile-title">{item.name}</div>,
    },
    {
      label: 'Category',
      key: 'category',
      width: '130px',
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">
          {getFormCategoryDisplayLabel(item.category, effectiveOrgType)}
        </div>
      ),
    },
    {
      label: 'Usage',
      key: 'usage',
      width: '130px',
      render: (item: FormsProps) => <div className="appointment-profile-title">{item.usage}</div>,
    },
    {
      label: 'Updated by',
      key: 'updatedBy',
      width: '140px',
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">{getUserName(item.updatedBy)}</div>
      ),
    },
    {
      label: 'Last updated',
      key: 'lastUpdated',
      width: '140px',
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">{item.lastUpdated}</div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '110px',
      render: (item: FormsProps) => (
        <div className="appointment-status" style={getFormsStatusStyle(item.status || '')}>
          {item.status}
        </div>
      ),
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '64px',
      render: (item: FormsProps) => (
        <div className="action-btn-col">
          <button
            type="button"
            onClick={() => handleViewForm(item)}
            aria-label={`View form ${item.name}`}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="var(--color-neutral-900)" />
          </button>
        </div>
      ),
    },
  ];

  // Opt-in only: insert the linked-service chips column after "Category" so the templates
  // list mirrors the design. Other callers leave `showLinkedServices` off → columns unchanged.
  if (showLinkedServices) {
    columns.splice(2, 0, {
      label: 'Linked services',
      key: 'linkedServices',
      width: '190px',
      render: (item: FormsProps) => {
        const serviceIds = item.services ?? [];
        if (serviceIds.length === 0) {
          return <span className="text-body-4 text-text-tertiary">-</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {serviceIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center rounded-full! bg-[var(--inset)] px-2.5 py-[3px] text-[11px] font-semibold text-[var(--ink-body)]"
              >
                {serviceNameById.get(id) ?? id}
              </span>
            ))}
          </div>
        );
      },
    });
  }

  return (
    <div className="table-wrapper forms-scroll-x h-full min-h-0 overflow-hidden">
      <div className="table-list hidden xl:flex h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        {loading ? (
          <div className="w-full py-6 flex items-center justify-center text-grey-noti font-satoshi font-semibold">
            Loading forms…
          </div>
        ) : (
          <GenericTable
            data={filteredList}
            columns={columns}
            bordered={false}
            tableClassName="forms-table-fixed"
            pagination
            pageSize={10}
          />
        )}
      </div>
      <div className="card-list flex xl:hidden gap-4 sm:gap-6 flex-wrap">
        {(() => {
          if (loading) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                Loading forms…
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
