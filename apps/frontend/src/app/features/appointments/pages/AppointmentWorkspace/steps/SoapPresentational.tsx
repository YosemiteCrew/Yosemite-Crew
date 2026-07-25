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
  <div className="w-full">
    <span className="mb-1.5 block truncate text-[12.5px] font-semibold text-[var(--ink-soft)]">
      {label}
    </span>
    <div className="flex min-h-12 w-full items-center rounded-2xl border border-input-border-default bg-(--whitebg) px-5 py-2">
      <span
        className={`min-w-0 flex-1 truncate text-left text-body-4 ${value?.trim() ? 'text-text-primary' : 'text-input-text-placeholder'}`}
      >
        {value?.trim() || '-'}
      </span>
    </div>
  </div>
);

export const ChiefComplaintField = ({ value }: { value: string }) => (
  <div
    className="flex min-h-14 flex-col justify-center rounded-2xl px-5 py-4"
    style={{ background: 'var(--screen)' }}
  >
    <span
      className="mb-[5px] block text-[10.5px] font-bold uppercase tracking-[0.1em] leading-[120%]"
      style={{ color: 'var(--ink-faint)' }}
    >
      Chief complaint
    </span>
    <span className="text-[13.5px] leading-[1.55]" style={{ color: 'var(--ink-body)' }}>
      {value}
    </span>
  </div>
);
