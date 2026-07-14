import Image from 'next/image';
import { IoPencilOutline } from 'react-icons/io5';
import { MdPets } from 'react-icons/md';
import { FaUser } from 'react-icons/fa';
import clsx from 'clsx';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { StoredCompanion, StoredParent } from '@/app/features/companions/pages/Companions/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { RecordStatus } from '@yosemite-crew/types';
import { AlertChipView, InfoRow, SectionHeading } from './AddCompanionPresentational';
import { CompanionAlert } from '@/app/features/companions/components/AddCompanion/type';
import {
  STATUS_OPTIONS,
  fmt,
  fmtAge,
  fmtDate,
  getSexLabel,
  ModalMode,
} from './addCompanionCentralModalHelpers';
import { toTitleCase } from '@/app/lib/validators';

type AddCompanionViewModeProps = {
  canEditCompanionStatus: boolean;
  companion: StoredCompanion;
  companionAlerts: CompanionAlert[];
  companionTitle: string;
  displayStatus: RecordStatus;
  parent: StoredParent;
  parentAlerts: CompanionAlert[];
  savingStatus: boolean;
  speciesLabel: string;
  statusStyle: React.CSSProperties;
  terminologyText: (text: string) => string;
  onClose: () => void;
  onEdit: React.Dispatch<React.SetStateAction<ModalMode>>;
  onOpenOverview: () => void;
  onStatusChange: (status: RecordStatus) => void;
};

const AddCompanionViewMode = ({
  canEditCompanionStatus,
  companion,
  companionAlerts,
  companionTitle,
  displayStatus,
  parent,
  parentAlerts,
  savingStatus,
  speciesLabel,
  statusStyle,
  terminologyText,
  onClose,
  onEdit,
  onOpenOverview,
  onStatusChange,
}: AddCompanionViewModeProps) => (
  <>
    <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-card-border">
      <div className="flex items-center gap-3">
        <Image
          alt={companion.name}
          src={getSafeImageUrl(companion.photoUrl, companion.type.toLowerCase() as ImageType)}
          className="rounded-full object-cover shrink-0"
          height={48}
          width={48}
          style={{ width: 48, height: 48 }}
        />
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            className="text-[15px] font-semibold text-text-primary text-left hover:underline underline-offset-2 leading-tight"
            onClick={onOpenOverview}
          >
            {companionTitle}
          </button>
          <span className="text-[12px] text-text-secondary">
            {speciesLabel} · {fmt(companion.breed)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {canEditCompanionStatus ? (
          <div className={clsx('w-40', savingStatus && 'opacity-40 pointer-events-none')}>
            <LabelDropdown
              placeholder="Change status"
              options={STATUS_OPTIONS}
              defaultOption={displayStatus}
              onSelect={(option) => onStatusChange(option.value as RecordStatus)}
              portal
            />
          </div>
        ) : (
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold border"
            style={statusStyle}
          >
            {toTitleCase(displayStatus)}
          </span>
        )}

        <button
          type="button"
          onClick={() => onEdit('edit')}
          className="flex items-center gap-1.5 rounded-2xl border border-card-border px-3 h-9 text-[13px] font-medium text-text-primary hover:bg-card-hover transition-colors"
        >
          <IoPencilOutline size={14} />
          Edit
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0 lg:items-start">
      <div className="flex flex-col gap-3">
        <SectionHeading icon={<MdPets size={16} />} title={terminologyText('Patient Details')} />

        <div className="flex flex-col">
          <InfoRow label="Name" value={companion.name} />
          <InfoRow label="Species" value={speciesLabel} />
          <InfoRow label="Breed" value={fmt(companion.breed)} />
          <InfoRow label="DOB" value={fmtDate(companion.dateOfBirth)} />
          <InfoRow label="Age" value={fmtAge(companion.dateOfBirth)} />
          <InfoRow label="Sex" value={getSexLabel(companion.gender, companion.isneutered)} />
        </div>

        {companionAlerts.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
              Alerts
            </span>
            <div className="flex flex-wrap gap-2">
              {companionAlerts.map((alert) => (
                <AlertChipView key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}

        <Accordion
          title="Additional Details"
          defaultOpen={false}
          showEditIcon={false}
          titleClassName="text-body-4"
        >
          <div className="flex flex-col pt-1">
            {companion.colour && <InfoRow label="Color" value={fmt(companion.colour)} />}
            {companion.bloodGroup && (
              <InfoRow label="Blood group" value={fmt(companion.bloodGroup)} />
            )}
            {companion.currentWeight != null && (
              <InfoRow label="Weight (kg)" value={fmt(companion.currentWeight)} />
            )}
            {companion.countryOfOrigin && (
              <InfoRow label="Country of origin" value={fmt(companion.countryOfOrigin)} />
            )}
            {companion.microchipNumber && (
              <InfoRow label="Microchip" value={fmt(companion.microchipNumber)} />
            )}
            {companion.passportNumber && (
              <InfoRow label="Passport" value={fmt(companion.passportNumber)} />
            )}
            <InfoRow label="Insurance" value={companion.isInsured ? 'Insured' : 'Not insured'} />
            {companion.isInsured && (
              <>
                <InfoRow label="Insurance company" value={fmt(companion.insurance?.companyName)} />
                <InfoRow label="Policy number" value={fmt(companion.insurance?.policyNumber)} />
              </>
            )}
            {companion.allergy && <InfoRow label="Allergies" value={fmt(companion.allergy)} />}
          </div>
        </Accordion>
      </div>

      <div className="flex flex-col gap-3 lg:pl-8">
        <SectionHeading icon={<FaUser size={14} />} title="Client Details" />
        <div className="flex flex-col">
          <InfoRow
            label="Name"
            value={[parent.firstName, parent.lastName].filter(Boolean).join(' ')}
          />
          <InfoRow label="Email" value={fmt(parent.email)} />
          <InfoRow label="Phone" value={fmt(parent.phoneNumber)} />
          <InfoRow label="DOB" value={parent.birthDate ? fmtDate(parent.birthDate) : '-'} />
          <InfoRow label="Address" value={fmt(parent.address?.addressLine)} />
          <InfoRow label="City" value={fmt(parent.address?.city)} />
          <InfoRow label="State / Province" value={fmt(parent.address?.state)} />
          <InfoRow label="ZIP" value={fmt(parent.address?.postalCode)} />
        </div>

        {parentAlerts.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
              Alerts
            </span>
            <div className="flex flex-wrap gap-2">
              {parentAlerts.map((alert) => (
                <AlertChipView key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    <div className="flex items-center justify-end gap-3 pt-2 border-t border-card-border">
      <Secondary
        href="#"
        text="Close"
        onClick={(event) => {
          event?.preventDefault();
          onClose();
        }}
      />
    </div>
  </>
);

export default AddCompanionViewMode;
