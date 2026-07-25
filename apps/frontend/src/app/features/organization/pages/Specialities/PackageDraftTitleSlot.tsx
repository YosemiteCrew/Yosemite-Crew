import Badge from '@/app/ui/Badge';
import { LuBedSingle, LuCheck } from 'react-icons/lu';

type PackageDraftTitleSlotProps = {
  code?: string;
  isBookable: boolean;
  isInpatientPreferred: boolean;
};

const PackageDraftTitleSlot = ({
  code,
  isBookable,
  isInpatientPreferred,
}: PackageDraftTitleSlotProps) => (
  <>
    {code && (
      <span className="text-caption-1 text-text-secondary border border-card-border rounded-2xl px-3 py-1">
        {code}
      </span>
    )}
    {isBookable && (
      <Badge tone="brand">
        <LuCheck size={14} aria-hidden="true" />
        Bookable
      </Badge>
    )}
    {isInpatientPreferred && (
      <Badge tone="brand">
        <LuBedSingle size={14} aria-hidden="true" />
        In-patient
      </Badge>
    )}
  </>
);

export default PackageDraftTitleSlot;
