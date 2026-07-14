import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoIosWarning } from 'react-icons/io';
import { useFilteredOptions } from '@/app/hooks/useDropdown';
import {
  DROPDOWN_MAX_HEIGHT,
  DROPDOWN_MIN_HEIGHT,
  getInputBorderClass,
  SearchOption,
} from './addCompanionCentralModalHelpers';

/**
 * Text input whose value drives an async search.
 * Dropdown panel matches LabelDropdown styling exactly.
 * Rendered via portal so it is never clipped by overflow:hidden parents.
 * Option clicks use stopPropagation so the modal's outside-click listener never fires.
 */
const InputWithDropdown = ({
  value,
  inlabel,
  inname,
  onChange,
  onSelect,
  options,
  error,
}: {
  value: string;
  inlabel: string;
  inname: string;
  onChange: (v: string) => void;
  onSelect: (opt: SearchOption) => void;
  options: SearchOption[];
  error?: string;
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
  const uid = useId();
  // Only auto-open after the user has typed — prevents dropdown firing when
  // edit mode mounts with a pre-filled value that matches existing companions.
  const userHasTypedRef = useRef(false);

  const filtered = useFilteredOptions(options, value);

  // Close on outside mousedown — but never when target is inside the portal panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-iwd-panel]')) return;
      if (wrapRef.current && !wrapRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-open when results arrive, auto-close when empty — but only after user interaction
  const [prevFilteredLength, setPrevFilteredLength] = useState(filtered.length);
  if (filtered.length !== prevFilteredLength) {
    setPrevFilteredLength(filtered.length);
    if (userHasTypedRef.current) {
      setOpen(filtered.length > 0);
    }
  }

  const computeStyle = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const maxH = Math.min(DROPDOWN_MAX_HEIGHT, Math.max(DROPDOWN_MIN_HEIGHT, spaceBelow - 8));
    setPortalStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      top: rect.bottom - 1,
      maxHeight: maxH,
      zIndex: 5000,
    });
  }, []);

  const computeStyleRef = useRef(computeStyle);
  computeStyleRef.current = computeStyle;

  useLayoutEffect(() => {
    if (!open) {
      setPortalStyle(null);
      return;
    }
    computeStyleRef.current();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const stableResize = () => computeStyleRef.current();
    window.addEventListener('resize', stableResize);
    return () => window.removeEventListener('resize', stableResize);
  }, [open]);

  const handleSelect = (opt: SearchOption) => {
    onSelect(opt);
    setOpen(false);
  };

  const panel = (
    <div
      data-iwd-panel
      aria-label={inlabel}
      className="border-input-text-placeholder-active overflow-y-auto scrollbar-hidden rounded-b-2xl border border-t bg-white flex flex-col items-stretch px-3 py-2.5"
      style={portalStyle ?? undefined}
    >
      {filtered.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="px-5 py-3 text-left text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => handleSelect(opt)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      <div className="w-full relative" ref={wrapRef}>
        <input
          id={uid}
          type="text"
          name={inname}
          aria-label={inlabel}
          value={value}
          autoComplete="off"
          placeholder=" "
          onChange={(e) => {
            userHasTypedRef.current = true;
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (userHasTypedRef.current && filtered.length > 0) setOpen(true);
          }}
          aria-invalid={Boolean(error)}
          className={`
            peer w-full min-h-12 rounded-2xl bg-transparent px-6 py-2.5
            text-body-4 text-text-primary outline-none border
            ${open ? 'border-input-border-active! rounded-b-none! border-b-0!' : getInputBorderClass(error)}
          `}
        />
        <label
          htmlFor={uid}
          className={`
            pointer-events-none absolute left-4
            top-1/2 -translate-y-1/2
            max-w-[calc(100%-2rem)] truncate
            text-body-4 text-input-text-placeholder
            transition-all duration-200
            peer-focus:-top-2.75 peer-focus:translate-y-0
            peer-focus:text-xs! peer-focus:text-input-text-placeholder-active
            peer-focus:bg-(--whitebg) peer-focus:px-1.5 peer-focus:max-w-none
            peer-not-placeholder-shown:px-1.5 peer-not-placeholder-shown:max-w-none
            peer-not-placeholder-shown:-top-2.75 peer-not-placeholder-shown:translate-y-0
            peer-not-placeholder-shown:text-xs! peer-not-placeholder-shown:bg-(--whitebg)
          `}
        >
          {inlabel}
        </label>
        {open &&
          portalStyle &&
          typeof document !== 'undefined' &&
          createPortal(panel, document.body)}
      </div>
      {error && (
        <div className="mt-1.5 flex items-center gap-1 px-4 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default InputWithDropdown;
