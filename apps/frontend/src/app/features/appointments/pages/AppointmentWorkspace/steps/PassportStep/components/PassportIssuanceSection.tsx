'use client';
import React, { useState } from 'react';
import type { IssuePassportRequestDTO, PetPassportIssuanceDTO } from '@yosemite-crew/types';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import SegmentedPill, {
  type SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { formatDisplayDate } from '@/app/lib/date';
import PassportIssuanceForm from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/PassportIssuanceForm';

type IssuingChoice = 'NO' | 'YES';

const ISSUING_CHOICE_OPTIONS: ReadonlyArray<SegmentedPillOption<IssuingChoice>> = [
  { value: 'NO', label: 'No' },
  { value: 'YES', label: 'Yes' },
];

const SECTION_TITLE = 'Passport issuance';

type IssuanceRow = { label: string; value: string };

const buildIssuanceRows = (issuance: PetPassportIssuanceDTO): IssuanceRow[] => {
  const rows: IssuanceRow[] = [{ label: 'Passport number', value: issuance.passportNumber }];
  const optionalRows: ReadonlyArray<[string, string | undefined]> = [
    ['Issuing country', issuance.issuingCountry],
    ['Issuing authority', issuance.issuingAuthority],
    ['Issuing practice', issuance.issuingPractice],
    ['Issuing vet', issuance.issuingVetName],
    ['Issuing vet licence', issuance.issuingVetLicense],
  ];
  for (const [label, value] of optionalRows) {
    if (value) rows.push({ label, value });
  }
  rows.push({
    label: 'Issue date',
    value: formatDisplayDate(issuance.issueDate, 'date not recorded'),
  });
  return rows;
};

const IssuedPassportDetails = ({ issuance }: { issuance: PetPassportIssuanceDTO }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
    {buildIssuanceRows(issuance).map((row) => (
      <div key={row.label} className="flex flex-col gap-0.5">
        <dt className="text-[11.5px] font-semibold text-(--ink-faint)">{row.label}</dt>
        <dd className="text-[13.5px] font-semibold text-(--ink-body)">{row.value}</dd>
      </div>
    ))}
  </dl>
);

type PassportIssuanceSectionProps = {
  companionName: string;
  issuance?: PetPassportIssuanceDTO;
  onIssue: (payload: IssuePassportRequestDTO) => Promise<void>;
};

/**
 * Issuing a passport is a deliberate act, not something every visit does, so the
 * step asks first and defaults to "No" - the issuance fields only exist once the
 * vet opts in. A companion that already holds a passport shows it read-only
 * instead of offering to issue a second one.
 */
const PassportIssuanceSection = ({
  companionName,
  issuance,
  onIssue,
}: PassportIssuanceSectionProps) => {
  const [issuingChoice, setIssuingChoice] = useState<IssuingChoice>('NO');

  if (issuance) {
    return (
      <SectionContainer
        title={SECTION_TITLE}
        titleSlot={<StatusPill label="Issued" tone="success" />}
      >
        <IssuedPassportDetails issuance={issuance} />
      </SectionContainer>
    );
  }

  return (
    <SectionContainer title={SECTION_TITLE}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-(--ink-body)">
            {`Are you issuing a pet passport for ${companionName} in this visit?`}
          </p>
          <SegmentedPill
            ariaLabel="Issuing a pet passport in this visit"
            options={ISSUING_CHOICE_OPTIONS}
            value={issuingChoice}
            onChange={setIssuingChoice}
          />
        </div>
        {issuingChoice === 'YES' ? (
          <PassportIssuanceForm onSubmit={onIssue} />
        ) : (
          <p className="text-[12.5px] leading-[140%] text-(--ink-muted)">
            No passport is being issued in this visit. Clinical records captured below are still
            saved against this encounter.
          </p>
        )}
      </div>
    </SectionContainer>
  );
};

export default PassportIssuanceSection;
