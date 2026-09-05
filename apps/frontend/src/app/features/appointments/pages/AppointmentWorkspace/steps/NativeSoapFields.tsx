import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { LuClipboardList } from 'react-icons/lu';
import type { SoapCodedProblems, SoapCodedSection, SoapCodedTerm } from '@yosemite-crew/types';
import SoapCodedTermPicker from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapCodedTermPicker';
import type { ClinicalTermDomain } from '@/app/features/appointments/services/clinicalTermsService';

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
  codedProblems?: SoapCodedProblems;
  terminologyText: (text: string) => string;
  onSubjectiveChange: (html: string) => void;
  onObjectiveChange: (html: string) => void;
  onAssessmentChange: (html: string) => void;
  onPlanChange: (html: string) => void;
  onCodedProblemsChange: (section: SoapCodedSection, terms: SoapCodedTerm[]) => void;
  onRecordVitals: () => void;
};

const NativeSoapFields = ({
  subjective,
  objective,
  assessment,
  plan,
  codedProblems,
  terminologyText,
  onSubjectiveChange,
  onObjectiveChange,
  onAssessmentChange,
  onPlanChange,
  onCodedProblemsChange,
  onRecordVitals,
}: NativeSoapFieldsProps) => {
  const codedPicker = (section: SoapCodedSection, sectionLabel: string) => (
    <SoapCodedTermPicker
      sectionLabel={sectionLabel}
      domain={SECTION_DOMAIN[section]}
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
        <RichTextEditor
          ariaLabel="Subjective history"
          value={subjective}
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
        <RichTextEditor
          ariaLabel="Objective examination"
          value={objective}
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
        <RichTextEditor
          ariaLabel="Assessment differential"
          value={assessment}
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
        <RichTextEditor
          ariaLabel="Plan"
          value={plan}
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
