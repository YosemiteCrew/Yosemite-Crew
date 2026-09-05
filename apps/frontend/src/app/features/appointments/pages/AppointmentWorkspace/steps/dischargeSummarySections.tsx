/**
 * The discharge-summary section of the summary step: its action bar, template
 * search bar, and the saved / editable renderings of the summary body.
 *
 * Split out of SummaryStep.tsx so each of these stays findable and hot-swappable
 * on its own instead of sitting inside a 1200-line step module
 * (react-doctor/no-multi-component-file).
 */
import React from 'react';
import {
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoPencilOutline,
  IoPrintOutline,
  IoSaveOutline,
  IoSearchOutline,
} from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import Search from '@/app/ui/inputs/Search';
import Datepicker from '@/app/ui/inputs/Datepicker';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import AutosaveIndicator from '@/app/features/appointments/pages/AppointmentWorkspace/components/AutosaveIndicator';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import WorkspaceSearchResultRow from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceSearchResultRow';
import { sanitizeRichText } from '@/app/lib/richText';
import type { TemplateLike } from '@yosemite-crew/types';
import type {
  AppointmentEncounter,
  WorkspaceSaveState,
} from '@/app/features/appointments/types/workspace';
import { formatDateTime } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/summaryStepFormat';

/**
 * Which document action the packet is up to: none until the summary is saved,
 * then Sign while it is unsigned and Download Signed once it is. One variant
 * rather than two flags, because only three of their four combinations exist.
 */
export type DischargeDocumentAction = 'none' | 'sign' | 'download';

type DischargeSignActionProps = {
  isSigning: boolean;
  signDisabled: boolean;
  signDisabledReason?: string;
  onSign: () => void;
};

/** The Sign button, wrapped in its explaining tooltip only while it is blocked. */
export const DischargeSignAction = ({
  isSigning,
  signDisabled,
  signDisabledReason,
  onSign,
}: DischargeSignActionProps) => {
  const signButton = (
    <Secondary
      text={isSigning ? 'Signing…' : 'Sign'}
      icon={<IoDocumentTextOutline aria-hidden="true" />}
      onClick={onSign}
      isDisabled={signDisabled}
    />
  );

  if (!signDisabledReason) return signButton;

  return (
    <GlassTooltip content={signDisabledReason} side="top">
      {signButton}
    </GlassTooltip>
  );
};

type DischargeActionBarProps = {
  signError: string | null;
  documentAction: DischargeDocumentAction;
  dischargeSaved: boolean;
  isPrinting: boolean;
  isSaving: boolean;
  isSigning: boolean;
  signDisabled: boolean;
  signDisabledReason?: string;
  viewOnly?: boolean;
  onPrint: () => void;
  onSave: () => void;
  onDownloadSigned: () => void;
  onSign: () => void;
};

/**
 * The discharge step's action row: print, save, and sign or download the signed
 * packet.
 *
 * Its own component because which buttons appear is genuinely conditional -
 * document actions only once the summary is saved, sign only while the packet
 * is unsigned, and a tooltip variant when signing is blocked - and that belongs
 * next to the buttons rather than inflating the step that renders them.
 */
export const DischargeActionBar = ({
  signError,
  documentAction,
  dischargeSaved,
  isPrinting,
  isSaving,
  isSigning,
  signDisabled,
  signDisabledReason,
  viewOnly,
  onPrint,
  onSave,
  onDownloadSigned,
  onSign,
}: DischargeActionBarProps) => (
  <div className="flex flex-col items-end gap-2">
    {signError && (
      <p role="alert" className="text-body-4 text-text-error">
        {signError}
      </p>
    )}
    <div className="flex flex-wrap items-center justify-end gap-3">
      {documentAction !== 'none' && (
        <Secondary
          text={isPrinting ? 'Preparing…' : 'Print All'}
          icon={<IoPrintOutline aria-hidden="true" />}
          onClick={onPrint}
          isDisabled={isPrinting}
        />
      )}
      {!dischargeSaved && (
        <Secondary
          text="Save"
          icon={<IoSaveOutline aria-hidden="true" />}
          onClick={onSave}
          isDisabled={viewOnly || isSaving}
        />
      )}
      {documentAction === 'download' && (
        <Secondary
          text="Download Signed"
          icon={<IoDownloadOutline aria-hidden="true" />}
          onClick={onDownloadSigned}
          isDisabled={isPrinting}
        />
      )}
      {documentAction === 'sign' && (
        <DischargeSignAction
          isSigning={isSigning}
          signDisabled={signDisabled}
          signDisabledReason={signDisabledReason}
          onSign={onSign}
        />
      )}
    </div>
  </div>
);

// Autosave state + discharge-template search. Owns the saved/hidden gate, the
// dropdown's open condition, and the no-matches / error branches so the step's
// own body carries none of them.
export const DischargeTemplateBar = ({
  saveState,
  searchRef,
  dischargeSaved,
  templateQuery,
  setTemplateQuery,
  templateError,
  templateMatches,
  onSelectTemplate,
}: {
  saveState?: WorkspaceSaveState;
  searchRef: React.RefObject<HTMLDivElement | null>;
  dischargeSaved: boolean;
  templateQuery: string;
  setTemplateQuery: React.Dispatch<React.SetStateAction<string>>;
  templateError: string | null;
  templateMatches: TemplateLike[];
  onSelectTemplate: (template: TemplateLike) => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <AutosaveIndicator status={saveState?.status ?? 'idle'} savedAt={saveState?.at} />
    {/* Hidden once the summary is saved: the saved view is read-only,
        and offering a control that cannot apply is worse than not
        offering it. Reopening the summary brings it back. */}
    <div
      ref={searchRef}
      className={`relative w-full sm:max-w-90 ${dischargeSaved ? 'hidden' : ''}`}
    >
      <Search
        value={templateQuery}
        setSearch={setTemplateQuery}
        placeholder="Search discharge templates"
        label="Search discharge templates"
        className="w-full!"
      />
      <SearchResultsDropdown
        anchorRef={searchRef}
        open={Boolean(templateQuery.trim()) && !templateError}
        onClose={() => setTemplateQuery('')}
      >
        {templateMatches.length > 0 ? (
          <ul>
            {templateMatches.map((template) => (
              <WorkspaceSearchResultRow
                key={template.id}
                name={template.name}
                leadingIcon={<IoSearchOutline aria-hidden="true" className="shrink-0" />}
                onSelect={() => onSelectTemplate(template)}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-body-4 text-text-secondary">
            No discharge templates match this search.
          </p>
        )}
      </SearchResultsDropdown>
      {templateError && <p className="mt-2 text-caption-1 text-text-error">{templateError}</p>}
    </div>
  </div>
);

// Read-only render of a saved discharge summary: sanitized body, a locked
// follow-up date, and the "saved by / at" stamp. The Edit pencil is offered
// only while the encounter itself is still editable.
export const SavedDischargeSummary = ({
  encounter,
  followUpDate,
  onReopen,
}: {
  encounter: AppointmentEncounter;
  followUpDate: Date | null;
  onReopen: () => void;
}) => (
  <div className="relative">
    {/* Editable until the encounter is locked (window closed / completed /
    discharged). Absolutely positioned so it overlays the top-right
    without pushing the summary down a row. */}
    {!encounter.viewOnly && (
      <div className="absolute top-0 right-0 z-10">
        <CircleIconButton
          icon={<IoPencilOutline aria-hidden="true" />}
          label="Edit discharge summary"
          variant="dark"
          onClick={onReopen}
        />
      </div>
    )}
    <div
      className="text-body-4 leading-[150%] text-text-primary [&_li]:my-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 sm:pr-12"
      dangerouslySetInnerHTML={{
        __html: sanitizeRichText(encounter.dischargeSummary ?? '') || '-',
      }}
    />
    <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
      {/* Same Datepicker container as edit mode, rendered non-interactive.
      Dimmed to match the other read-only state below: without it the
      field still reads as an editable input, so the date looks broken
      rather than locked (the Edit pencil above reopens it). */}
      <div
        className="pointer-events-none w-full select-none opacity-60 sm:max-w-72"
        aria-disabled="true"
      >
        <Datepicker
          type="input"
          currentDate={followUpDate}
          setCurrentDate={() => undefined}
          placeholder="Follow up date"
        />
      </div>
      <div className="flex flex-col items-end leading-[120%]">
        <span className="text-[12px] font-bold text-neutral-900">
          Saved by {encounter.dischargeSavedByName}
        </span>
        <span className="text-[12px] font-medium text-blue-text">
          {formatDateTime(encounter.dischargeSavedAt ?? '')}
        </span>
      </div>
    </div>
  </div>
);

// Editable discharge summary: rich-text body plus the follow-up date, both
// dimmed and non-interactive while the encounter is read-only.
export const DischargeSummaryEditor = ({
  value,
  readOnly,
  followUpDate,
  onChange,
  onFollowUpChange,
}: {
  value: string;
  readOnly: boolean;
  followUpDate: Date | null;
  onChange: (html: string) => void;
  onFollowUpChange: (next: Date | null) => void;
}) => (
  <>
    <RichTextEditor
      ariaLabel="Discharge summary"
      value={value}
      readOnly={readOnly}
      onChange={onChange}
      placeholder="Discharge instructions and follow-up care"
    />
    <div className="mt-3 flex justify-end">
      <div
        className={`w-full sm:max-w-72 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}
        aria-disabled={readOnly}
      >
        <Datepicker
          type="input"
          currentDate={followUpDate}
          setCurrentDate={onFollowUpChange as React.Dispatch<React.SetStateAction<Date | null>>}
          placeholder="Follow up date"
        />
      </div>
    </div>
  </>
);
