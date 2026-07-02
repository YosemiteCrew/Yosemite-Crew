'use client';
import React, { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { LuCheck } from 'react-icons/lu';
import { TiPlus } from 'react-icons/ti';
import { HiUser } from 'react-icons/hi2';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import AppointmentEstimatePanel from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentEstimatePanel';
import StaffField from '@/app/features/appointments/pages/AppointmentWorkspace/components/StaffField';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Timepicker from '@/app/ui/inputs/Timepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import type { DropdownOption } from '@/app/hooks/useDropdown';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import '@/app/ui/primitives/Buttons/ButtonEffects.css';

const FONT = 'var(--font-satoshi), sans-serif';
const NEUTRAL_900 = 'var(--color-neutral-900)';

const text14M: CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '120%',
  color: NEUTRAL_900,
};

type DropdownItem = { label: string; value: string };

type ServicePackage = {
  id: string;
  kind: 'SERVICE' | 'PACKAGE';
  name: string;
  cost: number;
  maxDiscount: number;
};

type HospitalizationModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  leadName?: string;
  supportName?: string;
  supportOptions: DropdownItem[];
  roomOptions: DropdownItem[];
  unitOptions: DropdownItem[];
  unitOptionsByRoomId?: Record<string, DropdownItem[]>;
  servicePackages: ServicePackage[];
  defaultRoomId?: string;
  defaultUnitId?: string;
  onConvert: (payload: {
    admissionDate: Date | null;
    admissionTime: string;
    dischargeDate: Date | null;
    roomId?: string;
    unitId?: string;
    supportStaffId?: string;
    servicePackageIds: string[];
    notifyChannels: string[];
  }) => boolean | Promise<boolean>;
};

type NotifyChannel = 'app' | 'sms' | 'email';

const NOTIFY_OPTIONS: Array<{ key: NotifyChannel; label: string }> = [
  { key: 'app', label: 'Notify via App' },
  { key: 'sms', label: 'Notify via SMS' },
  { key: 'email', label: 'Notify via Email' },
];

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Hospitalization central modal — converts an outpatient encounter to inpatient.
 * Reuses the shared Add Appointment modal shell, estimate panel, and field
 * components (Datepicker / Timepicker / LabelDropdown) plus the notify-channel
 * footer pattern, matching the Add Appointment central modal theme.
 */
const HospitalizationModal = ({
  showModal,
  setShowModal,
  leadName,
  supportName,
  supportOptions,
  roomOptions,
  unitOptions,
  unitOptionsByRoomId,
  servicePackages,
  defaultRoomId,
  defaultUnitId,
  onConvert,
}: HospitalizationModalProps) => {
  const terminologyText = useCompanionTerminologyText();
  const today = useMemo(() => new Date(), []);
  const [admissionDate, setAdmissionDate] = useState<Date | null>(today);
  const [admissionTime, setAdmissionTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}`;
  });
  const [dischargeDate, setDischargeDate] = useState<Date | null>(addDays(today, 2));
  const [roomId, setRoomId] = useState<string | undefined>(defaultRoomId);
  const [unitId, setUnitId] = useState<string | undefined>(defaultUnitId);
  const defaultSupportId = supportOptions.find((option) => option.label === supportName)?.value;
  const [supportStaffId, setSupportStaffId] = useState<string | undefined>(defaultSupportId);
  const [servicePackageIds, setServicePackageIds] = useState<string[]>([]);
  const [notifyChannels, setNotifyChannels] = useState<Set<NotifyChannel>>(new Set(['app']));
  const [isConverting, setIsConverting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const selectedPackageSet = useMemo(() => new Set(servicePackageIds), [servicePackageIds]);
  const selectedPackages = useMemo(
    () => servicePackages.filter((pkg) => selectedPackageSet.has(pkg.id)),
    [selectedPackageSet, servicePackages]
  );
  const selectedEstimate = useMemo(
    () =>
      selectedPackages.reduce(
        (total, pkg) => ({
          cost: total.cost + (Number(pkg.cost) || 0),
          maxDiscount: total.maxDiscount + (Number(pkg.maxDiscount) || 0),
        }),
        { cost: 0, maxDiscount: 0 }
      ),
    [selectedPackages]
  );
  const servicePackageOptions = useMemo(
    () =>
      servicePackages.map((pkg) => ({
        label: pkg.name,
        value: pkg.id,
        badge: pkg.kind === 'PACKAGE' ? 'Package' : 'Service',
      })),
    [servicePackages]
  );
  const activeUnitOptions = useMemo(() => {
    if (!roomId) return unitOptions;
    return unitOptionsByRoomId?.[roomId] ?? unitOptions;
  }, [roomId, unitOptions, unitOptionsByRoomId]);

  useEffect(() => {
    if (!showModal) return;
    setRoomId(defaultRoomId);
    setUnitId(defaultUnitId);
    setSupportStaffId(defaultSupportId);
    setServicePackageIds([]);
    setHasSubmitted(false);
  }, [defaultRoomId, defaultSupportId, defaultUnitId, showModal]);

  useEffect(() => {
    if (!roomId || !unitOptionsByRoomId) return;
    const optionsForRoom = unitOptionsByRoomId[roomId] ?? [];
    if (!optionsForRoom.length) {
      setUnitId(undefined);
      return;
    }
    setUnitId((current) =>
      current && optionsForRoom.some((option) => option.value === current)
        ? current
        : optionsForRoom[0].value
    );
  }, [roomId, unitOptionsByRoomId]);

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!admissionDate) errors.admissionDate = 'Admission date is required.';
    if (!admissionTime.trim()) errors.admissionTime = 'Admission time is required.';
    if (!roomId) errors.roomId = 'Room is required.';
    if (!unitId) errors.unitId = 'Unit is required.';
    if (admissionDate && dischargeDate && dischargeDate.getTime() < admissionDate.getTime()) {
      errors.dischargeDate = 'Tentative discharge cannot be before admission.';
    }
    return errors;
  }, [admissionDate, admissionTime, dischargeDate, roomId, unitId]);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  // Only mount the modal's fields while open so they don't duplicate other
  // workspace controls (e.g. the meta-bar Room dropdown) in the DOM.
  if (!showModal) return null;

  const toggleNotify = (key: NotifyChannel) => {
    setNotifyChannels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConvert = async () => {
    if (isConverting) return;
    setHasSubmitted(true);
    if (hasValidationErrors) return;
    setIsConverting(true);
    try {
      const converted = await onConvert({
        admissionDate,
        admissionTime,
        dischargeDate,
        roomId,
        unitId,
        supportStaffId,
        servicePackageIds,
        notifyChannels: [...notifyChannels],
      });
      if (converted) setShowModal(false);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <AppointmentCentralModalShell
      showModal={showModal}
      setShowModal={setShowModal}
      title={terminologyText('Hospitalizing Patient')}
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Left column: admission/discharge dates + room/unit */}
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Datepicker
                type="input"
                placeholder="Date of admission"
                currentDate={admissionDate}
                setCurrentDate={setAdmissionDate}
              />
              <Timepicker
                label="Time of admission"
                value={admissionTime}
                onChange={setAdmissionTime}
              />
            </div>
            <div className="sm:max-w-[calc(50%-10px)]">
              <Datepicker
                type="input"
                placeholder="Date of discharge (tentative)"
                currentDate={dischargeDate}
                setCurrentDate={setDischargeDate}
                minDate={admissionDate ?? undefined}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <LabelDropdown
                placeholder="Room"
                options={roomOptions}
                defaultOption={roomId}
                onSelect={(option: DropdownOption) => setRoomId(option.value)}
              />
              <LabelDropdown
                placeholder="Unit"
                options={activeUnitOptions}
                defaultOption={unitId}
                onSelect={(option: DropdownOption) => setUnitId(option.value)}
              />
            </div>
            {hasSubmitted && hasValidationErrors && (
              <div className="flex flex-col gap-1 text-caption-2 text-danger-700">
                {Object.values(validationErrors).map((error) => (
                  <span key={error}>{error}</span>
                ))}
              </div>
            )}
          </div>

          {/* Right column: lead/support + service package + estimate */}
          <div className="flex flex-col gap-5">
            <StaffField label="Assigned Lead" name={leadName} />
            <LabelDropdown
              placeholder="Assigned Support"
              options={supportOptions}
              defaultOption={supportStaffId}
              icon={<HiUser size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
              onSelect={(option: DropdownOption) => setSupportStaffId(option.value)}
            />
            <MultiSelectDropdown
              placeholder="Additional Service / Package"
              options={servicePackageOptions}
              value={servicePackageIds}
              icon={<TiPlus size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
              onChange={setServicePackageIds}
              searchable
              portal
            />
            <AppointmentEstimatePanel
              cost={selectedEstimate.cost}
              maxDiscount={selectedEstimate.maxDiscount}
            />
          </div>
        </div>

        {/* Footer: notify channels + convert action */}
        <div className="flex flex-col gap-3 border-t border-card-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {NOTIFY_OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Notify by ${label}`}
                  checked={notifyChannels.has(key)}
                  onChange={() => toggleNotify(key)}
                  className="size-4 shrink-0 cursor-pointer"
                />
                <span style={text14M}>{label}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleConvert}
            disabled={isConverting}
            className="yc-primary-button flex items-center justify-center gap-2 rounded-2xl! px-4 py-2.75 font-satoshi text-base font-medium leading-6 whitespace-nowrap text-white!"
            onPointerDown={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--yc-button-x', `${e.clientX - r.left}px`);
              e.currentTarget.style.setProperty('--yc-button-y', `${e.clientY - r.top}px`);
            }}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--yc-button-x', `${e.clientX - r.left}px`);
              e.currentTarget.style.setProperty('--yc-button-y', `${e.clientY - r.top}px`);
            }}
          >
            <LuCheck aria-hidden="true" />
            {isConverting ? 'Converting' : 'Convert to Inpatient'}
          </button>
        </div>
      </div>
    </AppointmentCentralModalShell>
  );
};

export default HospitalizationModal;
