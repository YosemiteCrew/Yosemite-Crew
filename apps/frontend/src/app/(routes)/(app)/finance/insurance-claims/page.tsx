import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Insurance claims — Yosemite Crew' };

// Re-exported rather than wrapped: the route adds no behaviour of its own, so a
// local component that only returns the screen is indirection without intent.
export { default } from '@/app/features/finance/pages/InsuranceClaims';
