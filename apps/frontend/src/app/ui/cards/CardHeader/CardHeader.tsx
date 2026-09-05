'use client';
import React, { useEffect, useRef, useState } from 'react';
import { IoChevronDownOutline } from 'react-icons/io5';
import clsx from 'clsx';

type CardHeaderProps = {
  title: string;
  options: readonly string[];
  selected?: string;
  onSelect?: (option: string) => void;
  /**
   * 'card' (default) is the header that sits inside a stat card: 15px title with
   * an 11.5px period pill. 'section' is the larger page-section heading used by
   * Explore: 16px title with a 12px pill.
   */
  variant?: 'card' | 'section';
};

const CardHeader = ({ title, options, selected, onSelect, variant = 'card' }: CardHeaderProps) => {
  const [internalSelected, setInternalSelected] = useState<string>(options[0] ?? '');
  const [open, setOpen] = useState<boolean>(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const selectedValue = selected ?? internalSelected;

  const handleSelect = (option: string) => {
    setInternalSelected(option);
    onSelect?.(option);
    setOpen(false);
  };

  if (!selected && options.length > 0 && !options.includes(internalSelected)) {
    setInternalSelected(options[0]);
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isSection = variant === 'section';

  // The title is the flexible half: it wraps. The filter must not - without
  // min-w-0 + shrink-0 + a gap, a long title ("Appointment leaders") squeezes
  // against the filter until the two touch. Measured at 768 (tablet icon rail,
  // two stat columns): the title collapsed to 188px, wrapped onto a second line
  // and its right edge landed exactly on the filter's left edge - a 0px gap.
  return (
    <div className="flex items-center justify-between w-full gap-3">
      <div
        className={clsx(
          'min-w-0 font-bold leading-[1.15] tracking-[-0.02em] text-[var(--ink)]',
          isSection ? 'text-[16px]' : 'text-[15px]'
        )}
      >
        {title}
      </div>
      <div className="relative shrink-0" ref={filterRef}>
        <button
          type="button"
          onClick={() => setOpen((e) => !e)}
          aria-label={`Filter ${title} by time period: ${selectedValue}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={clsx(
            'outline-none inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] font-semibold text-[var(--ink-muted)]',
            isSection ? 'px-3 py-1.5 text-[12px]' : 'px-2.5 py-[5px] text-[11.5px]'
          )}
        >
          <span aria-hidden="true">{selectedValue}</span>
          <IoChevronDownOutline
            color="var(--ink-faint)"
            size={isSection ? 12 : 11}
            aria-hidden="true"
          />
        </button>
        {open && (
          <div
            aria-label={`Filter ${title} by time period`}
            className="bg-neutral-0 border border-card-border px-2 py-1 min-w-full whitespace-nowrap absolute top-[120%] right-0 flex flex-col rounded-2xl z-10 shadow-[0_6px_16px_var(--sh10),0_20px_48px_var(--sh12)]"
          >
            {options.map((option: string) => (
              <button
                type="button"
                aria-pressed={option === selectedValue}
                className="outline-none border-0 bg-neutral-0 hover:bg-card-hover! rounded-2xl! transition-colors duration-300 p-2"
                key={option}
                onClick={() => handleSelect(option)}
              >
                <span className="text-[12.5px] text-text-primary">{option}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CardHeader;
