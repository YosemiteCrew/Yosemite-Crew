import type { Metadata } from 'next';
import PossibleDuplicates from '@/app/features/companions/pages/PossibleDuplicates/PossibleDuplicates';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

export const metadata: Metadata = { title: 'Possible duplicate patients — Yosemite Crew' };

const SKELETON = <PageSkeleton variant="list" />;

export default function PossibleDuplicatesPage() {
  return (
    <ProtectedRoute skeleton={SKELETON}>
      <OrgGuard skeleton={SKELETON}>
        <PossibleDuplicates />
      </OrgGuard>
    </ProtectedRoute>
  );
}
