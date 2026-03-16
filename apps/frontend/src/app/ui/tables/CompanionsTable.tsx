'use client';
import React from 'react';
import { FaCalendar, FaTasks } from 'react-icons/fa';
import { IoEye, IoOpenOutline } from 'react-icons/io5';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import CompanionCard from '@/app/ui/cards/CompanionCard/CompanionCard';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { Appointment } from '@yosemite-crew/types';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';

import { getAgeInYears } from '@/app/lib/date';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { toTitleCase } from '@/app/lib/validators';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';

import './DataTable.css';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type CompanionsTableProps = {
  filteredList: CompanionParent[];
  setActiveCompanion: (companion: CompanionParent) => void;
  setViewCompanion: (open: boolean) => void;
  setBookAppointment: (open: boolean) => void;
  setAddTask: (open: boolean) => void;
  canEditAppointments: boolean;
  canEditTasks: boolean;
};

export const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active':
      return { color: '#fff', backgroundColor: '#D28F9A' };
    case 'archived':
      return { color: '#fff', backgroundColor: '#747283' };
    case 'inactive':
      return { color: '#fff', backgroundColor: '#BF9FAA' };
    default:
      return { color: '#fff', backgroundColor: 'rgba(107,114,128,0.1)' };
  }
};

const formatDisplayValue = (value?: string | null, fallback = '-') => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return fallback;
  return toTitleCase(normalized);
};

const formatAgeWithUnit = (dateOfBirth: Date | string) => {
  const age = getAgeInYears(dateOfBirth);
  if (!Number.isFinite(age) || age < 0) return '-';
  return `${age} ${age === 1 ? 'Yr' : 'Yrs'}`;
};

const CompanionsTable = ({
  filteredList,
  setActiveCompanion,
  setViewCompanion,
  setBookAppointment,
  setAddTask,
  canEditAppointments,
  canEditTasks,
}: CompanionsTableProps) => {
  const router = useRouter();
  const appointments = useAppointmentsForPrimaryOrg();

  const getUpcomingAppointmentForCompanion = (companionId?: string) => {
    if (!companionId) return null;
    const now = Date.now();
    const upcomingStatuses = new Set(['REQUESTED', 'UPCOMING', 'CHECKED_IN', 'IN_PROGRESS']);

    const related = appointments
      .filter(
        (appointment) =>
          appointment?.companion?.id === companionId &&
          upcomingStatuses.has(String(appointment.status ?? '').toUpperCase())
      )
      .sort(
        (a, b) =>
          new Date(a.startTime ?? a.appointmentDate).getTime() -
          new Date(b.startTime ?? b.appointmentDate).getTime()
      );

    if (related.length === 0) return null;
    return (
      related.find(
        (appointment) =>
          new Date(appointment.startTime ?? appointment.appointmentDate).getTime() >= now
      ) ?? related[0]
    );
  };

  const goToAppointment = (appointment: Appointment) => {
    if (!appointment?.id) return;
    const params = new URLSearchParams({
      appointmentId: appointment.id,
    });
    router.push(`/appointments?${params.toString()}`);
  };

  const handleViewCompanion = (companion: CompanionParent) => {
    setActiveCompanion(companion);
    setViewCompanion(true);
  };

  const handleBookAppointment = (companion: CompanionParent) => {
    setActiveCompanion(companion);
    setBookAppointment(true);
  };

  const handleAddTask = (companion: CompanionParent) => {
    setActiveCompanion(companion);
    setAddTask(true);
  };

  const columns: Column<CompanionParent>[] = [
    {
      label: '',
      key: 'image',
      width: '5%',
      render: (item: CompanionParent) => (
        <div className="appointment-profile w-10 h-10">
          <Image
            src={getSafeImageUrl(
              item.companion.photoUrl,
              item.companion.type.toLowerCase() as ImageType
            )}
            alt=""
            height={40}
            width={40}
            style={{
              borderRadius: '50%',
              objectFit: 'cover',
              maxWidth: '40px',
              minWidth: '40px',
              maxHeight: '40px',
            }}
          />
        </div>
      ),
    },
    {
      label: 'Name',
      key: 'name',
      width: '15%',
      render: (item: CompanionParent) => (
        <div className="appointment-profile">
          <div className="appointment-profile-two">
            <div className="appointment-profile-title">
              {formatDisplayValue(item.companion.name)}
            </div>
            <div className="flex items-center">
              <div className="appointment-profile-sub truncate max-w-[75px] mr-1">
                {formatDisplayValue(item.companion.breed)}
              </div>
              <div className="appointment-profile-sub">{`/ ${toTitleCase(item.companion.type)}`}</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      label: 'Parent',
      key: 'parent',
      width: '10%',
      render: (item: CompanionParent) => (
        <div className="appointment-profile-title">{formatDisplayValue(item.parent.firstName)}</div>
      ),
    },
    {
      label: 'Gender/Age',
      key: 'gender/age',
      width: '10%',
      render: (item: CompanionParent) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">
            {formatDisplayValue(item.companion.gender)}
          </div>
          <div className="appointment-profile-title">
            {formatAgeWithUnit(item.companion.dateOfBirth)}
          </div>
        </div>
      ),
    },
    {
      label: 'Allergy',
      key: 'allergy',
      width: '15%',
      render: (item: CompanionParent) => (
        <div className="appointment-profile-title">
          {formatDisplayValue(item.companion.allergy)}
        </div>
      ),
    },
    {
      label: 'Upcoming Appointment',
      key: 'Upcoming Appointment',
      width: '20%',
      render: (item: CompanionParent) => {
        const upcoming = getUpcomingAppointmentForCompanion(item.companion.id);
        if (!upcoming) {
          return (
            <div className="appointment-profile-two">
              <div className="appointment-profile-title">-</div>
              <div className="appointment-profile-sub" />
            </div>
          );
        }

        return (
          <button
            type="button"
            onClick={() => goToAppointment(upcoming)}
            className="w-full text-left rounded-xl! border border-card-border px-2 py-1.5 hover:bg-card-hover transition-colors"
            title="Open appointment"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="appointment-profile-two min-w-0">
                <div className="appointment-profile-title truncate">
                  {formatDateLabel(upcoming.appointmentDate)}
                </div>
                <div className="appointment-profile-sub truncate">
                  {formatTimeLabel(upcoming.startTime)}
                </div>
              </div>
              <IoOpenOutline size={15} color="#302F2E" />
            </div>
          </button>
        );
      },
    },
    {
      label: 'Status',
      key: 'status',
      width: '15%',
      render: (item: CompanionParent) => (
        <div
          className="appointment-status"
          style={getStatusStyle(item.companion.status || 'inactive')}
        >
          {toTitleCase(item.companion.status || 'inactive')}
        </div>
      ),
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '10%',
      render: (item: CompanionParent) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewCompanion(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="#302F2E" />
          </button>
          {canEditAppointments && (
            <button
              onClick={() => handleBookAppointment(item)}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <FaCalendar size={14} color="#302F2E" />
            </button>
          )}
          {canEditTasks && (
            <button
              onClick={() => handleAddTask(item)}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <FaTasks size={14} color="#302F2E" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={10}
        />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((companion, index) => (
            <CompanionCard
              key={index + companion.companion.name}
              companion={companion}
              handleViewCompanion={handleViewCompanion}
              handleBookAppointment={handleBookAppointment}
              handleAddTask={handleAddTask}
              canEditAppointments={canEditAppointments}
              canEditTasks={canEditTasks}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default CompanionsTable;
