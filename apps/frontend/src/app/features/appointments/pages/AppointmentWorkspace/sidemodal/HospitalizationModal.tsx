'use client';
import React, { useMemo, useState } from 'react';
import { IoAdd, IoCheckmarkOutline, IoPerson } from 'react-icons/io5';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import AppointmentEstimatePanel from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentEstimatePanel';
import StaffField from '@/app/features/appointments/pages/AppointmentWorkspace/components/StaffField';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Timepicker from '@/app/ui/inputs/Timepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import type { DropdownOption } from '@/app/hooks/useDropdown';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import { Primary } from '@/app/ui/primitives/Buttons';

const NEUTRAL_900 = 'var(--color-neutral-900)';

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
  }) => boolean | Promise<boolean>;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Hospitalization central modal — converts an outpatient encounter to inpatient.
 * Reuses the shared Add Appointment modal shell, estimate panel, and field
 * components (Datepicker / Timepicker / LabelDropdown), matching the Add
 * Appointment central modal theme.
 */
type SyncedRoomDefaultsArgs = {
  showModal: boolean;
  defaultRoomId?: string;
  defaultUnitId?: string;
  defaultSupportId?: string;
  roomId?: string;
  unitOptionsByRoomId?: Record<string, DropdownItem[]>;
  setRoomId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setUnitId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setSupportStaffId: React.Dispatch<React.SetStateAction<string | undefined>>;
};

/**
 * Keep room, unit and support in step with data that loads after the modal opens.
 *
 * Two reconciliations, both render-phase (React's documented
 * setState-during-render pattern), extracted so the component body stays a list
 * of state and handlers rather than state interleaved with reconciliation:
 *
 * 1. Defaults that arrive late. Only the open transition adopted them, so a
 *    modal opened before the load finished kept empty selections and blocked
 *    the conversion on errors the user could not clear. A late default fills an
 *    EMPTY slot only - a value the user picked is theirs.
 * 2. The unit against the selected room's options. Keyed on the options as well
 *    as the room, because the option map loads too: options arriving after the
 *    room was chosen used to leave a unit that room does not have selected.
 */
const useSyncedRoomDefaults = ({
  showModal,
  defaultRoomId,
  defaultUnitId,
  defaultSupportId,
  roomId,
  unitOptionsByRoomId,
  setRoomId,
  setUnitId,
  setSupportStaffId,
}: SyncedRoomDefaultsArgs) => {
  const [prevDefaults, setPrevDefaults] = useState({
    defaultRoomId,
    defaultUnitId,
    defaultSupportId,
  });
  const defaultsChanged =
    prevDefaults.defaultRoomId !== defaultRoomId ||
    prevDefaults.defaultUnitId !== defaultUnitId ||
    prevDefaults.defaultSupportId !== defaultSupportId;

  if (showModal && defaultsChanged) {
    setPrevDefaults({ defaultRoomId, defaultUnitId, defaultSupportId });
    if (defaultRoomId) setRoomId((current) => current ?? defaultRoomId);
    if (defaultUnitId) setUnitId((current) => current ?? defaultUnitId);
    if (defaultSupportId) setSupportStaffId((current) => current ?? defaultSupportId);
  }

  const optionsForRoom = roomId ? (unitOptionsByRoomId?.[roomId] ?? []) : [];
  const unitReconcileKey = `${roomId ?? ''}|${optionsForRoom.map((o) => o.value).join(',')}`;
  const [prevUnitReconcileKey, setPrevUnitReconcileKey] = useState(unitReconcileKey);

  if (unitReconcileKey !== prevUnitReconcileKey) {
    setPrevUnitReconcileKey(unitReconcileKey);
    if (roomId && unitOptionsByRoomId) {
      setUnitId((current) => resolveUnitForRoom(current, optionsForRoom));
    }
  }
};

/** The unit to keep for a room: the current one if it is still offered, else the first. */
const resolveUnitForRoom = (
  current: string | undefined,
  optionsForRoom: DropdownItem[]
): string | undefined => {
  if (optionsForRoom.length === 0) return undefined;
  return current && optionsForRoom.some((option) => option.value === current)
    ? current
    : optionsForRoom[0].value;
};

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
  const [dischargeDate, setDischargeDate] = useState<Date | null>(() => addDays(today, 2));
  const [roomId, setRoomId] = useState<string | undefined>(defaultRoomId);
  const [unitId, setUnitId] = useState<string | undefined>(defaultUnitId);
  const defaultSupportId = supportOptions.find((option) => option.label === supportName)?.value;
  const [supportStaffId, setSupportStaffId] = useState<string | undefined>(defaultSupportId);
  const [servicePackageIds, setServicePackageIds] = useState<string[]>([]);
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

  const [prevShowModal, setPrevShowModal] = useState(showModal);
  if (showModal !== prevShowModal) {
    setPrevShowModal(showModal);
    if (showModal) {
      setRoomId(defaultRoomId);
      setUnitId(defaultUnitId);
      setSupportStaffId(defaultSupportId);
      setServicePackageIds([]);
      setHasSubmitted(false);
    }
  }

  useSyncedRoomDefaults({
    showModal,
    defaultRoomId,
    defaultUnitId,
    defaultSupportId,
    roomId,
    unitOptionsByRoomId,
    setRoomId,
    setUnitId,
    setSupportStaffId,
  });

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

  const handleConvert = async () => {
    // Re-entrancy guard: the Convert button is disabled while isConverting, so this
    // early return cannot be reached through the UI.
    /* v8 ignore next -- unreachable via UI: the convert button is disabled while converting */
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
              <div className="flex flex-col gap-1 text-caption-2 text-text-error">
                {Object.values(validationErrors).map((error) => (
                  <span key={error}>{error}</span>
                ))}
              </div>
            )}
          </div>

          {/* Right column: lead/support + service package + estimate */}
          <div className="flex flex-col gap-5">
            <StaffField label="Assigned lead" name={leadName} />
            <LabelDropdown
              placeholder="Assigned Support"
              options={supportOptions}
              defaultOption={supportStaffId}
              icon={<IoPerson size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
              onSelect={(option: DropdownOption) => setSupportStaffId(option.value)}
            />
            <MultiSelectDropdown
              placeholder="Additional Service / Package"
              options={servicePackageOptions}
              value={servicePackageIds}
              icon={<IoAdd size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
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

        <ModalFooter>
          <Primary
            text={isConverting ? 'Converting' : 'Convert to Inpatient'}
            icon={<IoCheckmarkOutline aria-hidden="true" />}
            onClick={handleConvert}
            isDisabled={isConverting}
          />
        </ModalFooter>
      </div>
    </AppointmentCentralModalShell>
  );
};

export default HospitalizationModal;
