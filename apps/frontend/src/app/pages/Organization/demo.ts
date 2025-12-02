import { Speciality } from "@/app/types/org";
import { AvailabilityProps, Document, Room } from "./types";

export const demoSpecialities: Speciality[] = [
  {
    name: "General Practice",
    head: "Dr. Ananya Rao",
    staff: ["Dr. Karan Mehta", "Dr. Priya Singh", "Dr. Rohan Kulkarni"],
    services: [
      {
        name: "General Consult",
        description:
          "Routine health checkup and initial assessment for common issues.",
        duration: 20,
        charge: 600,
        maxDiscount: 10,
      },
      {
        name: "Vaccination & Booster Shots",
        description:
          "Core and optional vaccines based on age, lifestyle, and risk.",
        duration: 30,
        charge: 1200,
        maxDiscount: 15,
      },
      {
        name: "Health Certificate",
        description:
          "Official fitness certificate for travel, adoption, or boarding.",
        duration: 25,
        charge: 800,
        maxDiscount: 5,
      },
      {
        name: "Puppy / Kitten Wellness Visit",
        description: "Growth tracking, vaccines, and deworming for young pets.",
        duration: 30,
        charge: 1000,
        maxDiscount: 12,
      },
      {
        name: "Senior Pet Wellness Exam",
        description:
          "Comprehensive geriatric exam including joint and organ health review.",
        duration: 35,
        charge: 1500,
        maxDiscount: 10,
      },
      {
        name: "Follow-up Consultation",
        description: "Revisit for ongoing conditions or post-treatment review.",
        duration: 15,
        charge: 500,
        maxDiscount: 10,
      },
    ],
  },
  {
    name: "Surgery",
    head: "Dr. Nikhil Sharma",
    staff: ["Dr. Sneha Iyer", "Dr. Varun Desai"],
    services: [
      {
        name: "General Consult",
        description: "Pre-surgical evaluation and risk assessment.",
        duration: 20,
        charge: 700,
        maxDiscount: 8,
      },
      {
        name: "Spay / Neuter",
        description: "Routine sterilization surgery under general anesthesia.",
        duration: 90,
        charge: 4500,
        maxDiscount: 20,
      },
      {
        name: "Soft Tissue Surgery",
        description:
          "Non-orthopedic surgeries such as abdominal or skin procedures.",
        duration: 120,
        charge: 6500,
        maxDiscount: 18,
      },
      {
        name: "Orthopedic Surgery",
        description: "Bone and joint surgeries including fracture repair.",
        duration: 150,
        charge: 9000,
        maxDiscount: 15,
      },
      {
        name: "Wound or Abscess Treatment",
        description:
          "Cleaning, debridement, and dressing of wounds or abscesses.",
        duration: 45,
        charge: 2200,
        maxDiscount: 12,
      },
      {
        name: "Mass / Lump Removal",
        description: "Surgical excision of benign or suspicious growths.",
        duration: 75,
        charge: 5200,
        maxDiscount: 15,
      },
      {
        name: "Foreign Body Removal",
        description: "Removal of ingested or embedded foreign objects.",
        duration: 110,
        charge: 7800,
        maxDiscount: 15,
      },
    ],
  },
  {
    name: "Internal Medicine",
    head: "Dr. Ritu Jain",
    staff: ["Dr. Alok Verma", "Dr. Meera Nair"],
    services: [
      {
        name: "General Consult",
        description:
          "Detailed internal medicine evaluation and case history review.",
        duration: 30,
        charge: 900,
        maxDiscount: 10,
      },
      {
        name: "Digestive Issues & Vomiting",
        description:
          "Diagnostics and treatment for gastrointestinal disorders.",
        duration: 40,
        charge: 1800,
        maxDiscount: 12,
      },
      {
        name: "Kidney & Urinary Problems",
        description:
          "Evaluation of renal function and urinary tract conditions.",
        duration: 45,
        charge: 2100,
        maxDiscount: 15,
      },
      {
        name: "Liver Disease Management",
        description:
          "Long-term monitoring and treatment plans for liver disorders.",
        duration: 50,
        charge: 2300,
        maxDiscount: 15,
      },
      {
        name: "Endocrine Disorders (Diabetes / Thyroid)",
        description: "Hormonal imbalance workup, medication, and follow-up.",
        duration: 50,
        charge: 2500,
        maxDiscount: 18,
      },
      {
        name: "Respiratory & Lung Issues",
        description:
          "Management of cough, breathing issues, and lung infections.",
        duration: 40,
        charge: 1900,
        maxDiscount: 12,
      },
      {
        name: "Chronic Illness Management",
        description:
          "Ongoing treatment, rechecks, and adjustment of long-term therapies.",
        duration: 35,
        charge: 1700,
        maxDiscount: 15,
      },
    ],
  },
  {
    name: "Dermatology",
    head: "Dr. Kavya Menon",
    staff: ["Dr. Harsh Patel", "Dr. Shreya Kapoor"],
    services: [
      {
        name: "General Consult",
        description: "Initial skin and coat examination with basic management.",
        duration: 25,
        charge: 800,
        maxDiscount: 10,
      },
      {
        name: "Skin Allergy Testing",
        description: "Allergy evaluation using intradermal or blood tests.",
        duration: 60,
        charge: 3200,
        maxDiscount: 15,
      },
      {
        name: "Ear Infections",
        description: "Otoscopy, cleaning, and medication for ear diseases.",
        duration: 30,
        charge: 1400,
        maxDiscount: 10,
      },
      {
        name: "Hair Loss / Itching Evaluation",
        description:
          "Diagnosis of pruritus and alopecia with targeted therapy.",
        duration: 35,
        charge: 1600,
        maxDiscount: 12,
      },
      {
        name: "Flea & Parasite Control",
        description:
          "Planning and administration of anti-parasitic treatments.",
        duration: 20,
        charge: 900,
        maxDiscount: 15,
      },
      {
        name: "Rash or Hot Spot Treatment",
        description: "Localized treatment of inflamed, painful skin lesions.",
        duration: 30,
        charge: 1500,
        maxDiscount: 12,
      },
    ],
  },
  {
    name: "Dentistry",
    head: "Dr. Arjun Malhotra",
    staff: ["Dr. Sonali Bansal"],
    services: [
      {
        name: "General Consult",
        description: "Oral health assessment with basic dental advice.",
        duration: 20,
        charge: 750,
        maxDiscount: 10,
      },
      {
        name: "Dental Cleaning & Scaling",
        description:
          "Ultrasonic scaling with polishing under sedation or anesthesia.",
        duration: 70,
        charge: 3800,
        maxDiscount: 18,
      },
      {
        name: "Tooth Extraction",
        description: "Removal of damaged or infected teeth with pain control.",
        duration: 60,
        charge: 3200,
        maxDiscount: 15,
      },
      {
        name: "Oral X-Rays",
        description:
          "Dental radiographs to evaluate roots, jawbone, and hidden disease.",
        duration: 30,
        charge: 1600,
        maxDiscount: 10,
      },
      {
        name: "Gum Disease Treatment",
        description: "Management of gingivitis and periodontal disease.",
        duration: 50,
        charge: 2900,
        maxDiscount: 15,
      },
      {
        name: "Bad Breath Evaluation",
        description:
          "Workup to identify dental or systemic causes of halitosis.",
        duration: 25,
        charge: 1100,
        maxDiscount: 10,
      },
    ],
  },
];

export const getAllServiceNames = (specialities: Speciality[]): string[] => {
  return specialities.flatMap(s => (s.services || []).map(service => service.name));
};

export const flatServices = getAllServiceNames(demoSpecialities)

export const DemoTeam: AvailabilityProps[] = [
  {
    name: "Dr. Emily Johnson",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Veterinarian",
    speciality: "Surgery",
    todayAppointment: "8",
    weeklyWorkingHours: "40h",
    status: "Available",
  },
  {
    name: "Dr. Michael Brown",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Senior Vet",
    speciality: "Dentistry",
    todayAppointment: "5",
    weeklyWorkingHours: "38h",
    status: "On-Break",
  },
  {
    name: "Sarah Wilson",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Vet Assistant",
    speciality: "Animal Care",
    todayAppointment: "10",
    weeklyWorkingHours: "42h",
    status: "Available",
  },
  {
    name: "Dr. James Carter",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Veterinary Surgeon",
    speciality: "Orthopedics",
    todayAppointment: "6",
    weeklyWorkingHours: "45h",
    status: "In-Surgery",
  },
  {
    name: "Rachel Green",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Consultant Vet",
    speciality: "Dermatology",
    todayAppointment: "7",
    weeklyWorkingHours: "40h",
    status: "Available",
  },
];

export const demoRooms: Room[] = [
  {
    name: "Room 101",
    type: "Consultation",
    assignedSpeciality: "Cardiology",
    assignedStaff: "Dr. Alice Morgan",
  },
  {
    name: "Room 102",
    type: "Procedure",
    assignedSpeciality: "Dermatology",
    assignedStaff: "Dr. Brian Lee",
  },
  {
    name: "Room 201",
    type: "Diagnostics",
    assignedSpeciality: "Neurology",
    assignedStaff: "Dr. Sophia Patel",
  },
  {
    name: "Room 202",
    type: "Treatment",
    assignedSpeciality: "Orthopedics",
    assignedStaff: "Dr. Michael Ross",
  },
  {
    name: "Room 305",
    type: "Child Care",
    assignedSpeciality: "Pediatrics",
    assignedStaff: "Dr. Emma Johnson",
  },
];

export const demoDocuments: Document[] = [
  {
    title: "Cardiology Department Guidelines",
    description:
      "Standard procedures and care protocols for all cardiology-related cases.",
    date: "2024-01-12",
    lastUpdated: "2024-03-05",
  },
  {
    title: "Dermatology Equipment Checklist",
    description:
      "Updated list of essential tools and equipment used in dermatology procedures.",
    date: "2024-02-20",
    lastUpdated: "2024-02-28",
  },
  {
    title: "Neurology Case Review Report",
    description:
      "Summary and analysis of complex neurology cases handled this quarter.",
    date: "2024-03-01",
    lastUpdated: "2024-03-10",
  },
  {
    title: "Orthopedics Safety Protocols",
    description:
      "New safety measures for orthopedic surgeries and fracture treatments.",
    date: "2024-01-25",
    lastUpdated: "2024-02-15",
  },
  {
    title: "Pediatrics Vaccination Schedule",
    description:
      "Updated national immunization schedule for pediatric patients.",
    date: "2024-03-08",
    lastUpdated: "2024-03-09",
  },
];
