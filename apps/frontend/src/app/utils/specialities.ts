const GENERAL_CONSULT = "General Consult";

const withConsult = (...services: string[]) => [GENERAL_CONSULT, ...services];

export const specialties = [
  {
    name: "Observational tools",
    services: [
      "Feline Grimace Scale",
      "Canine Acute Pain Scale",
      "Equine Grimace Scale",
    ],
  },
  {
    name: "General Practice",
    services: withConsult(
      "Vaccination & Booster Shots",
      "Health Certificate",
      "Puppy / Kitten Wellness Visit",
      "Senior Companion Wellness Exam",
      "Follow-up Consultation"
    ),
  },
  {
    name: "Surgery",
    services: withConsult(
      "Spay / Neuter",
      "Soft Tissue Surgery",
      "Orthopedic Surgery",
      "Wound or Abscess Treatment",
      "Mass / Lump Removal",
      "Foreign Body Removal"
    ),
  },
  {
    name: "Internal Medicine",
    services: withConsult(
      "Digestive Issues & Vomiting",
      "Kidney & Urinary Problems",
      "Liver Disease Management",
      "Endocrine Disorders (Diabetes / Thyroid)",
      "Respiratory & Lung Issues",
      "Chronic Illness Management"
    ),
  },
  {
    name: "Dermatology",
    services: withConsult(
      "Skin Allergy Testing",
      "Ear Infections",
      "Hair Loss / Itching Evaluation",
      "Flea & Parasite Control",
      "Rash or Hot Spot Treatment"
    ),
  },
  {
    name: "Dentistry",
    services: withConsult(
      "Dental Cleaning & Scaling",
      "Tooth Extraction",
      "Oral X-Rays",
      "Gum Disease Treatment",
      "Bad Breath Evaluation"
    ),
  },
  {
    name: "Radiology / Diagnostic Imaging",
    services: withConsult(
      "X-Ray",
      "Ultrasound",
      "CT / MRI Referral",
      "Pregnancy Scan",
      "Contrast Studies"
    ),
  },
  {
    name: "Emergency & Critical Care",
    services: withConsult(
      "Emergency Consultation",
      "Accident / Trauma Care",
      "Poisoning or Toxin Ingestion",
      "Seizure / Collapse Management",
      "Severe Bleeding or Shock"
    ),
  },
  {
    name: "Anesthesiology & Pain Management",
    services: withConsult(
      "Pre-Surgical Anesthesia",
      "Sedation for Imaging / Dentistry",
      "Pain Assessment & Therapy",
      "Post-Operative Pain Control",
      "Chronic Pain / Arthritis Care"
    ),
  },
  {
    name: "Reproduction / Theriogenology",
    services: withConsult(
      "Breeding Consultation",
      "Pregnancy Check / Ultrasound",
      "Artificial Insemination",
      "Fertility Testing",
      "Neonatal Care"
    ),
  },
  {
    name: "Ophthalmology",
    services: withConsult(
      "Eye Examination",
      "Red Eye / Discharge Evaluation",
      "Cataract Screening",
      "Glaucoma Testing",
      "Corneal Injury Treatment"
    ),
  },
  {
    name: "Cardiology",
    services: withConsult(
      "Heart Check-up",
      "Heart Murmur Evaluation",
      "ECG / Echocardiogram",
      "Blood Pressure Measurement",
      "Congestive Heart Failure Management"
    ),
  },
  {
    name: "Behavior & Training",
    services: withConsult(
      "Behavior Consultation",
      "Puppy Socialization",
      "Anxiety / Aggression Management",
      "Obedience Training",
      "House-Training Issues"
    ),
  },
  {
    name: "Nutrition & Dietetics",
    services: withConsult(
      "Diet Consultation",
      "Weight Management Plan",
      "Prescription Diet Setup",
      "Food Allergy Evaluation",
      "Feeding Guidelines"
    ),
  },
  {
    name: "Preventive / Wellness Medicine",
    services: withConsult(
      "Annual Health Check-up",
      "Vaccinations & Boosters",
      "Parasite Prevention",
      "Microchipping",
      "Wellness Blood Work",
      "Travel / Health Certification"
    ),
  },
];

export const specialtiesByKey = Object.fromEntries(
  specialties.map((s) => [s.name, s]),
);
