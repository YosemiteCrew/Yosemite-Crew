import React, { useMemo } from 'react';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { IoEye, IoOpenOutline } from 'react-icons/io5';
import InvoiceCard from '@/app/ui/cards/InvoiceCard';
import { Invoice, InvoiceItem } from '@yosemite-crew/types';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { toTitle } from '@/app/lib/validators';
import { useRouter } from 'next/navigation';

import './DataTable.css';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import {
  getAppointmentByIdFromList,
  getCompanionNameFromAppointments,
  getParentNameFromAppointments,
} from '@/app/lib/invoice';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InvoiceTableProps = {
  filteredList: Invoice[];
  setActiveInvoice?: (inventory: Invoice) => void;
  setViewInvoice?: (open: boolean) => void;
};

export const getInvoiceItemNames = (items: InvoiceItem[]): string => {
  return items
    .map((item) => item.name?.trim())
    .filter(Boolean)
    .join(', ');
};

export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return { color: '#fff', backgroundColor: '#747283' };
    case 'awaiting_payment':
      return { color: '#fff', backgroundColor: '#A8A181' };
    case 'paid':
      return { color: '#fff', backgroundColor: '#D28F9A' };
    case 'failed':
      return { color: '#fff', backgroundColor: '#5C614B' };
    case 'cancelled':
      return { color: '#fff', backgroundColor: '#D9A488' };
    case 'refunded':
      return { color: '#fff', backgroundColor: '#BF9FAA' };
    default:
      return { color: '#000', backgroundColor: '#F1D4B0' };
  }
};

const InvoiceTable = ({ filteredList, setActiveInvoice, setViewInvoice }: InvoiceTableProps) => {
  const router = useRouter();
  const appointments = useAppointmentsForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();

  const handleViewInvoice = (inventory: Invoice) => {
    setActiveInvoice?.(inventory);
    setViewInvoice?.(true);
  };

  const goToAppointmentFinance = (appointmentId?: string) => {
    const appointment = getAppointmentByIdFromList(appointments, appointmentId);
    if (!appointment?.id) return;
    const params = new URLSearchParams({
      appointmentId: appointment.id,
      open: 'finance',
      subLabel: 'summary',
    });
    router.push(`/appointments?${params.toString()}`);
  };

  const getCompanionName = useMemo(
    () => (appointmentId: string | undefined) =>
      getCompanionNameFromAppointments(appointments, appointmentId),
    [appointments]
  );

  const getParentName = useMemo(
    () => (appointmentId: string | undefined) =>
      getParentNameFromAppointments(appointments, appointmentId),
    [appointments]
  );

  const columns: Column<Invoice>[] = [
    {
      label: 'Appointment Info',
      key: 'appointment-id',
      width: '10%',
      render: (item: Invoice) => {
        const appointment = getAppointmentByIdFromList(appointments, item.appointmentId);
        const companionName = getCompanionName(item.appointmentId);
        const parentName = getParentName(item.appointmentId);
        const ownerAndCompanion =
          parentName !== '-' && companionName !== '-'
            ? `${parentName} / ${companionName}`
            : parentName !== '-'
              ? parentName
              : companionName !== '-'
                ? companionName
                : '-';
        return (
          <div className="appointment-profile truncate">
            <div className="appointment-profile-two">
              <div
                className="appointment-profile-title truncate whitespace-nowrap max-w-[220px]"
                title={ownerAndCompanion}
              >
                {ownerAndCompanion}
              </div>
              {appointment && (
                <button
                  type="button"
                  onClick={() => goToAppointmentFinance(item.appointmentId)}
                  className="mt-1 w-full text-left rounded-xl! border border-card-border px-2 py-1.5 hover:bg-card-hover transition-colors"
                  title="Open appointment finance"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="appointment-profile-sub truncate">
                        {formatDateLabel(appointment.appointmentDate)}
                      </div>
                      <div className="appointment-profile-sub truncate">
                        {formatTimeLabel(appointment.startTime ?? appointment.appointmentDate)}{' '}
                        Finance
                      </div>
                    </div>
                    <IoOpenOutline size={15} color="#302F2E" />
                  </div>
                </button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      label: 'Service',
      key: 'service',
      width: '15%',
      render: (item: Invoice) => (
        <div className="appointment-profile-title">{getInvoiceItemNames(item.items)}</div>
      ),
    },
    {
      label: 'Date',
      key: 'date',
      width: '10%',
      render: (item: Invoice) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{formatDateLabel(item.createdAt)}</div>
        </div>
      ),
    },
    {
      label: 'Sub-total',
      key: 'sub-total',
      width: '7.5%',
      render: (item: Invoice) => (
        <div className="appointment-profile-title">{formatMoney(item.subtotal, currency)}</div>
      ),
    },
    {
      label: 'Discount',
      key: 'discount',
      width: '7.5%',
      render: (item: Invoice) => (
        <div className="appointment-profile-title">
          {formatMoney(item.discountTotal ?? 0, currency)}
        </div>
      ),
    },
    {
      label: 'Tax',
      key: 'tax',
      width: '7.5%',
      render: (item: Invoice) => (
        <div className="appointment-profile-title">{formatMoney(item.taxTotal ?? 0, currency)}</div>
      ),
    },
    {
      label: 'Total',
      key: 'total',
      width: '7.5%',
      render: (item: Invoice) => (
        <div className="appointment-profile-title">
          {formatMoney(item.totalAmount ?? 0, currency)}
        </div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '15%',
      render: (item: Invoice) => (
        <div className="appointment-status" style={getStatusStyle(item?.status)}>
          {toTitle(item?.status)}
        </div>
      ),
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '5%',
      render: (item: Invoice) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewInvoice(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="#302F2E" />
          </button>
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
          return filteredList.map((item, i) => (
            <InvoiceCard
              key={item.id || 'invoice-key' + i}
              invoice={item}
              handleViewInvoice={handleViewInvoice}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default InvoiceTable;
