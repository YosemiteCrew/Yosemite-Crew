const GENERAL_CONSULT = "General Consult";

type SpecialtyDef = {
  name: string;
  services: string[];
  includeConsult?: boolean;
};

const specialtyDefinitions: SpecialtyDef[] = [
  {
    name: "Observational tools",
    services: ["Feline Grimace Scale", "Canine Acute Pain Scale", "Equine Grimace Scale"],
  },
  {
    name: "General Practice",
    includeConsult: true,
    services: ["Vaccination & Booster Shots", "Health Certificate", "Puppy / Kitten Wellness Visit", "Senior Companion Wellness Exam", "Follow-up Consultation"],
  },
  {
    name: "Surgery",
    includeConsult: true,
    services: ["Spay / Neuter", "Soft Tissue Surgery", "Orthopedic Surgery", "Wound or Abscess Treatment", "Mass / Lump Removal", "Foreign Body Removal"],
  },
  {
    name: "Internal Medicine",
    includeConsult: true,
    services: ["Digestive Issues & Vomiting", "Kidney & Urinary Problems", "Liver Disease Management", "Endocrine Disorders (Diabetes / Thyroid)", "Respiratory & Lung Issues", "Chronic Illness Management"],
  },
  {
    name: "Dermatology",
    includeConsult: true,
    services: ["Skin Allergy Testing", "Ear Infections", "Hair Loss / Itching Evaluation", "Flea & Parasite Control", "Rash or Hot Spot Treatment"],
  },
  {
    name: "Dentistry",
    includeConsult: true,
    services: ["Dental Cleaning & Scaling", "Tooth Extraction", "Oral X-Rays", "Gum Disease Treatment", "Bad Breath Evaluation"],
  },
  {
    name: "Radiology / Diagnostic Imaging",
    includeConsult: true,
    services: ["X-Ray", "Ultrasound", "CT / MRI Referral", "Pregnancy Scan", "Contrast Studies"],
  },
  {
    name: "Emergency & Critical Care",
    includeConsult: true,
    services: ["Emergency Consultation", "Accident / Trauma Care", "Poisoning or Toxin Ingestion", "Seizure / Collapse Management", "Severe Bleeding or Shock"],
  },
  {
    name: "Anesthesiology & Pain Management",
    includeConsult: true,
    services: ["Pre-Surgical Anesthesia", "Sedation for Imaging / Dentistry", "Pain Assessment & Therapy", "Post-Operative Pain Control", "Chronic Pain / Arthritis Care"],
  },
  {
    name: "Reproduction / Theriogenology",
    includeConsult: true,
    services: ["Breeding Consultation", "Pregnancy Check / Ultrasound", "Artificial Insemination", "Fertility Testing", "Neonatal Care"],
  },
  {
    name: "Ophthalmology",
    includeConsult: true,
    services: ["Eye Examination", "Red Eye / Discharge Evaluation", "Cataract Screening", "Glaucoma Testing", "Corneal Injury Treatment"],
  },
  {
    name: "Cardiology",
    includeConsult: true,
    services: ["Heart Check-up", "Heart Murmur Evaluation", "ECG / Echocardiogram", "Blood Pressure Measurement", "Congestive Heart Failure Management"],
  },
  {
    name: "Behavior & Training",
    includeConsult: true,
    services: ["Behavior Consultation", "Puppy Socialization", "Anxiety / Aggression Management", "Obedience Training", "House-Training Issues"],
  },
  {
    name: "Nutrition & Dietetics",
    includeConsult: true,
    services: ["Diet Consultation", "Weight Management Plan", "Prescription Diet Setup", "Food Allergy Evaluation", "Feeding Guidelines"],
  },
  {
    name: "Preventive / Wellness Medicine",
    includeConsult: true,
    services: ["Annual Health Check-up", "Vaccinations & Boosters", "Parasite Prevention", "Microchipping", "Wellness Blood Work", "Travel / Health Certification"],
  },
];

export const specialties = specialtyDefinitions.map(({ name, services, includeConsult }) => ({
  name,
  services: includeConsult ? [GENERAL_CONSULT, ...services] : services,
}));

export const specialtiesByKey = Object.fromEntries(
  specialties.map((s) => [s.name, s]),
);
