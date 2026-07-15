import { IoArrowForward } from 'react-icons/io5';
import { Primary } from '@/app/ui/primitives/Buttons';

export const SoapSignActions = ({
  disabled,
  onSaveAndNext,
}: {
  disabled: boolean;
  onSaveAndNext: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-end gap-3">
    <Primary
      text="Save & Next"
      onClick={onSaveAndNext}
      isDisabled={disabled}
      icon={<IoArrowForward aria-hidden="true" />}
      iconPosition="right"
    />
  </div>
);

export const SoapContextField = ({ label, value }: { label: string; value?: string }) => (
  <div className="relative w-full">
    <div className="relative flex min-h-12 w-full items-center rounded-2xl border border-input-border-default bg-(--whitebg) px-5 py-2">
      <span
        className={`min-w-0 flex-1 truncate text-left text-body-4 ${value?.trim() ? 'text-text-primary' : 'text-input-text-placeholder'}`}
      >
        {value?.trim() || '-'}
      </span>
    </div>
    <span className="pointer-events-none absolute -top-2 left-5 z-10 bg-(--whitebg) px-1 text-caption-2 text-text-secondary">
      {label}
    </span>
  </div>
);

export const ChiefComplaintField = ({ value }: { value: string }) => (
  <div className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-input-border-default px-5 py-4">
    <span className="shrink-0 text-yc-16-r-neutral font-bold">Chief Complaint</span>
    <span className="min-w-0 overflow-x-auto whitespace-nowrap text-right text-yc-16-r-neutral">
      {value}
    </span>
  </div>
);
