import React, { useState } from 'react';
import { IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';

export type PastItem = {
  id: string;
  /** Left-most label, e.g. "By Dr. Tim Apple". */
  title: string;
  /** Optional date column (green in the design). */
  date?: string;
  /** Optional time column. */
  time?: string;
  /** Expandable detail content (read-only). */
  detail?: React.ReactNode;
};

type PastItemsListProps = {
  title: string;
  items: PastItem[];
  emptyLabel?: string;
};

const PastRow = ({ item }: { item: PastItem }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-card-border last:border-0">
      <div className="flex items-center justify-between gap-4 py-3">
        <span className="text-body-4 font-medium text-text-primary">{item.title}</span>
        <div className="flex items-center gap-6">
          {item.date && <span className="text-body-4 text-pill-success-text">{item.date}</span>}
          {item.time && <span className="text-body-4 text-pill-success-text">{item.time}</span>}
          {item.detail && (
            <CircleIconButton
              icon={
                open ? (
                  <IoEyeOffOutline size={16} aria-hidden="true" />
                ) : (
                  <IoEyeOutline size={16} aria-hidden="true" />
                )
              }
              label={open ? `Hide ${item.title}` : `View ${item.title}`}
              variant="dark"
              onClick={() => setOpen((v) => !v)}
            />
          )}
        </div>
      </div>
      {open && item.detail && (
        <div className="pb-4 text-body-4 leading-[150%] text-text-secondary">{item.detail}</div>
      )}
    </li>
  );
};

/** Generic read-only "All <X>" list (SOAP notes, results, services, invoices…). */
const PastItemsList = ({
  title,
  items,
  emptyLabel = 'Nothing recorded yet.',
}: PastItemsListProps) => (
  <div className="flex flex-col gap-2">
    <h3 className="text-[16px] font-bold text-text-brand">{title}</h3>
    {items.length === 0 ? (
      <p className="py-4 text-body-4 text-text-secondary">{emptyLabel}</p>
    ) : (
      <ul className="rounded-2xl border border-card-border px-4">
        {items.map((item) => (
          <PastRow key={item.id} item={item} />
        ))}
      </ul>
    )}
  </div>
);

export default PastItemsList;
