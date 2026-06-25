import Image from 'next/image';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatDisplayDate } from '@/app/lib/date';
import type { CompanionAlertSummary, CompanionCardDTO } from '@yosemite-crew/types';

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  horse: 'Equine',
  other: 'Other',
};

const SEVERITY_STYLE: Record<CompanionAlertSummary['severity'], string> = {
  critical: 'bg-warning-100 text-warning-700',
  high: 'bg-warning-100 text-warning-700',
  medium: 'bg-card-bg text-text-secondary',
  low: 'bg-card-bg text-text-secondary',
};

const neuteredLabel = (value?: boolean): string | undefined => {
  if (value === undefined) return undefined;
  return value ? 'Yes' : 'No';
};

const insuranceLabel = (insurance?: CompanionCardDTO['insurance']): string | undefined => {
  if (!insurance) return undefined;
  if (!insurance.isInsured) return 'Not insured';
  return insurance.companyName ?? 'Insured';
};

const dobLabel = (iso?: string): string | undefined => (iso ? formatDisplayDate(iso) : undefined);

type DetailRowProps = { label: string; value?: string | number };
const DetailRow = ({ label, value }: DetailRowProps) => {
  if (value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-caption-1 text-text-extra">{label}</span>
      <span className="text-caption-1 text-text-primary text-right">{value}</span>
    </div>
  );
};

type CompanionIdCardProps = { card: CompanionCardDTO };

const CompanionIdCard = ({ card }: CompanionIdCardProps) => {
  const { identity, medical, ownerContact, insurance, latestVisit, alerts } = card;
  const species = SPECIES_LABEL[identity.type] ?? 'Other';
  const ownerName = ownerContact
    ? [ownerContact.firstName, ownerContact.lastName].filter(Boolean).join(' ')
    : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-card-border bg-white p-5">
      <div className="flex items-center gap-3">
        <Image
          alt={identity.name}
          src={getSafeImageUrl(identity.photoUrl, identity.type as ImageType)}
          height={56}
          width={56}
          className="size-14 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <span className="text-body-3-emphasis text-text-primary">{identity.name}</span>
          <span className="text-caption-1 text-text-secondary">
            {`${identity.breed} / ${species}`}
          </span>
        </div>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((alert) => (
            <span
              key={`${alert.title}-${alert.severity}`}
              className={`rounded-full px-3 py-1 text-caption-1 ${SEVERITY_STYLE[alert.severity]}`}
            >
              {alert.title}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <DetailRow label="Microchip" value={identity.microchipNumber} />
        <DetailRow label="Passport" value={card.passportNumber} />
        <DetailRow label="Date of birth" value={dobLabel(card.dateOfBirth)} />
        <DetailRow label="Allergies" value={medical?.allergy} />
        <DetailRow label="Blood group" value={medical?.bloodGroup} />
        <DetailRow label="Weight (kg)" value={medical?.currentWeight} />
        <DetailRow label="Neutered" value={neuteredLabel(medical?.isNeutered)} />
        <DetailRow label="Insurance" value={insuranceLabel(insurance)} />
        <DetailRow label="Latest visit" value={latestVisit?.status} />
        <DetailRow label="Owner" value={ownerName} />
        <DetailRow label="Owner phone" value={ownerContact?.phoneNumber} />
        <DetailRow label="Owner email" value={ownerContact?.email} />
      </div>
    </div>
  );
};

export default CompanionIdCard;
