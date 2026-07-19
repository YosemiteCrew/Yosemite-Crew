import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { LuClipboardList } from 'react-icons/lu';

type NativeSoapFieldsProps = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  terminologyText: (text: string) => string;
  onSubjectiveChange: (html: string) => void;
  onObjectiveChange: (html: string) => void;
  onAssessmentChange: (html: string) => void;
  onPlanChange: (html: string) => void;
  onRecordVitals: () => void;
};

const NativeSoapFields = ({
  subjective,
  objective,
  assessment,
  plan,
  terminologyText,
  onSubjectiveChange,
  onObjectiveChange,
  onAssessmentChange,
  onPlanChange,
  onRecordVitals,
}: NativeSoapFieldsProps) => (
  <>
    <SectionContainer
      titleClassName="text-[10.5px] font-bold uppercase tracking-[0.1em] text-blue-text"
      title="S · Subjective"
      compactTop
      disableFocusBorder
    >
      <RichTextEditor
        ariaLabel="Subjective history"
        value={subjective}
        readOnly={false}
        toolbarPlacement="inset"
        onChange={onSubjectiveChange}
        placeholder={terminologyText('Patient history and owner-reported information')}
      />
    </SectionContainer>

    <SectionContainer
      titleClassName="text-[10.5px] font-bold uppercase tracking-[0.1em] text-blue-text"
      title="O · Objective"
      compactTop
      disableFocusBorder
    >
      <RichTextEditor
        ariaLabel="Objective examination"
        value={objective}
        readOnly={false}
        toolbarPlacement="inset"
        onChange={onObjectiveChange}
        placeholder="Examination findings and recorded vitals"
      />
      <div className="mt-3 flex justify-end">
        <Secondary
          text="Record Vitals"
          onClick={onRecordVitals}
          icon={<LuClipboardList aria-hidden="true" />}
        />
      </div>
    </SectionContainer>

    <SectionContainer
      titleClassName="text-[10.5px] font-bold uppercase tracking-[0.1em] text-blue-text"
      title="A · Assessment"
      compactTop
      disableFocusBorder
    >
      <RichTextEditor
        ariaLabel="Assessment differential"
        value={assessment}
        readOnly={false}
        toolbarPlacement="inset"
        onChange={onAssessmentChange}
        placeholder="Diagnosis and differentials"
      />
    </SectionContainer>

    <SectionContainer
      titleClassName="text-[10.5px] font-bold uppercase tracking-[0.1em] text-blue-text"
      title="P · Plan"
      compactTop
      disableFocusBorder
    >
      <RichTextEditor
        ariaLabel="Plan"
        value={plan}
        readOnly={false}
        toolbarPlacement="inset"
        onChange={onPlanChange}
        placeholder="Treatment plan and next steps"
      />
    </SectionContainer>
  </>
);

export default NativeSoapFields;
