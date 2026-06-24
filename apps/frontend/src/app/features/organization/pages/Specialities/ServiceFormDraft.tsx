import React, { useCallback, useEffect, useId, useState } from 'react';
import { MdDeleteForever } from 'react-icons/md';
import { FiCheck } from 'react-icons/fi';
import { LuBedSingle, LuCheck } from 'react-icons/lu';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Badge from '@/app/ui/Badge';
import { CatalogItemType, ServiceRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { computeServiceTotal } from '@/app/features/organization/services/catalogCalculations';
import { useNotify } from '@/app/hooks/useNotify';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';

const TYPE_OPTIONS = [
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'PROCEDURE', label: 'Procedure' },
  { value: 'LAB', label: 'Lab / Diagnostics' },
];

const DURATION_OPTIONS = [
  { value: '15', label: '15 mins' },
  { value: '30', label: '30 mins' },
  { value: '45', label: '45 mins' },
  { value: '60', label: '60 mins' },
  { value: '90', label: '90 mins' },
  { value: '120', label: '120 mins' },
];

type ServiceFormDraftProps = {
  specialityId: string;
  organisationId: string;
  editService?: ServiceRevamp;
  onClose: () => void;
};

type FormErrors = Partial<Record<string, string>>;

const ServiceFormDraft = ({
  specialityId,
  organisationId,
  editService,
  onClose,
}: ServiceFormDraftProps) => {
  const isEditing = Boolean(editService);
  const addService = useRevampCatalogStore((s) => s.addService);
  const updateService = useRevampCatalogStore((s) => s.updateService);
  const deleteService = useRevampCatalogStore((s) => s.deleteService);
  const generateCode = useRevampCatalogStore((s) => s.generateItemCode);
  const { notify } = useNotify();
  const orgCurrency = useCurrencyForPrimaryOrg();
  const currency = editService?.currency ?? orgCurrency;

  const [name, setName] = useState(editService?.name ?? '');
  const [description, setDescription] = useState(editService?.description ?? '');
  const [type, setType] = useState<CatalogItemType>(editService?.type ?? 'CONSULTATION');
  const [duration, setDuration] = useState(String(editService?.durationMinutes ?? 30));
  const [grossAmount, setGrossAmount] = useState(String(editService?.grossAmount ?? ''));
  const [defaultDiscount, setDefaultDiscount] = useState(
    String(editService?.defaultDiscount ?? '0')
  );
  const [maxDiscount, setMaxDiscount] = useState(String(editService?.maxDiscount ?? ''));
  const [isBookable, setIsBookable] = useState(editService?.isBookable ?? true);
  const [isInpatient, setIsInpatient] = useState(editService?.isInpatientPreferred ?? false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [previewCode, setPreviewCode] = useState<string>(editService?.code ?? '');
  const descId = useId();

  useEffect(() => {
    if (!isEditing) {
      setPreviewCode(generateCode(type));
    }
  }, [type, isEditing, generateCode]);

  const gross = Number.parseFloat(grossAmount) || 0;
  const disc = Number.parseFloat(defaultDiscount) || 0;
  const { total } = computeServiceTotal({
    grossAmount: gross,
    defaultDiscount: disc,
  });

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    const defaultDiscountValue = Number(defaultDiscount);
    const maxDiscountValue = Number(maxDiscount);
    if (!name.trim()) errs.name = 'Name is required.';
    if (!grossAmount || Number.isNaN(Number(grossAmount)) || Number(grossAmount) < 0)
      errs.grossAmount = 'Enter a valid gross amount.';
    if (
      defaultDiscount &&
      (Number.isNaN(defaultDiscountValue) || defaultDiscountValue < 0 || defaultDiscountValue > 100)
    )
      errs.defaultDiscount = 'Default discount must be 0–100.';
    if (
      maxDiscount &&
      (Number.isNaN(maxDiscountValue) || maxDiscountValue < 0 || maxDiscountValue > 100)
    )
      errs.maxDiscount = 'Max discount must be 0–100.';
    if (
      !errs.defaultDiscount &&
      !errs.maxDiscount &&
      defaultDiscount &&
      maxDiscount &&
      defaultDiscountValue > maxDiscountValue
    )
      errs.defaultDiscount = 'Default discount cannot exceed max discount.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [defaultDiscount, grossAmount, maxDiscount, name]);

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (isEditing && editService) {
        await updateService(editService.id, {
          name: name.trim(),
          description: description.trim(),
          type,
          durationMinutes: Number.parseInt(duration, 10),
          grossAmount: Number.parseFloat(grossAmount),
          currency,
          defaultDiscount: Number.parseFloat(defaultDiscount) || 0,
          maxDiscount: Number.parseFloat(maxDiscount) || 0,
          isBookable,
          isInpatientPreferred: isInpatient,
        });
        notify('success', { title: 'Service updated', text: `"${name}" has been saved.` });
      } else {
        await addService({
          name: name.trim(),
          description: description.trim(),
          type,
          specialityId,
          organisationId,
          durationMinutes: Number.parseInt(duration, 10),
          grossAmount: Number.parseFloat(grossAmount),
          currency,
          defaultDiscount: Number.parseFloat(defaultDiscount) || 0,
          maxDiscount: Number.parseFloat(maxDiscount) || 0,
          isBookable,
          isInpatientPreferred: isInpatient,
          status: 'ACTIVE',
        });
        notify('success', { title: 'Service added', text: `"${name}" has been created.` });
      }
      onClose();
    } catch (error) {
      notify('error', {
        title: 'Unable to save service',
        text: getCatalogErrorMessage(error, 'Please check the details and try again.'),
      });
    }
  };

  const handleDelete = async () => {
    if (!editService) return;
    try {
      await deleteService(editService.id);
      notify('success', {
        title: 'Service deleted',
        text: `"${editService.name}" has been removed.`,
      });
      onClose();
    } catch (error) {
      notify('error', {
        title: 'Unable to delete service',
        text: getCatalogErrorMessage(error, 'This service could not be deleted. Please try again.'),
      });
    }
  };

  const draftTitle = `${isEditing ? name || 'Service' : 'New Service'} (draft)`;
  const draftTitleSlot = (
    <>
      {previewCode && (
        <span className="text-caption-1 text-text-secondary border border-card-border rounded-2xl px-3 py-1">
          {previewCode}
        </span>
      )}
      {isBookable && (
        <Badge tone="brand">
          <LuCheck size={14} aria-hidden="true" />
          Bookable
        </Badge>
      )}
      {isInpatient && (
        <Badge tone="brand">
          <LuBedSingle size={14} aria-hidden="true" />
          In-patient
        </Badge>
      )}
    </>
  );

  return (
    <SectionContainer
      title={draftTitle}
      titleSlot={draftTitleSlot}
      className="@container flex flex-col gap-5"
    >
      {/* Two-column: collapses to one column in narrow containers (e.g. side drawer) */}
      <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-x-6 gap-y-4 items-start">
        {/* Left col */}
        <div className="flex flex-col gap-4">
          <FormInput
            intype="text"
            inlabel="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: undefined }));
            }}
            error={errors.name}
          />
          <div className="relative w-full">
            <textarea
              id={descId}
              aria-label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder=" "
              className="peer w-full rounded-2xl bg-transparent px-6 pt-4 pb-3 text-body-4 text-text-primary outline-none border border-input-border-default focus:border-input-border-active resize-none min-h-28"
            />
            <label
              htmlFor={descId}
              className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)] truncate text-body-4 text-input-text-placeholder transition-all duration-200 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-input-text-placeholder-active peer-focus:bg-(--whitebg) peer-focus:px-1.5 peer-focus:max-w-none peer-not-placeholder-shown:px-1.5 peer-not-placeholder-shown:-top-2.5 peer-not-placeholder-shown:left-4 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:bg-(--whitebg) peer-not-placeholder-shown:max-w-none"
            >
              Description
            </label>
          </div>
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-4">
          <LabelDropdown
            placeholder="Type"
            options={TYPE_OPTIONS}
            defaultOption={type}
            onSelect={(o) => {
              const next = o.value as CatalogItemType;
              setType(next);
              if (!isEditing) setIsBookable(next === 'CONSULTATION');
            }}
            portal
          />
          <LabelDropdown
            placeholder="Duration"
            options={DURATION_OPTIONS}
            defaultOption={duration}
            onSelect={(o) => setDuration(o.value)}
            portal
          />
          <div className="flex items-center justify-end gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none text-body-4 text-text-secondary whitespace-nowrap">
              <input
                type="checkbox"
                aria-label="Bookable"
                checked={isBookable}
                onChange={(e) => setIsBookable(e.target.checked)}
                className="size-4 shrink-0 accent-(--color-input-border-active)"
              />
              {'Bookable'}
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-body-4 text-text-secondary whitespace-nowrap">
              <input
                type="checkbox"
                aria-label="Inpatient preferred"
                checked={isInpatient}
                onChange={(e) => setIsInpatient(e.target.checked)}
                className="size-4 shrink-0 accent-(--color-input-border-active)"
              />
              {'Inpatient preferred'}
            </label>
          </div>
        </div>
      </div>

      {/* Pricing row — always 2 per row, expanding to 4 on wide containers */}
      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-4">
        <FormInput
          intype="number"
          inlabel="Gross amt."
          value={grossAmount}
          onChange={(e) => {
            setGrossAmount(e.target.value);
            setErrors((p) => ({ ...p, grossAmount: undefined }));
          }}
          error={errors.grossAmount}
        />
        <FormInput
          intype="number"
          inlabel="Default Discount (%)"
          value={defaultDiscount}
          onChange={(e) => {
            setDefaultDiscount(e.target.value);
            setErrors((p) => ({ ...p, defaultDiscount: undefined }));
          }}
          error={errors.defaultDiscount}
        />
        <FormInput
          intype="number"
          inlabel="Max. Discount (%)"
          value={maxDiscount}
          onChange={(e) => {
            setMaxDiscount(e.target.value);
            setErrors((p) => ({ ...p, maxDiscount: undefined }));
          }}
          error={errors.maxDiscount}
        />
        <FormInput
          intype="text"
          inlabel="Total Amount"
          value={total > 0 ? formatMoney(total, currency) : ''}
          readonly
        />
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        {isEditing ? (
          <Secondary
            href="#"
            danger
            text="Delete Service"
            icon={<MdDeleteForever size={16} />}
            onClick={() => setConfirmDelete(true)}
          />
        ) : (
          <div />
        )}
        <div className="flex gap-3">
          <Secondary href="#" text="Cancel" onClick={onClose} />
          <Primary
            href="#"
            text="Save Service"
            icon={<FiCheck size={16} />}
            onClick={() => {
              Promise.resolve(handleSave()).catch(() => undefined);
            }}
          />
        </div>
      </div>

      {confirmDelete && editService && (
        <CenterModal showModal setShowModal={() => setConfirmDelete(false)}>
          <ModalHeader title="Delete service" onClose={() => setConfirmDelete(false)} />
          <p className="text-body-4 text-text-primary">
            Are you sure you want to delete <strong>{editService.name}</strong>? This permanently
            removes the service and cannot be undone. If it is used in packages or has historical
            usage, consider archiving instead.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Secondary href="#" text="Cancel" onClick={() => setConfirmDelete(false)} />
            <Delete
              href="#"
              text="Delete"
              onClick={() => {
                Promise.resolve(handleDelete()).catch(() => undefined);
              }}
            />
          </div>
        </CenterModal>
      )}
    </SectionContainer>
  );
};

export default ServiceFormDraft;
