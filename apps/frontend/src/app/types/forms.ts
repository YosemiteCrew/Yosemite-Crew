import type {
  FieldOption,
  FieldType,
  Form as BackendForm,
  FormField as BackendFormField,
  Organisation,
} from "@yosemite-crew/types";

const formsCategories = [
  "Consent form",
  "SOAP-Subjective",
  "SOAP-Objective",
  "SOAP-Assessment",
  "SOAP-Plan",
  "Discharge",
  "Boarder - Boarding Checklist",
  "Boarder - Dietary Plan",
  "Boarder - Medication Details",
  "Boarder - Daily Summary",
  "Boarder - Schedule",
  "Boarder - Belongings",
  "Breeder - Health & Behavior",
  "Breeder - Mating Log",
  "Breeder - Consultation & Planning",
  "Breeder - Mating & Fertility Preferences",
  "Breeder - Belongings",
  "Breeder - Check-in",
  "Breeder - Pregnancy Care",
  "Breeder - Health Summary",
  "Groomer - Service Request & Preferences",
  "Groomer - Grooming Prep",
  "Groomer - Bathing & Cleaning Worklog",
  "Groomer - Haircut / Styling Worklog",
  "Groomer - Spa Add-ons Worklog",
  "Groomer - Health Requirements",
  "Custom",
] as const;

export type FormsCategory = (typeof formsCategories)[number];
export const FormsCategoryOptions: FormsCategory[] = [...formsCategories];

const formsUsageOptions = ["Internal", "External", "Internal & External"] as const;

export type FormsUsage = (typeof formsUsageOptions)[number];
export const FormsUsageOptions: FormsUsage[] = [...formsUsageOptions];

const formsStatuses = ["Published", "Draft", "Archived"] as const;

export type FormsStatus = (typeof formsStatuses)[number];
export const FormsStatusFilters: Array<FormsStatus | "All"> = [
  "All",
  ...formsStatuses,
];

export type FormFieldType = FieldType;

export type FormField = BackendFormField & {
  defaultValue?: any;
};

export type FormsProps = {
  _id?: string;
  orgId?: string;
  name: string;
  description?: string;
  services?: string[];
  species?: string[];
  category: FormsCategory;
  usage: FormsUsage;
  businessType?: Organisation["type"];
  updatedBy: string;
  lastUpdated: string;
  status?: FormsStatus;
  schema: FormField[];
};

const makeOption = (label: string, value?: string): FieldOption => ({
  label,
  value: value ?? label,
});

export const medicationRouteOptions = [
  "Oral",
  "Topical",
  "Injectable",
  "Rectal",
  "Ophthalmic",
  "Inhalation",
  "Otic",
  "Sublingual",
  "Buccal",
  "Intranasal",
  "IV",
  "IM",
  "SC",
].map((label) => makeOption(label));

export const buildMedicationFields = (
  prefix: string,
  separator: "_" | "-" = "_"
): FormField[] => {
  const join = (key: string) => `${prefix}${separator}${key}`;
  return [
    {
      id: join("name"),
      type: "input",
      label: "Name",
      placeholder: "Enter medicine name",
    },
    {
      id: join("dosage"),
      type: "input",
      label: "Dosage",
      placeholder: "Enter dosage",
    },
    {
      id: join("route"),
      type: "dropdown",
      label: "Route",
      options: medicationRouteOptions,
    },
    {
      id: join("frequency"),
      type: "input",
      label: "Frequency",
      placeholder: "Enter frequency",
    },
    {
      id: join("duration"),
      type: "input",
      label: "Duration",
      placeholder: "Enter duration",
    },
    {
      id: join("price"),
      type: "number",
      label: "Price",
      placeholder: "",
    },
    {
      id: join("remark"),
      type: "textarea",
      label: "Remark",
      placeholder: "Add remark",
    },
  ];
};

const buildMedicationGroup = (suffix: string, label: string): FormField => ({
  id: `medication_${suffix}`,
  type: "group",
  label,
  meta: { medicationGroup: true } as any,
  fields: buildMedicationFields(`medication_${suffix}`),
});

const buildServicesGroup = (): FormField => ({
  id: "services_group",
  type: "group",
  label: "Services",
  meta: { serviceGroup: true } as any,
  fields: [
    {
      id: "services_group_services",
      type: "checkbox",
      label: "", // Empty label to avoid duplicate "Services" text
      options: [],
      multiple: true,
    } as BackendFormField,
  ],
});

export const CategoryTemplates: Record<FormsCategory, FormField[]> = {
  Custom: [],
  "Consent form": [
    {
      id: "pet_name",
      type: "input",
      label: "Pet name",
      placeholder: "Enter pet name",
      required: true,
    },
    {
      id: "owner_name",
      type: "input",
      label: "Owner name",
      placeholder: "Enter owner name",
      required: true,
    },
    {
      id: "procedure",
      type: "textarea",
      label: "Procedure / treatment",
      placeholder: "Describe the procedure and purpose",
      required: true,
    },
    {
      id: "risks",
      type: "textarea",
      label: "Risks discussed",
      placeholder: "List key risks that were explained to the owner",
    },
    {
      id: "consent_ack",
      type: "checkbox",
      label: "Owner agrees to proceed",
      options: [makeOption("I have read and understood the above")],
      multiple: true,
    },
    {
      id: "consent_signature",
      type: "signature",
      label: "Owner signature",
      required: true,
    },
  ],
  "SOAP-Subjective": [
    {
      id: "subjective_history",
      type: "textarea",
      label: "Subjective (history)",
      placeholder: "Describe presenting concerns and history",
      required: true,
    },
  ],
  "SOAP-Objective": [
    {
      id: "general_behavior",
      type: "textarea",
      label: "General behavior",
      placeholder: "General behavior notes",
    },
    {
      id: "vitals",
      type: "group",
      label: "Vitals",
      fields: [
        {
          id: "temperature",
          type: "number",
          label: "Temperature",
          placeholder: "",
        },
        {
          id: "pulse",
          type: "input",
          label: "Pulse",
          placeholder: "Enter pulse",
        },
        {
          id: "respiration",
          type: "number",
          label: "Respiration",
          placeholder: "",
        },
        {
          id: "mucous_membrane_color",
          type: "input",
          label: "Mucous membrane color",
          placeholder: "Enter color",
        },
        {
          id: "blood_pressure",
          type: "input",
          label: "Blood pressure",
          placeholder: "Enter blood pressure",
        },
        {
          id: "body_weight",
          type: "input",
          label: "Body weight",
          placeholder: "Enter weight",
        },
        {
          id: "hydration_status",
          type: "input",
          label: "Hydration status",
          placeholder: "Describe hydration",
        },
        {
          id: "behavior_secondary",
          type: "input",
          label: "General behavior",
          placeholder: "Enter behavior",
        },
      ],
    },
    {
      id: "musculoskeletal_exam",
      type: "textarea",
      label: "Musculoskeletal Exam",
      placeholder: "Document findings",
    },
    {
      id: "neuro",
      type: "textarea",
      label: "Neuro",
      placeholder: "Document findings",
    },
    {
      id: "pain_score",
      type: "textarea",
      label: "Pain Score",
      placeholder: "Enter pain score details",
    },
  ],
  "SOAP-Assessment": [
    {
      id: "tentative_diagnosis",
      type: "textarea",
      label: "Tentative diagnosis",
      placeholder: "Enter tentative diagnosis",
    },
    {
      id: "differential_diagnosis",
      type: "textarea",
      label: "Differential diagnosis",
      placeholder: "List differential diagnoses",
    },
    {
      id: "prognosis",
      type: "textarea",
      label: "Prognosis",
      placeholder: "Enter prognosis",
    },
  ],
  "SOAP-Plan": [
    {
      id: "treatment_plan",
      type: "group",
      label: "Treatment / Plan",
      fields: [
        {
          id: "medications",
          type: "group",
          label: "Medications",
          meta: { medicationGroup: true } as any,
          fields: [],
        },
        buildServicesGroup(),
      ],
    },
    {
      id: "additional_notes",
      type: "textarea",
      label: "Additional notes",
      placeholder: "Add observations and owner instructions",
    },
    {
      id: "important_notes",
      type: "textarea",
      label: "Important notes",
      placeholder: "Highlight critical follow-up instructions",
    },
    {
      id: "signature",
      type: "signature",
      label: "Signature",
    },
  ],
  Discharge: [
    {
      id: "discharge_summary",
      type: "textarea",
      label: "Discharge summary",
      placeholder: "Summarize visit, findings and treatments provided.",
    },
    {
      id: "home_care",
      type: "textarea",
      label: "Home care instructions",
      placeholder: "Explain wound care, diet, activity restriction.",
    },
    {
      id: "medications",
      type: "textarea",
      label: "Medications",
      placeholder: "List medications, dosage, route, and schedule.",
    },
    {
      id: "follow_up",
      type: "date",
      label: "Follow-up date",
      placeholder: "Select next visit date",
    },
    {
      id: "discharge_signature",
      type: "signature",
      label: "Signature",
    },
  ],
  "Boarder - Boarding Checklist": [
    {
      id: "temperature_and_pulse_records",
      type: "group",
      label: "Temperature and pulse records",
      fields: [
        { id: "temp_readings", type: "input", label: "Temperature readings" },
        { id: "pulse_monitoring", type: "input", label: "Pulse monitoring" },
        { id: "respiration_rate", type: "input", label: "Respiration rate" },
      ],
    },
    {
      id: "boarding_options",
      type: "group",
      label: "Boarding options",
      fields: [
        {
          id: "day_boarding_services",
          type: "checkbox",
          label: "Day boarding services",
          multiple: true,
          options: [
            makeOption("Day care options", "day_care_options"),
            makeOption("Overnight stay details", "overnight_stay_details"),
            makeOption("Weekly boarding plans", "weekly_boarding_plans"),
          ],
        },
        {
          id: "overnight_boarding_services",
          type: "radio",
          label: "Overnight boarding services",
          options: [makeOption("Yes", "yes"), makeOption("No", "no")],
        },
        {
          id: "long_term_boarding",
          type: "radio",
          label: "Long-term boarding options",
          options: [makeOption("Yes", "yes"), makeOption("No", "no")],
        },
        {
          id: "special_needs_boarding",
          type: "radio",
          label: "Special needs boarding services",
          options: [makeOption("Yes", "yes"), makeOption("No", "no")],
        },
      ],
    },
    {
      id: "additional_services",
      type: "group",
      label: "Additional services and monitoring",
      fields: [
        {
          id: "cctv_live_updates",
          type: "radio",
          label: "CCTV and live updates",
          options: [makeOption("Yes", "yes"), makeOption("No", "no")],
        },
        {
          id: "health_checks_during_stay",
          type: "radio",
          label: "Health checks during stay",
          options: [makeOption("Yes", "yes"), makeOption("No", "no")],
        },
        {
          id: "pickup_dropoff",
          type: "checkbox",
          label: "Pickup and drop-off services",
          multiple: true,
          options: [
            makeOption("Pickup service", "pickup_service"),
            makeOption("Drop-Off service", "dropoff_service"),
            makeOption("Both services", "both_services"),
          ],
        },
      ],
    },
    {
      id: "comfort_environment",
      type: "group",
      label: "Comfort and environment",
      fields: [
        {
          id: "room_type_selection",
          type: "radio",
          label: "Room type selection",
          options: [
            makeOption("Standard room", "standard_room"),
            makeOption("Premium room", "premium_room"),
            makeOption("Suite room", "suite_room"),
          ],
        },
        {
          id: "playgroup_participation",
          type: "radio",
          label: "Playgroup participation options",
          options: [makeOption("Participate", "participate"), makeOption("Do not participate", "do_not_participate")],
        },
        {
          id: "bedding_preferences",
          type: "radio",
          label: "Bedding preferences",
          options: [
            makeOption("Facility bedding", "facility_bedding"),
            makeOption("Own bedding", "own_bedding"),
            makeOption("Orthopaedic bedding", "orthopaedic_bedding"),
          ],
        },
      ],
    },
  ],
  "Boarder - Dietary Plan": [
    {
      id: "dietary_type",
      type: "radio",
      label: "Dietary type",
      options: [
        makeOption("Commercial / Packaged Food", "commercial_packaged"),
        makeOption("Raw or Natural Diet", "raw_natural"),
        makeOption("Home-Cooked Meals", "home_cooked"),
        makeOption("Vegetarian / Vegan", "vegetarian_vegan"),
      ],
    },
    { id: "diet_special_notes", type: "textarea", label: "Special notes" },
    {
      id: "feeding_frequency",
      type: "radio",
      label: "Feeding frequency and timing",
      options: [
        makeOption("1x daily", "1x_daily"),
        makeOption("2x daily", "2x_daily"),
        makeOption("3x daily", "3x_daily"),
        makeOption("On-demand", "on_demand"),
      ],
    },
    { id: "specific_feeding_times", type: "textarea", label: "Specific feeding times" },
    {
      id: "portion_preferences",
      type: "radio",
      label: "Portion preferences",
      options: [
        makeOption("Fixed weight per meal (grams or cups)", "fixed_weight"),
        makeOption("“Until full” feeding", "until_full"),
        makeOption("Measured scoop or bowl (parent-defined)", "measured_scoop"),
      ],
    },
    { id: "portion_special_notes", type: "textarea", label: "Special notes" },
    { id: "brand_preferences", type: "textarea", label: "Brand preferences", placeholder: "Write brand names here" },
    {
      id: "feeding_method",
      type: "radio",
      label: "Feeding method preferences",
      options: [
        makeOption("Hand-feeding", "hand_feeding"),
        makeOption("Self-feeding bowl", "self_feeding"),
        makeOption("Separate feeding area (for anxious pets)", "separate_area"),
        makeOption("Eat with other pets", "eat_with_others"),
        makeOption("Heated / room-temperature food", "heated_or_room_temp"),
      ],
    },
    { id: "feeding_method_notes", type: "textarea", label: "Special notes" },
    {
      id: "treat_preferences",
      type: "checkbox",
      label: "Treat preferences",
      multiple: true,
      options: [
        makeOption("Jerky treats", "jerky"),
        makeOption("Dental sticks", "dental_sticks"),
        makeOption("Dehydrated meat", "dehydrated_meat"),
        makeOption("Homemade treats", "homemade"),
        makeOption("Training treats only", "training_only"),
        makeOption("No treats (parent restricted)", "no_treats"),
      ],
    },
    {
      id: "water_preferences",
      type: "radio",
      label: "Water preferences",
      options: [
        makeOption("Filtered / RO water only", "filtered_ro"),
        makeOption("Regular tap water", "tap_water"),
        makeOption("Bottled mineral water", "bottled_mineral"),
        makeOption("Mix with electrolytes", "electrolytes_mix"),
      ],
    },
    {
      id: "water_additional_info",
      type: "textarea",
      label: "Additional information: allergies and time of water supply.",
    },
  ],
  "Boarder - Medication Details": [
    { id: "medication_name", type: "input", label: "Medication name" },
    {
      id: "purpose_condition",
      type: "checkbox",
      label: "Purpose / Condition",
      multiple: true,
      options: [
        makeOption("Skin allergy", "skin_allergy"),
        makeOption("Arthritis", "arthritis"),
        makeOption("Pain relief", "pain_relief"),
      ],
    },
    {
      id: "form_type",
      type: "checkbox",
      label: "Form type",
      multiple: true,
      options: [
        makeOption("Capsule", "capsule"),
        makeOption("Tablet", "tablet"),
        makeOption("Ear drops", "ear_drops"),
        makeOption("Topical", "topical"),
        makeOption("Liquid", "liquid"),
        makeOption("Eye drops", "eye_drops"),
        makeOption("Injection", "injection"),
        makeOption("Inhalation", "inhalation"),
      ],
    },
    { id: "dosage", type: "input", label: "Dosage" },
    {
      id: "frequency",
      type: "radio",
      label: "Frequency",
      options: [
        makeOption("1x daily", "1x_daily"),
        makeOption("2x daily", "2x_daily"),
        makeOption("3x daily", "3x_daily"),
        makeOption("On-demand", "on_demand"),
      ],
    },
    { id: "timing_specific_hours", type: "input", label: "Timing (specific hours)" },
    {
      id: "given_with",
      type: "radio",
      label: "Given with",
      options: [
        makeOption("Food", "food"),
        makeOption("Milk", "milk"),
        makeOption("Empty stomach", "empty_stomach"),
        makeOption("Water", "water"),
      ],
    },
    {
      id: "prescribed_by_vet",
      type: "radio",
      label: "Prescribed by Vet",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    { id: "start_date", type: "date", label: "Start date" },
    { id: "end_date", type: "date", label: "End date" },
  ],
  "Boarder - Daily Summary": [
    { id: "summary_date", type: "date", label: "Daily summary date" },
    {
      id: "meals_provided",
      type: "radio",
      label: "Meals provided to pet",
      options: [
        makeOption("Administered 1x daily", "1x_daily"),
        makeOption("Administered 2x daily", "2x_daily"),
        makeOption("Administered 3x daily", "3x_daily"),
      ],
    },
    { id: "meals_additional_notes", type: "textarea", label: "Additional Notes / Activity report" },
    {
      id: "medication_administered",
      type: "radio",
      label: "Medication administered today",
      options: [makeOption("Scheduled time entry", "scheduled_time")],
    },
    { id: "medication_additional_notes", type: "textarea", label: "Additional Notes / Activity report" },
    {
      id: "daily_walk_completed",
      type: "radio",
      label: "Daily pet walk completed",
      options: [
        makeOption("Completed 1x", "1x"),
        makeOption("Completed 2x", "2x"),
        makeOption("Completed 3x", "3x"),
      ],
    },
    { id: "walk_additional_notes", type: "textarea", label: "Additional Notes / Activity report" },
    {
      id: "daily_exercise_completed",
      type: "radio",
      label: "Daily exercise completed",
      options: [
        makeOption("Completed 1x", "1x"),
        makeOption("Completed 2x", "2x"),
        makeOption("Completed 3x", "3x"),
      ],
    },
    { id: "exercise_additional_notes", type: "textarea", label: "Additional Notes / Activity report" },
    {
      id: "daily_poop_completed",
      type: "radio",
      label: "Daily pooping completed",
      options: [makeOption("Completed 1x", "1x"), makeOption("Completed 2x", "2x")],
    },
    { id: "poop_additional_notes", type: "textarea", label: "Additional Notes / Activity report" },
    { id: "pet_behavior_summary", type: "textarea", label: "Pet behavior summary" },
    { id: "additional_expense", type: "textarea", label: "Additional expense" },
  ],
  "Boarder - Schedule": [
    {
      id: "poop_frequency",
      type: "radio",
      label: "Poop frequency and timing",
      options: [
        makeOption("1x daily", "1x_daily"),
        makeOption("2x daily", "2x_daily"),
        makeOption("3x daily", "3x_daily"),
        makeOption("On-demand", "on_demand"),
      ],
    },
    { id: "poop_time_slot", type: "input", label: "Specific time slot" },
    {
      id: "walking_time",
      type: "radio",
      label: "Walking time",
      options: [
        makeOption("1x daily", "1x_daily"),
        makeOption("2x daily", "2x_daily"),
        makeOption("3x daily", "3x_daily"),
        makeOption("On-demand", "on_demand"),
      ],
    },
    { id: "walking_time_slot", type: "input", label: "Time slot" },
    { id: "exercise_time", type: "input", label: "Exercise time", placeholder: "Describe exercise / Add link" },
    {
      id: "exercise_frequency",
      type: "radio",
      label: "Exercise frequency",
      options: [
        makeOption("1x daily", "1x_daily"),
        makeOption("2x daily", "2x_daily"),
        makeOption("3x daily", "3x_daily"),
        makeOption("On-demand", "on_demand"),
      ],
    },
    { id: "exercise_time_slot", type: "input", label: "Time slot" },
  ],
  "Boarder - Belongings": [
    {
      id: "pet_bedding",
      type: "radio",
      label: "Pet bedding",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "food_bowl",
      type: "radio",
      label: "Food bowl",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "pet_leash",
      type: "radio",
      label: "Pet leash",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "litter_tray",
      type: "radio",
      label: "Litter tray",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    { id: "list_of_toys", type: "textarea", label: "List of toys" },
  ],
  "Breeder - Health & Behavior": [
    {
      id: "signs_of_stress",
      type: "radio",
      label: "Signs of stress",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "signs_of_discharge",
      type: "radio",
      label: "Signs of discharge",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "signs_of_injury",
      type: "radio",
      label: "Signs of injury",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "appetite_status",
      type: "radio",
      label: "Pet appetite status",
      options: [
        makeOption("Strong appetite", "strong_appetite"),
        makeOption("Picky appetite", "picky_appetite"),
        makeOption("Increased appetite", "increased_appetite"),
        makeOption("Normal appetite", "normal_appetite"),
        makeOption("Poor appetite", "poor_appetite"),
        makeOption("Not eating", "not_eating"),
      ],
    },
    {
      id: "behavior_status",
      type: "checkbox",
      label: "Pet behavior status",
      multiple: true,
      options: [
        makeOption("Friendly", "friendly"),
        makeOption("Nervous", "nervous"),
        makeOption("Aggressive", "aggressive"),
        makeOption("Alert", "alert"),
        makeOption("Defensive", "defensive"),
        makeOption("Highly anxious", "highly_anxious"),
      ],
    },
    {
      id: "energy_level",
      type: "radio",
      label: "Energy level",
      options: [
        makeOption("Energetic", "energetic"),
        makeOption("Lethargic", "lethargic"),
        makeOption("Weak", "weak"),
        makeOption("Normal", "normal"),
        makeOption("Overexcited", "overexcited"),
      ],
    },
    {
      id: "sleep_pattern",
      type: "radio",
      label: "Pet sleep pattern",
      options: [
        makeOption("Normal sleep", "normal_sleep"),
        makeOption("Lethargy", "lethargy"),
        makeOption("Sleeps well after activity", "sleeps_well_after_activity"),
        makeOption("Restless", "restless"),
        makeOption("Difficulty settling", "difficulty_settling"),
      ],
    },
  ],
  "Breeder - Mating Log": [
    { id: "mating_date", type: "date", label: "Tracking mating date" },
    { id: "mating_time", type: "input", label: "Tracking mating time" },
    {
      id: "natural_mating_process",
      type: "radio",
      label: "Utilised natural mating process",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "genetic_screening_completed",
      type: "radio",
      label: "Completed genetic screening",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "fertility_assessment_completed",
      type: "radio",
      label: "Completed fertility assessment",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "appetite_status",
      type: "radio",
      label: "Pet appetite status",
      options: [
        makeOption("Strong appetite", "strong_appetite"),
        makeOption("Picky appetite", "picky_appetite"),
        makeOption("Increased appetite", "increased_appetite"),
        makeOption("Normal appetite", "normal_appetite"),
        makeOption("Poor appetite", "poor_appetite"),
        makeOption("Not eating", "not_eating"),
      ],
    },
    {
      id: "behavior_status",
      type: "checkbox",
      label: "Pet behaviour status",
      multiple: true,
      options: [
        makeOption("Friendly", "friendly"),
        makeOption("Nervous", "nervous"),
        makeOption("Aggressive", "aggressive"),
        makeOption("Alert", "alert"),
        makeOption("Defensive", "defensive"),
        makeOption("Highly anxious", "highly_anxious"),
      ],
    },
    {
      id: "ultrasound_pregnancy_check",
      type: "radio",
      label: "Complete ultrasound / pregnancy check",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "birthing_assistance_provided",
      type: "radio",
      label: "Provided birthing assistance",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "neonatal_care_provided",
      type: "radio",
      label: "Provided neonatal / newborn care",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "record_keeping_completed",
      type: "radio",
      label: "Record keeping completed",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
  ],
  "Breeder - Consultation & Planning": [
    {
      id: "consultation_for_clients",
      type: "checkbox",
      label: "Breeding consultation for clients",
      multiple: true,
      options: [makeOption("Stud services", "stud_services"), makeOption("Breeding services", "breeding_services")],
    },
    {
      id: "heat_status_confirmation",
      type: "checkbox",
      label: "Confirm the female's heat status",
      multiple: true,
      options: [makeOption("Visual examination", "visual_examination"), makeOption("Progesterone testing", "progesterone_testing")],
    },
    { id: "fertile_phase_start_date", type: "date", label: "Tracking the fertile phase - Start date" },
    { id: "fertile_phase_end_date", type: "date", label: "Tracking the fertile phase - End date" },
    {
      id: "provide_list_of_potential_mates",
      type: "radio",
      label: "Provide a list of potential mates",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "preferred_vet_services_required",
      type: "radio",
      label: "Preferred veterinary services required",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    { id: "preferred_vet_details", type: "textarea", label: "If yes, specify veterinarian's details" },
  ],
  "Breeder - Mating & Fertility Preferences": [
    {
      id: "natural_mating",
      type: "radio",
      label: "Natural mating",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "artificial_insemination",
      type: "checkbox",
      label: "Artificial Insemination",
      multiple: true,
      options: [
        makeOption("Fresh semen", "fresh_semen"),
        makeOption("Chilled semen", "chilled_semen"),
        makeOption("Frozen semen", "frozen_semen"),
      ],
    },
    {
      id: "semen_collection_evaluation",
      type: "radio",
      label: "Semen collection and evaluation",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "genetic_screening",
      type: "checkbox",
      label: "Genetic screening",
      multiple: true,
      options: [
        makeOption("DNA testing", "dna_testing"),
        makeOption("Genetic disorder screening", "genetic_disorder_screening"),
        makeOption("Breed identification", "breed_identification"),
      ],
    },
    {
      id: "fertility_assessment",
      type: "radio",
      label: "Fertility assessment",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
  ],
  "Breeder - Belongings": [
    {
      id: "pet_bedding_or_blanket",
      type: "radio",
      label: "Pet bedding or blanket",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "pet_crate",
      type: "radio",
      label: "Pet crate",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "pet_leash",
      type: "radio",
      label: "Pet leash",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "litter_tray",
      type: "radio",
      label: "Litter tray",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    { id: "list_of_toys", type: "textarea", label: "List of toys" },
  ],
  "Breeder - Check-in": [
    { id: "body_temperature", type: "input", label: "Pet's body temperature" },
    {
      id: "appetite_status_checkin",
      type: "radio",
      label: "Pet's appetite status",
      options: [
        makeOption("Strong appetite", "strong_appetite"),
        makeOption("Normal appetite", "normal_appetite"),
        makeOption("Increased appetite", "increased_appetite"),
        makeOption("Refusing to eat", "refusing_to_eat"),
        makeOption("Selective appetite", "selective_appetite"),
        makeOption("Decreased appetite", "decreased_appetite"),
      ],
    },
    {
      id: "behavior_status_checkin",
      type: "checkbox",
      label: "Pet's behavior status",
      multiple: true,
      options: [
        makeOption("Friendly behavior", "friendly_behavior"),
        makeOption("Alert behavior", "alert_behavior"),
        makeOption("Nervous behavior", "nervous_behavior"),
        makeOption("Defensive behavior", "defensive_behavior"),
        makeOption("Aggressive behavior", "aggressive_behavior"),
        makeOption("Highly anxious behavior", "highly_anxious_behavior"),
      ],
    },
    {
      id: "confirm_female_heat_status",
      type: "checkbox",
      label: "Confirm female's heat status",
      multiple: true,
      options: [
        makeOption("Visual examination", "visual_examination"),
        makeOption("Progesterone testing", "progesterone_testing"),
      ],
    },
    { id: "heat_status_notes", type: "textarea", label: "Please provide additional information" },
  ],
  "Breeder - Pregnancy Care": [
    {
      id: "ultrasound_pregnancy_checks",
      type: "radio",
      label: "Ultrasound and pregnancy checks",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "birthing_assistance",
      type: "radio",
      label: "Birthing assistance",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "neonatal_newborn_care",
      type: "radio",
      label: "Neonatal and newborn care",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "record_keeping",
      type: "radio",
      label: "Record keeping",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "post_pregnancy_care",
      type: "radio",
      label: "Post-pregnancy care",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
  ],
  "Breeder - Health Summary": [{ id: "pet_health_summary", type: "textarea", label: "Pet health summary" }],
  "Groomer - Service Request & Preferences": [
    {
      id: "bathing_basic",
      type: "radio",
      label: "Given basic bath",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "bath_type",
      type: "radio",
      label: "Choose bath type",
      options: [
        makeOption("Basic", "basic"),
        makeOption("De-shedding", "de_shedding"),
        makeOption("Medicate", "medicate"),
        makeOption("Whitening", "whitening"),
      ],
    },
    {
      id: "ear_cleaning",
      type: "radio",
      label: "Given ear cleaning?",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "teeth_brushing",
      type: "radio",
      label: "Added teeth brushing",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "haircut_style",
      type: "radio",
      label: "Choose haircut style",
      options: [
        makeOption("Breed standard", "breed_standard"),
        makeOption("Summer cut", "summer_cut"),
        makeOption("Custom", "custom"),
      ],
    },
    {
      id: "de_shedding_treatment",
      type: "radio",
      label: "De-shedding treatment",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "conditioner_after_groom",
      type: "radio",
      label: "Given conditioner treatment after grooming",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    { id: "conditioner_brand", type: "input", label: "Specify conditioner brand" },
    {
      id: "dematting_detangling",
      type: "radio",
      label: "Dematting / Detangling",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "nail_trimming",
      type: "radio",
      label: "Nail trimming",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "paw_pad_cleaning",
      type: "radio",
      label: "Paw pad Cleaning",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "anal_gland_expression",
      type: "radio",
      label: "Anal gland expression",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "aromatherapy_bath",
      type: "radio",
      label: "Aromatherapy bath",
      options: [
        makeOption("Aromatherapy", "aromatherapy"),
        makeOption("Herbal", "herbal"),
        makeOption("Oatmeal", "oatmeal"),
      ],
    },
    {
      id: "tick_flea_treatment",
      type: "radio",
      label: "Tick and flea treatment",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "perfume_finishing_spray",
      type: "radio",
      label: "Perfume / Finishing spray",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
  ],
  "Groomer - Grooming Prep": [
    {
      id: "brushing_detangle_service",
      type: "radio",
      label: "Given brushing and detangle service to pet",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "nail_trimming_paw_cleaning",
      type: "radio",
      label: "Given nail trimming and paw cleaning",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "ear_cleaning_infection_check",
      type: "radio",
      label: "Given ear cleaning and infection check-up",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "medicated_bath_needed",
      type: "radio",
      label: "Does pet require medicated bath to prevent flea / tick",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "anal_gland_checked",
      type: "radio",
      label: "Anal gland checked",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "sanitary_area_trimming",
      type: "radio",
      label: "Given sanitary area trimming",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
  ],
  "Groomer - Bathing & Cleaning Worklog": [
    {
      id: "basic_bath_done",
      type: "radio",
      label: "Given basic bath",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "deshedding_done",
      type: "radio",
      label: "Given de-shedding treatment",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "rinse_conditioning_done",
      type: "radio",
      label: "Given thorough rinse and conditioning.",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "paw_pad_care_done",
      type: "radio",
      label: "Given paw pad cleaning and care",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
  ],
  "Groomer - Haircut / Styling Worklog": [
    {
      id: "drying_with_dryer",
      type: "radio",
      label: "Given drying with towel + pet dryer",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "parent_requested_styling_done",
      type: "radio",
      label: "Given parent-requested styling",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "clipping_shaping_fluff",
      type: "radio",
      label: "Given clipping, shaping, and fluff drying.",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
  ],
  "Groomer - Spa Add-ons Worklog": [
    {
      id: "final_brushing_done",
      type: "radio",
      label: "Given final brushing",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "tick_flea_treatment_done",
      type: "radio",
      label: "Given tick & flea treatment",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "parent_requested_styling_addon",
      type: "radio",
      label: "Given parent-requested styling",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "perfume_spray_done",
      type: "radio",
      label: "Given perfume / finishing spray",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "clean_fresh_collar",
      type: "radio",
      label: "Given clean and fresh collar",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
  ],
  "Groomer - Health Requirements": [
    {
      id: "grooming_history",
      type: "radio",
      label: "Has your pet received grooming services before?",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    {
      id: "allergies_or_skin_issues",
      type: "radio",
      label: "Does your pet suffer from any allergies or skin issues?",
      options: [makeOption("Yes", "yes"), makeOption("No", "no")],
    },
    { id: "allergy_details", type: "textarea", label: "If yes, please provide details" },
    {
      id: "preferred_coat_specs_image",
      type: "input",
      label: "Preferred coat specifications (image)",
      meta: { accept: "image/*", upload: true } as any,
    },
    { id: "preferred_coat_specs_notes", type: "input", label: "Please describe here" },
    { id: "wound_area_details", type: "input", label: "Specify wound area (if any)" },
  ],
};

export type BackendFormStatus = BackendForm["status"];
