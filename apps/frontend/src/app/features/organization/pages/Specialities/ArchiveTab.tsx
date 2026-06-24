import React, { useState } from 'react';
import { MdDeleteForever, MdOutlineUnarchive } from 'react-icons/md';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { useNotify } from '@/app/hooks/useNotify';
import { computeServiceTotal } from '@/app/features/organization/services/catalogCalculations';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import { PackageRevamp, ServiceRevamp } from '@/app/features/organization/types/revamp';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure',
  LAB: 'Lab / Diagnostics',
  INVENTORY: 'Inventory',
  MEDICATION: 'Medication',
  PACKAGE: 'Package',
};

type ArchiveTabProps = {
  specialityId: string;
  organisationId: string;
};

type DeleteTarget =
  | { kind: 'service'; item: ServiceRevamp }
  | { kind: 'package'; item: PackageRevamp }
  | null;

const ArchiveTab = ({ specialityId, organisationId }: ArchiveTabProps) => {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const orgCurrency = useCurrencyForPrimaryOrg();
  const services = useRevampCatalogStore(
    useShallow((s) =>
      s.services.filter((svc) => svc.specialityId === specialityId && svc.status === 'ARCHIVED')
    )
  );
  const packages = useRevampCatalogStore(
    useShallow((s) =>
      s.packages.filter((pkg) => pkg.specialityId === specialityId && pkg.status === 'ARCHIVED')
    )
  );
  const restoreService = useRevampCatalogStore((s) => s.restoreService);
  const deleteService = useRevampCatalogStore((s) => s.deleteService);
  const restorePackage = useRevampCatalogStore((s) => s.restorePackage);
  const deletePackage = useRevampCatalogStore((s) => s.deletePackage);
  const loadSpecialityCatalog = useRevampCatalogStore((s) => s.loadSpecialityCatalog);
  const { notify } = useNotify();

  const isEmpty = services.length === 0 && packages.length === 0;

  React.useEffect(() => {
    Promise.resolve(
      loadSpecialityCatalog(organisationId, specialityId, {
        force: true,
        includeArchive: true,
      })
    ).catch(() => undefined);
  }, [loadSpecialityCatalog, organisationId, specialityId]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'service') {
        await deleteService(deleteTarget.item.id);
        notify('success', {
          title: 'Service deleted',
          text: `"${deleteTarget.item.name}" has been permanently removed.`,
        });
      } else {
        await deletePackage(deleteTarget.item.id);
        notify('success', {
          title: 'Package deleted',
          text: `"${deleteTarget.item.name}" has been permanently removed.`,
        });
      }
      setDeleteTarget(null);
    } catch (error) {
      notify('error', {
        title: 'Unable to delete item',
        text: getCatalogErrorMessage(error, 'This item could not be deleted. Please try again.'),
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      {isEmpty && (
        <div className="flex items-center justify-center gap-2 py-8 text-body-4 text-text-secondary">
          <AiOutlineInfoCircle size={16} aria-hidden="true" />
          No archived services or packages.
        </div>
      )}

      {services.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-caption-1 text-text-secondary uppercase tracking-wide px-1">
            Services
          </p>
          {services.map((svc, i) => {
            const { total } = computeServiceTotal(svc);
            return (
              <div
                key={svc.id}
                className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-card-border bg-card-bg opacity-80"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-body-4-emphasis text-text-secondary shrink-0 pt-0.5">
                    {i + 1}.
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-body-4-emphasis text-text-secondary">{svc.name}</span>
                    <div className="flex gap-4 text-caption-1 text-text-secondary flex-wrap">
                      <span>{svc.code}</span>
                      <span>{TYPE_LABELS[svc.type] ?? svc.type}</span>
                      <span>{formatMoney(total, svc.currency ?? orgCurrency)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label={`Restore ${svc.name}`}
                    onClick={() => {
                      Promise.resolve(restoreService(svc.id))
                        .then(() => {
                          notify('success', {
                            title: 'Service restored',
                            text: `"${svc.name}" is now active.`,
                          });
                        })
                        .catch((error) => {
                          notify('error', {
                            title: 'Unable to restore service',
                            text: getCatalogErrorMessage(error, 'Please try again.'),
                          });
                        });
                    }}
                    className="flex items-center justify-center size-9 rounded-full border border-card-border hover:border-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors"
                  >
                    <MdOutlineUnarchive
                      size={16}
                      color="var(--color-text-brand)"
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${svc.name} permanently`}
                    onClick={() => {
                      setDeleteTarget({ kind: 'service', item: svc });
                    }}
                    className="flex items-center justify-center size-9 rounded-full border border-card-border hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors"
                  >
                    <MdDeleteForever size={16} color="var(--color-danger-600)" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {packages.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-caption-1 text-text-secondary uppercase tracking-wide px-1">
            Packages
          </p>
          {packages.map((pkg, i) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-card-border bg-card-bg opacity-80"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-body-4-emphasis text-text-secondary shrink-0 pt-0.5">
                  {i + 1}.
                </span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-body-4-emphasis text-text-secondary">{pkg.name}</span>
                  <div className="flex gap-4 text-caption-1 text-text-secondary flex-wrap">
                    <span>{pkg.code}</span>
                    <span>Package</span>
                    <span>{pkg.durationText}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  aria-label={`Restore ${pkg.name}`}
                  onClick={() => {
                    Promise.resolve(restorePackage(pkg.id))
                      .then(() => {
                        notify('success', {
                          title: 'Package restored',
                          text: `"${pkg.name}" is now active.`,
                        });
                      })
                      .catch((error) => {
                        notify('error', {
                          title: 'Unable to restore package',
                          text: getCatalogErrorMessage(error, 'Please try again.'),
                        });
                      });
                  }}
                  className="flex items-center justify-center size-9 rounded-full border border-card-border hover:border-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors"
                >
                  <MdOutlineUnarchive
                    size={16}
                    color="var(--color-text-brand)"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${pkg.name} permanently`}
                  onClick={() => {
                    setDeleteTarget({ kind: 'package', item: pkg });
                  }}
                  className="flex items-center justify-center size-9 rounded-full border border-card-border hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors"
                >
                  <MdDeleteForever size={16} color="var(--color-danger-600)" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {deleteTarget && (
        <CenterModal showModal setShowModal={() => setDeleteTarget(null)}>
          <ModalHeader
            title={`Delete ${deleteTarget.kind}`}
            onClose={() => setDeleteTarget(null)}
          />
          <p className="text-body-4 text-text-primary">
            Are you sure you want to permanently delete <strong>{deleteTarget.item.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Secondary href="#" text="Cancel" onClick={() => setDeleteTarget(null)} />
            <Delete
              href="#"
              text="Delete"
              onClick={() => {
                Promise.resolve(handleDeleteConfirm()).catch(() => undefined);
              }}
            />
          </div>
        </CenterModal>
      )}
    </div>
  );
};

export default ArchiveTab;
