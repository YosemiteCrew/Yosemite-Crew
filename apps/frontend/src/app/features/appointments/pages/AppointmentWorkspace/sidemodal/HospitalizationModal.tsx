'use client';
import React, { useMemo, useState, type CSSProperties } from 'react';
import { LuCheck } from 'react-icons/lu';
import { TiPlus } from 'react-icons/ti';
import { HiUser } from 'react-icons/hi2';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import AppointmentEstimatePanel from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentEstimatePanel';
import StaffField from '@/app/features/appointments/pages/AppointmentWorkspace/components/StaffField';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Timepicker from '@/app/ui/inputs/Timepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import type { DropdownOption } from '@/app/hooks/useDropdown';
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
  servicePackages: ServicePackage[];
  defaultRoomId?: string;
  defaultUnitId?: string;
  onConvert: (payload: {
    admissionDate: Date | null;
    admissionTime: string;
    dischargeDate: Date | null;
    roomId?: string;
    unitId?: string;
    supportName?: string;
    servicePackageId?: string;
    notifyChannels: string[];
  }) => void;
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
  servicePackages,
  defaultRoomId,
  defaultUnitId,
  onConvert,
}: HospitalizationModalProps) => {
  const today = useMemo(() => new Date(), []);
  const [admissionDate, setAdmissionDate] = useState<Date | null>(today);
  const [admissionTime, setAdmissionTime] = useState('');
  const [dischargeDate, setDischargeDate] = useState<Date | null>(addDays(today, 2));
  const [roomId, setRoomId] = useState<string | undefined>(defaultRoomId);
  const [unitId, setUnitId] = useState<string | undefined>(defaultUnitId);
  const [support, setSupport] = useState<string | undefined>(supportName);
  const [servicePackageId, setServicePackageId] = useState<string | undefined>(
    servicePackages[0]?.id
  );
  const [notifyChannels, setNotifyChannels] = useState<Set<NotifyChannel>>(new Set(['app']));

  const selectedPackage = servicePackages.find((pkg) => pkg.id === servicePackageId);

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

  const handleConvert = () => {
    onConvert({
      admissionDate,
      admissionTime,
      dischargeDate,
      roomId,
      unitId,
      supportName: support,
      servicePackageId,
      notifyChannels: [...notifyChannels],
    });
    setShowModal(false);
  };

  return (
    <AppointmentCentralModalShell
      showModal={showModal}
      setShowModal={setShowModal}
      title="Hospitalizing Patient"
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
                options={unitOptions}
                defaultOption={unitId}
                onSelect={(option: DropdownOption) => setUnitId(option.value)}
              />
            </div>
          </div>

          {/* Right column: lead/support + service package + estimate */}
          <div className="flex flex-col gap-5">
            <StaffField label="Assigned Lead" name={leadName} />
            <LabelDropdown
              placeholder="Assigned Support"
              options={supportOptions}
              defaultOption={support}
              icon={<HiUser size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
              onSelect={(option: DropdownOption) => setSupport(option.value)}
            />
            <LabelDropdown
              placeholder="Additional Service / Package"
              options={servicePackages.map((pkg) => ({ label: pkg.name, value: pkg.id }))}
              defaultOption={servicePackageId}
              icon={<TiPlus size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
              onSelect={(option: DropdownOption) => setServicePackageId(option.value)}
            />
            <AppointmentEstimatePanel
              cost={selectedPackage?.cost}
              maxDiscount={selectedPackage?.maxDiscount}
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
            Convert to Inpatient
          </button>
        </div>
      </div>
    </AppointmentCentralModalShell>
  );
};

export default HospitalizationModal;
