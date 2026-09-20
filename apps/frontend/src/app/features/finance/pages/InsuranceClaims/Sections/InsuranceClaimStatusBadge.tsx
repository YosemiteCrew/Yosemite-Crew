'use client';
import React from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  claimStatusBadge,
  type InsuranceClaimStatus,
} from '@/app/features/finance/types/insuranceClaim';

type InsuranceClaimStatusBadgeProps = {
  status: InsuranceClaimStatus;
};

/** The claim's lifecycle state, using the same tokens as the filter row. */
const InsuranceClaimStatusBadge = ({ status }: InsuranceClaimStatusBadgeProps) => {
  const { label, bg, text, border } = claimStatusBadge(status);
  return <StatusPill tokens={{ bg, text, border }} label={label} />;
};

export default InsuranceClaimStatusBadge;
