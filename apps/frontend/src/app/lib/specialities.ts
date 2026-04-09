const GENERAL_CONSULT = 'General Consult';
const ROW_DELIMITER = '\n';
const VALUE_DELIMITER = '|';
const SERVICE_DELIMITER = ';';
const INCLUDE_CONSULT_FLAG = 'consult';

const specialtyRows = `
Observational tools|Feline Grimace Scale;Canine Acute Pain Scale;Equine Grimace Scale
General Practice|Vaccination & Booster Shots;Health Certificate;Puppy / Kitten Wellness Visit;Senior Companion Wellness Exam;Follow-up Consultation|consult
Surgery|Spay / Neuter;Soft Tissue Surgery;Orthopedic Surgery;Wound or Abscess Treatment;Mass / Lump Removal;Foreign Body Removal|consult
Internal Medicine|Digestive Issues & Vomiting;Kidney & Urinary Problems;Liver Disease Management;Endocrine Disorders (Diabetes / Thyroid);Respiratory & Lung Issues;Chronic Illness Management|consult
Dermatology|Skin Allergy Testing;Ear Infections;Hair Loss / Itching Evaluation;Flea & Parasite Control;Rash or Hot Spot Treatment|consult
Dentistry|Dental Cleaning & Scaling;Tooth Extraction;Oral X-Rays;Gum Disease Treatment;Bad Breath Evaluation|consult
Radiology / Diagnostic Imaging|X-Ray;Ultrasound;CT / MRI Referral;Pregnancy Scan;Contrast Studies|consult
Emergency & Critical Care|Emergency Consultation;Accident / Trauma Care;Poisoning or Toxin Ingestion;Seizure / Collapse Management;Severe Bleeding or Shock|consult
Anesthesiology & Pain Management|Pre-Surgical Anesthesia;Sedation for Imaging / Dentistry;Pain Assessment & Therapy;Post-Operative Pain Control;Chronic Pain / Arthritis Care|consult
Reproduction / Theriogenology|Breeding Consultation;Pregnancy Check / Ultrasound;Artificial Insemination;Fertility Testing;Neonatal Care|consult
Ophthalmology|Eye Examination;Red Eye / Discharge Evaluation;Cataract Screening;Glaucoma Testing;Corneal Injury Treatment|consult
Cardiology|Heart Check-up;Heart Murmur Evaluation;ECG / Echocardiogram;Blood Pressure Measurement;Congestive Heart Failure Management|consult
Behavior & Training|Behavior Consultation;Puppy Socialization;Anxiety / Aggression Management;Obedience Training;House-Training Issues|consult
Nutrition & Dietetics|Diet Consultation;Weight Management Plan;Prescription Diet Setup;Food Allergy Evaluation;Feeding Guidelines|consult
Preventive / Wellness Medicine|Annual Health Check-up;Vaccinations & Boosters;Parasite Prevention;Microchipping;Wellness Blood Work;Travel / Health Certification|consult
`.trim();

const parseSpecialtyRow = (row: string) => {
  const [name, servicesValue, includeConsultFlag] = row.split(VALUE_DELIMITER);
  const services = servicesValue.split(SERVICE_DELIMITER);
  return {
    name,
    services:
      includeConsultFlag === INCLUDE_CONSULT_FLAG ? [GENERAL_CONSULT, ...services] : services,
  };
};

export const specialties = specialtyRows.split(ROW_DELIMITER).map(parseSpecialtyRow);

export const specialtiesByKey = Object.fromEntries(
  specialties.map((specialty) => [specialty.name, specialty])
);
