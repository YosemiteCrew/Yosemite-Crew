import React, { useId, useRef, useState } from 'react';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { LuClipboardList } from 'react-icons/lu';
import type { SoapCodedProblems, SoapCodedSection, SoapCodedTerm } from '@yosemite-crew/types';
import SoapCodedTermPicker from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapCodedTermPicker';
import type {
  ClinicalTermDomain,
  ClinicalTermSpecies,
} from '@/app/features/appointments/services/clinicalTermsService';
import type { SoapTemplate } from '@/app/features/appointments/types/workspace';

/**
 * Vocabulary domain each section's picker narrows to. Subjective captures what the
 * owner reports (presenting complaints), Assessment holds diagnoses, and Plan holds
 * procedures; Objective spans exam findings and tests, so it searches every domain.
 */
const SECTION_DOMAIN: Partial<Record<SoapCodedSection, ClinicalTermDomain>> = {
  subjective: 'PresentingComplaint',
  assessment: 'Diagnosis',
  plan: 'Procedure',
};

type NativeSoapFieldsProps = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  templates: SoapTemplate[];
  codedProblems?: SoapCodedProblems;
  /** Species bucket for the coded-term pickers; omitted when there is no context. */
  codedTermSpecies?: ClinicalTermSpecies;
  terminologyText: (text: string) => string;
  onSubjectiveChange: (html: string) => void;
  onObjectiveChange: (html: string) => void;
  onAssessmentChange: (html: string) => void;
  onPlanChange: (html: string) => void;
  onCodedProblemsChange: (section: SoapCodedSection, terms: SoapCodedTerm[]) => void;
  onRecordVitals: () => void;
};

const SavedTextPicker = ({
  section,
  sectionLabel,
  templates,
  onInsert,
}: {
  section: SoapCodedSection;
  sectionLabel: string;
  templates: SoapTemplate[];
  onInsert: (html: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const options = templates.flatMap((template) => {
    const html = template.content?.[section];
    return html?.trim() ? [{ id: template.id, name: template.name, html }] : [];
  });
  // Shared by the trigger and every option (all native buttons): close when focus
  // leaves the picker, and on Escape hand focus back to the trigger.
  const closeOnBlur = (event: React.FocusEvent) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  };
  const closeOnEscape = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative text-caption-2">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Insert saved text into ${sectionLabel}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        onBlur={closeOnBlur}
        onKeyDown={closeOnEscape}
        className="cursor-pointer rounded-lg px-2 py-1 text-text-brand hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        Insert saved text
      </button>
      {open ? (
        <ul
          id={menuId}
          className="absolute right-0 top-full z-20 mt-1 max-h-56 min-w-48 overflow-y-auto rounded-xl border border-card-border bg-[var(--screen)] p-1 shadow-lg"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-text-secondary">No saved text for {sectionLabel}.</li>
          ) : (
            options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    onInsert(option.html);
                    setOpen(false);
                  }}
                  onBlur={closeOnBlur}
                  onKeyDown={closeOnEscape}
                  className="w-full rounded-lg px-3 py-2 text-left text-text-primary hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
                >
                  {option.name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
};

const NativeSoapFields = ({
  subjective,
  objective,
  assessment,
  plan,
  templates,
  codedProblems,
  codedTermSpecies,
  terminologyText,
  onSubjectiveChange,
  onObjectiveChange,
  onAssessmentChange,
  onPlanChange,
  onCodedProblemsChange,
  onRecordVitals,
}: NativeSoapFieldsProps) => {
  const nextInsertId = useRef(0);
  const [insertRequests, setInsertRequests] = useState<
    Partial<Record<SoapCodedSection, { id: number; html: string }>>
  >({});
  const handleInsert = (section: SoapCodedSection, html: string) => {
    nextInsertId.current += 1;
    const id = nextInsertId.current;
    setInsertRequests((current) => ({ ...current, [section]: { id, html } }));
  };
  const codedPicker = (section: SoapCodedSection, sectionLabel: string) => (
    <SoapCodedTermPicker
      sectionLabel={sectionLabel}
      domain={SECTION_DOMAIN[section]}
      species={codedTermSpecies}
      selected={codedProblems?.[section] ?? []}
      onChange={(terms) => onCodedProblemsChange(section, terms)}
    />
  );
  return (
    <>
      <SectionContainer
        titleClassName="text-[10.5px] font-bold uppercase tracking-[0.1em] text-blue-text"
        title="Subjective (History)"
        compactTop
        disableFocusBorder
      >
        <div className="mb-2 flex justify-end">
          <SavedTextPicker
            section="subjective"
            sectionLabel="Subjective history"
            templates={templates}
            onInsert={(html) => handleInsert('subjective', html)}
          />
        </div>
        <RichTextEditor
          ariaLabel="Subjective history"
          value={subjective}
          insertRequest={insertRequests.subjective}
          readOnly={false}
          onChange={onSubjectiveChange}
          placeholder={terminologyText('Patient history and owner-reported information')}
        />
        {codedPicker('subjective', 'Subjective')}
      </SectionContainer>

      <SectionContainer
        titleClassName="text-[10.5px] font-bold uppercase tracking-[0.1em] text-blue-text"
        title="Objective (Examination)"
        compactTop
        disableFocusBorder
      >
        <div className="mb-2 flex justify-end">
          <SavedTextPicker
            section="objective"
            sectionLabel="Objective examination"
            templates={templates}
            onInsert={(html) => handleInsert('objective', html)}
          />
        </div>
        <RichTextEditor
          ariaLabel="Objective examination"
          value={objective}
          insertRequest={insertRequests.objective}
          readOnly={false}
          onChange={onObjectiveChange}
          placeholder="Examination findings and recorded vitals"
        />
        {codedPicker('objective', 'Objective')}
        <div className="mt-3 flex justify-end">
          <Secondary
            text="Record vitals"
            onClick={onRecordVitals}
            icon={<LuClipboardList aria-hidden="true" />}
          />
        </div>
      </SectionContainer>

      <SectionContainer
        titleClassName="text-[10.5px] font-bold uppercase tracking-[0.1em] text-blue-text"
        title="Assessment (Differential)"
        compactTop
        disableFocusBorder
      >
        <div className="mb-2 flex justify-end">
          <SavedTextPicker
            section="assessment"
            sectionLabel="Assessment differential"
            templates={templates}
            onInsert={(html) => handleInsert('assessment', html)}
          />
        </div>
        <RichTextEditor
          ariaLabel="Assessment differential"
          value={assessment}
          insertRequest={insertRequests.assessment}
          readOnly={false}
          onChange={onAssessmentChange}
          placeholder="Diagnosis and differentials"
        />
        {codedPicker('assessment', 'Assessment')}
      </SectionContainer>

      <SectionContainer
        titleClassName="text-[10.5px] font-bold uppercase tracking-[0.1em] text-blue-text"
        title="Plan"
        compactTop
        disableFocusBorder
      >
        <div className="mb-2 flex justify-end">
          <SavedTextPicker
            section="plan"
            sectionLabel="Plan"
            templates={templates}
            onInsert={(html) => handleInsert('plan', html)}
          />
        </div>
        <RichTextEditor
          ariaLabel="Plan"
          value={plan}
          insertRequest={insertRequests.plan}
          readOnly={false}
          onChange={onPlanChange}
          placeholder="Treatment plan and next steps"
        />
        {codedPicker('plan', 'Plan')}
      </SectionContainer>
    </>
  );
};

export default NativeSoapFields;
