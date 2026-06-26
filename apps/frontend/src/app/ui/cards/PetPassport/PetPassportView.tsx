import Image from 'next/image';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatDisplayDate } from '@/app/lib/date';
import type { ClinicalExamDTO, PetPassportDTO, VaccinationDTO } from '@yosemite-crew/types';

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  horse: 'Equine',
  other: 'Other',
};

const dateLabel = (iso?: string): string | undefined => (iso ? formatDisplayDate(iso) : undefined);

const TREATMENT_LABEL: Record<string, string> = {
  ECHINOCOCCUS: 'Tapeworm',
  TICK: 'Tick',
  FLEA: 'Flea',
  OTHER: 'Other',
};

const clinicalExamDetail = (exam: ClinicalExamDTO): string =>
  [
    exam.examiningVetName,
    exam.weightKg === undefined ? undefined : `${exam.weightKg} kg`,
    exam.temperatureC === undefined ? undefined : `${exam.temperatureC}°C`,
    exam.findings,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

type RowProps = { label: string; value?: string | number };
const Row = ({ label, value }: RowProps) => {
  if (value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-caption-1 text-text-extra">{label}</span>
      <span className="text-caption-1 text-text-primary text-right">{value}</span>
    </div>
  );
};

type SectionProps = { title: string; children: React.ReactNode };
const Section = ({ title, children }: SectionProps) => (
  <div className="flex flex-col gap-2">
    <span className="text-caption-1 font-medium text-text-secondary">{title}</span>
    {children}
  </div>
);

const VaccinationItem = ({ vaccination }: { vaccination: VaccinationDTO }) => {
  const given = dateLabel(vaccination.dateAdministered);
  const batch = vaccination.batchNumber ? ` · Batch ${vaccination.batchNumber}` : '';
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-card-border p-3">
      <div className="flex justify-between gap-3">
        <span className="text-caption-1 text-text-primary">{vaccination.vaccineName}</span>
        {vaccination.validUntil && (
          <span className="text-caption-1 text-text-secondary">
            {`Valid to ${formatDisplayDate(vaccination.validUntil)}`}
          </span>
        )}
      </div>
      <span className="text-caption-1 text-text-extra">{`Given ${given}${batch}`}</span>
    </div>
  );
};

type PetPassportViewProps = { passport: PetPassportDTO };

const PetPassportView = ({ passport }: PetPassportViewProps) => {
  const {
    identity,
    microchip,
    rabies,
    vaccinations,
    parasiteTreatments,
    rabiesTitrations,
    clinicalExams,
  } = passport;
  const species = SPECIES_LABEL[identity.species] ?? 'Other';

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-card-border bg-white p-5">
      <div className="flex items-center gap-3">
        <Image
          alt={identity.name}
          src={getSafeImageUrl(identity.photoUrl, identity.species as ImageType)}
          height={56}
          width={56}
          className="size-14 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <span className="text-body-3-emphasis text-text-primary">{identity.name}</span>
          <span className="text-caption-1 text-text-secondary">
            {`${identity.breed} / ${species}`}
          </span>
        </div>
      </div>

      {passport.owner && (
        <Section title="Owner">
          <Row label="Name" value={passport.owner.name} />
          <Row label="Email" value={passport.owner.email} />
          <Row label="Phone" value={passport.owner.phone} />
        </Section>
      )}

      <Section title="Description">
        <Row label="Sex" value={identity.sex} />
        <Row label="Date of birth" value={dateLabel(identity.dateOfBirth)} />
        <Row label="Colour" value={identity.colour} />
        <Row label="Distinguishing marks" value={identity.distinguishingMarks} />
        <Row label="Passport no." value={passport.passportNumber} />
      </Section>

      {microchip && (
        <Section title="Identification">
          <Row label="Microchip" value={microchip.number} />
          <Row label="Implanted" value={dateLabel(microchip.implantedAt)} />
          <Row label="Location" value={microchip.location} />
        </Section>
      )}

      {rabies && (
        <Section title="Rabies vaccination">
          <VaccinationItem vaccination={rabies} />
        </Section>
      )}

      {vaccinations.length > 0 && (
        <Section title="Other vaccinations">
          <div className="flex flex-col gap-2">
            {vaccinations.map((vaccination) => (
              <VaccinationItem key={vaccination.id} vaccination={vaccination} />
            ))}
          </div>
        </Section>
      )}

      {parasiteTreatments.length > 0 && (
        <Section title="Parasite treatments">
          <div className="flex flex-col gap-2">
            {parasiteTreatments.map((treatment) => (
              <div
                key={treatment.id}
                className="flex flex-col gap-1 rounded-xl border border-card-border p-3"
              >
                <span className="text-caption-1 text-text-primary">{treatment.productName}</span>
                <span className="text-caption-1 text-text-extra">
                  {`${TREATMENT_LABEL[treatment.treatmentType] ?? treatment.treatmentType} · ${formatDisplayDate(treatment.treatedAt)}`}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {rabiesTitrations.length > 0 && (
        <Section title="Rabies titration">
          <div className="flex flex-col gap-2">
            {rabiesTitrations.map((titration) => (
              <div
                key={titration.id}
                className="flex justify-between gap-3 rounded-xl border border-card-border p-3"
              >
                <span className="text-caption-1 text-text-primary">{titration.approvedLab}</span>
                <span className="text-caption-1 text-text-secondary">
                  {`${titration.resultIuMl} IU/ml · ${formatDisplayDate(titration.sampleDate)}`}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {clinicalExams.length > 0 && (
        <Section title="Clinical examination">
          <div className="flex flex-col gap-2">
            {clinicalExams.map((exam) => {
              const detail = clinicalExamDetail(exam);
              return (
                <div
                  key={exam.id}
                  className="flex flex-col gap-1 rounded-xl border border-card-border p-3"
                >
                  <div className="flex justify-between gap-3">
                    <span className="text-caption-1 text-text-primary">
                      {exam.fitForTravel ? 'Fit to travel' : 'Not fit to travel'}
                    </span>
                    <span className="text-caption-1 text-text-secondary">
                      {formatDisplayDate(exam.examinedAt)}
                    </span>
                  </div>
                  {detail && <span className="text-caption-1 text-text-extra">{detail}</span>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {passport.issuance && (
        <Section title="Issued by">
          <Row label="Issuing vet" value={passport.issuance.issuingVetName} />
          <Row label="Practice" value={passport.issuance.issuingPractice} />
          <Row label="Authority" value={passport.issuance.issuingAuthority} />
          <Row label="Country" value={passport.issuance.issuingCountry} />
          <Row label="Issue date" value={dateLabel(passport.issuance.issueDate)} />
        </Section>
      )}

      <span className="text-caption-1 text-text-extra">
        Digital health record. Not a legal substitute for the official EU pet passport, UK Animal
        Health Certificate, or USDA/CDC certificate required for international travel.
      </span>
    </div>
  );
};

export default PetPassportView;
