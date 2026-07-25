import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { FormsProps, getFormCategoryDisplayLabel } from '@/app/features/forms/types/forms';
import React, { useMemo } from 'react';
import {
  IoClipboardOutline,
  IoDocumentTextOutline,
  IoEllipsisHorizontal,
  IoMedkitOutline,
} from 'react-icons/io5';
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

/* Design gives the template cell a leading tinted tile whose glyph follows the
   template's category — clipboard for intake, medkit for clinical notes,
   document for everything else. */
const getTemplateIcon = (category: string) => {
  const key = String(category ?? '').toLowerCase();
  if (key.includes('intake')) return IoClipboardOutline;
  if (key.includes('soap') || key.includes('note') || key.includes('discharge')) {
    return IoMedkitOutline;
  }
  return IoDocumentTextOutline;
};

/* Divs, not spans: `.TableDiv tbody tr td span:not(...)` in Generictable.css
   force-styles every bare span inside a cell (700 weight, 60% opacity). */
const TemplateNameCell = ({ item }: { item: FormsProps }) => {
  const Icon = getTemplateIcon(item.category);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: 'var(--blue-soft)', color: 'var(--blue-text)' }}
      >
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="appointment-profile-title cell-name truncate" title={item.name}>
          {item.name}
        </div>
        {item.description ? (
          <div
            className="truncate text-[11.5px]"
            style={{ color: 'var(--ink-faint)' }}
            title={item.description}
          >
            {item.description}
          </div>
        ) : null}
      </div>
    </div>
  );
};

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
      render: (item: FormsProps) => <TemplateNameCell item={item} />,
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
      label: 'Fields',
      key: 'fields',
      width: '90px',
      render: (item: FormsProps) => (
        <div className="appointment-profile-title tabular-nums">{item.schema?.length ?? 0}</div>
      ),
    },
    /* Design carries the edit stamp as one line — "02 Jul · Dr. Weber" — rather
       than splitting the date and the person across two columns. */
    {
      label: 'Last updated',
      key: 'lastUpdated',
      width: '150px',
      render: (item: FormsProps) => (
        <div className="truncate text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
          {[item.lastUpdated, getUserName(item.updatedBy)].filter(Boolean).join(' · ')}
        </div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '110px',
      render: (item: FormsProps) => (
        <StatusPill style={getFormsStatusStyle(item.status || '')} label={item.status} />
      ),
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '64px',
      render: (item: FormsProps) => (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => handleViewForm(item)}
            aria-label={`View form ${item.name}`}
            className="flex size-7 cursor-pointer items-center justify-center rounded-[9px] transition-colors hover:bg-[var(--surface-soft)]"
            style={{ color: 'var(--ink-faint)' }}
          >
            <IoEllipsisHorizontal size={16} aria-hidden="true" />
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
            itemNoun="templates"
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
