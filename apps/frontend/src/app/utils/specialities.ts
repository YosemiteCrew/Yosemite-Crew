export const specialties = [
  {
    name: "Observational tools",
    services: [
      "Feline Grimace Scale",
      "Canine Acute Pain Scale",
      "Equine Grimace Scale"
    ],
  },
  {
    name: "General Practice",
    services: [
      "General Consult",
      "Vaccination & Booster Shots",
      "Health Certificate",
      "Puppy / Kitten Wellness Visit",
      "Senior Pet Wellness Exam",
      "Follow-up Consultation",
    ],
  },
  {
    name: "Surgery",
    services: [
      "General Consult",
      "Spay / Neuter",
      "Soft Tissue Surgery",
      "Orthopedic Surgery",
      "Wound or Abscess Treatment",
      "Mass / Lump Removal",
      "Foreign Body Removal",
    ],
  },
  {
    name: "Internal Medicine",
    services: [
      "General Consult",
      "Digestive Issues & Vomiting",
      "Kidney & Urinary Problems",
      "Liver Disease Management",
      "Endocrine Disorders (Diabetes / Thyroid)",
      "Respiratory & Lung Issues",
      "Chronic Illness Management",
    ],
  },
  {
    name: "Dermatology",
    services: [
      "General Consult",
      "Skin Allergy Testing",
      "Ear Infections",
      "Hair Loss / Itching Evaluation",
      "Flea & Parasite Control",
      "Rash or Hot Spot Treatment",
    ],
  },
  {
    name: "Dentistry",
    services: [
      "General Consult",
      "Dental Cleaning & Scaling",
      "Tooth Extraction",
      "Oral X-Rays",
      "Gum Disease Treatment",
      "Bad Breath Evaluation",
    ],
  },
  {
    name: "Radiology / Diagnostic Imaging",
    services: [
      "General Consult",
      "X-Ray",
      "Ultrasound",
      "CT / MRI Referral",
      "Pregnancy Scan",
      "Contrast Studies",
    ],
  },
  {
    name: "Emergency & Critical Care",
    services: [
      "General Consult",
      "Emergency Consultation",
      "Accident / Trauma Care",
      "Poisoning or Toxin Ingestion",
      "Seizure / Collapse Management",
      "Severe Bleeding or Shock",
    ],
  },
  {
    name: "Anesthesiology & Pain Management",
    services: [
      "General Consult",
      "Pre-Surgical Anesthesia",
      "Sedation for Imaging / Dentistry",
      "Pain Assessment & Therapy",
      "Post-Operative Pain Control",
      "Chronic Pain / Arthritis Care",
    ],
  },
  {
    name: "Reproduction / Theriogenology",
    services: [
      "General Consult",
      "Breeding Consultation",
      "Pregnancy Check / Ultrasound",
      "Artificial Insemination",
      "Fertility Testing",
      "Neonatal Care",
    ],
  },
  {
    name: "Ophthalmology",
    services: [
      "General Consult",
      "Eye Examination",
      "Red Eye / Discharge Evaluation",
      "Cataract Screening",
      "Glaucoma Testing",
      "Corneal Injury Treatment",
    ],
  },
  {
    name: "Cardiology",
    services: [
      "General Consult",
      "Heart Check-up",
      "Heart Murmur Evaluation",
      "ECG / Echocardiogram",
      "Blood Pressure Measurement",
      "Congestive Heart Failure Management",
    ],
  },
  {
    name: "Behavior & Training",
    services: [
      "General Consult",
      "Behavior Consultation",
      "Puppy Socialization",
      "Anxiety / Aggression Management",
      "Obedience Training",
      "House-Training Issues",
    ],
  },
  {
    name: "Nutrition & Dietetics",
    services: [
      "General Consult",
      "Diet Consultation",
      "Weight Management Plan",
      "Prescription Diet Setup",
      "Food Allergy Evaluation",
      "Feeding Guidelines",
    ],
  },
  {
    name: "Preventive / Wellness Medicine",
    services: [
      "General Consult",
      "Annual Health Check-up",
      "Vaccinations & Boosters",
      "Parasite Prevention",
      "Microchipping",
      "Wellness Blood Work",
      "Travel / Health Certification",
    ],
  },
];

export const specialtiesByKey = Object.fromEntries(
  specialties.map((s) => [s.name, s]),
);
