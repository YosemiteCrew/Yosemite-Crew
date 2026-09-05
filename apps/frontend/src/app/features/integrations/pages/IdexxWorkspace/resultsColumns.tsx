/**
 * The IDEXX results-table column definitions.
 *
 * Split out of index.tsx because a module that exports both React components and
 * plain values loses per-component Fast Refresh: an edit here would invalidate the
 * whole workspace module instead of hot-swapping one component
 * (react-doctor/only-export-components).
 */
import React from 'react';
import type { Column } from '@/app/ui/tables/GenericTable/GenericTable';
import type { LabResult } from '@/app/features/integrations/services/types';
import { formatDateTimeLocal } from '@/app/lib/date';
import {
  PatientCell,
  ResultActionCell,
  StatusCell,
} from '@/app/features/integrations/pages/IdexxWorkspace/resultCells';

type ResultsColumnsOptions = {
  censusDeviceByPatientId: Record<string, string>;
  getAppointmentLabsHref: (result: LabResult) => string;
  openResultDetails: (result: LabResult) => Promise<void>;
  terminologyText: (text: string) => string;
};

export const buildResultsColumns = ({
  censusDeviceByPatientId,
  getAppointmentLabsHref,
  openResultDetails,
  terminologyText,
}: ResultsColumnsOptions): Column<LabResult>[] => [
  {
    label: terminologyText('Patient'),
    key: 'patientName',
    width: '22%',
    render: (result) => <PatientCell result={result} />,
  },
  {
    label: 'Accession #',
    key: 'accessionId',
    width: '14%',
    render: (result) => (
      <span className="text-body-4 text-text-primary tabular-nums">
        {result.accessionId ?? '-'}
      </span>
    ),
  },
  {
    label: 'Order ID',
    key: 'orderId',
    width: '12%',
    render: (result) => (
      <span className="text-body-4 text-text-secondary tabular-nums">{result.orderId ?? '-'}</span>
    ),
  },
  {
    label: 'IVLS Device ID',
    key: 'ivls',
    width: '13%',
    render: (result) => (
      <span className="text-body-4 text-text-secondary tabular-nums">
        {censusDeviceByPatientId[String(result.patientId ?? '').trim()] ?? '-'}
      </span>
    ),
  },
  {
    label: 'Collection date',
    key: 'updatedAt',
    width: '13%',
    render: (result) => (
      <span className="text-body-4 text-text-secondary">
        {formatDateTimeLocal(result.updatedAt, '-')}
      </span>
    ),
  },
  {
    label: 'Status',
    key: 'status',
    width: '12%',
    render: (result) => <StatusCell result={result} />,
  },
  {
    label: '',
    key: 'actions',
    width: '14%',
    render: (result) => (
      <ResultActionCell
        result={result}
        appointmentLabsHref={getAppointmentLabsHref(result)}
        openResultDetails={openResultDetails}
      />
    ),
  },
];
