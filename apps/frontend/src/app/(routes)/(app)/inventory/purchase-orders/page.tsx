import type { Metadata } from 'next';
import PurchaseOrdersContent from '@/app/features/inventory/pages/PurchaseOrders';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

export const metadata: Metadata = { title: 'Purchase orders — Yosemite Crew' };

const PAGE_SKELETON = <PageSkeleton variant="list" />;

export default function Page() {
  return (
    <ProtectedRoute skeleton={PAGE_SKELETON}>
      <OrgGuard skeleton={PAGE_SKELETON}>
        <PurchaseOrdersContent />
      </OrgGuard>
    </ProtectedRoute>
  );
}
