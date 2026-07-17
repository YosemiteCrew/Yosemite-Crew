'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IoAddOutline,
  IoCheckmark,
  IoChevronDownOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
} from 'react-icons/io5';

export type SoapTemplateOption = {
  id: string;
  name: string;
  /** Small grey second line, e.g. "Clinic default · 4 sections". */
  subtitle?: string;
};

type SoapTemplateChipProps = {
  templates: SoapTemplateOption[];
  /** Name of the currently-applied template, shown on the closed chip + ticked in the list. */
  activeName?: string;
  onSelect: (templateId: string) => void;
  /** Optional "Manage templates" footer action. */
  onManage?: () => void;
  disabled?: boolean;
};

/**
 * SOAP note template chip with an open popover (design's "closed → open" micro-state).
 * The closed chip surfaces the active template name; the popover offers a search box
 * and a selectable list. Templates come from the encounter's real SOAP templates, with
 * a small built-in clinical set (Wellness / Sick visit / Recheck / Dental) as the
 * fallback when the org has none — a real, self-contained selector, not fabricated
 * backend data. Applying a template pre-fills the S/O/A/P sections.
 */
const SoapTemplateChip = ({
  templates,
  activeName,
  onSelect,
  onManage,
  disabled = false,
}: SoapTemplateChipProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    globalThis.document.addEventListener('mousedown', handlePointerDown);
    return () => globalThis.document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((template) => template.name.toLowerCase().includes(q));
  }, [query, templates]);

  const handleSelect = (templateId: string) => {
    onSelect(templateId);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-full border border-card-border px-3.5 py-1.5 text-caption-1 font-semibold text-text-primary transition-colors hover:bg-neutral-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        <IoDocumentTextOutline size={13} aria-hidden="true" className="text-text-tertiary" />
        Template: {activeName?.trim() || 'None'}
        <IoChevronDownOutline
          size={12}
          aria-hidden="true"
          className={`text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          aria-label="SOAP templates"
          className="absolute right-0 top-full z-30 mt-2 w-[330px] max-w-[80vw] overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_4px_12px_var(--sh08),0_18px_44px_var(--sh10)]"
        >
          <div className="border-b border-card-border p-3 pb-2.5">
            <span className="flex items-center gap-2 rounded-full border border-card-border bg-neutral-100 px-3 py-2 text-caption-1 text-text-tertiary">
              <IoSearchOutline size={13} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search SOAP templates"
                placeholder="Search SOAP templates"
                className="min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
              />
            </span>
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {matches.length === 0 ? (
              <li className="px-3.5 py-3 text-caption-1 text-text-secondary">
                No SOAP templates match this search.
              </li>
            ) : (
              matches.map((template) => {
                const isActive =
                  template.name.toLowerCase() === activeName?.trim().toLowerCase();
                return (
                  <li key={template.id}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleSelect(template.id)}
                      className={`flex w-full items-center gap-2 border-t border-card-border px-3.5 py-2.5 text-left first:border-t-0 hover:bg-neutral-100 ${
                        isActive ? 'bg-primary-100/40' : ''
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-caption-1 ${
                            isActive
                              ? 'font-bold text-text-primary'
                              : 'font-semibold text-text-primary'
                          }`}
                        >
                          {template.name}
                        </span>
                        {template.subtitle && (
                          <span className="block truncate text-caption-2 text-text-tertiary">
                            {template.subtitle}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <IoCheckmark
                          size={14}
                          aria-hidden="true"
                          className="shrink-0 text-text-brand"
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {onManage && (
            <button
              type="button"
              onClick={() => {
                onManage();
                setOpen(false);
              }}
              className="flex w-full items-center gap-1.5 border-t border-card-border px-3.5 py-2.5 text-left text-caption-1 font-semibold text-text-brand hover:bg-neutral-100"
            >
              <IoAddOutline size={12} aria-hidden="true" />
              Manage templates
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SoapTemplateChip;
