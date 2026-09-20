'use client';
import React from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { estimateStatusBadge, type EstimateStatus } from '@/app/features/finance/types/estimate';

type EstimateStatusBadgeProps = {
  status: EstimateStatus;
};

/** The estimate's lifecycle state, using the same tokens as the filter row. */
const EstimateStatusBadge = ({ status }: EstimateStatusBadgeProps) => {
  const { label, bg, text, border } = estimateStatusBadge(status);
  return <StatusPill tokens={{ bg, text, border }} label={label} />;
};

export default EstimateStatusBadge;
