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

export type RequiredSigner = BackendForm["requiredSigner"];
export type RequiredSignerValue = "CLIENT" | "VET" | "";

export const RequiredSignerOptions: Array<{
  label: string;
  value: RequiredSignerValue;
}> = [
  { label: "No signature required", value: "" },
  { label: "Pet parent", value: "CLIENT" },
  { label: "Service provider", value: "VET" },
];

export const requiredSignerLabel = (value?: RequiredSignerValue): string => {
  if (value === "") return "No signature required";
  if (value === "CLIENT") return "Pet parent";
  if (value === "VET") return "Service provider";
  return "";
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
  requiredSigner?: RequiredSignerValue;
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

const YES_NO_OPTIONS: FieldOption[] = [
  makeOption("Yes", "yes"),
  makeOption("No", "no"),
];

const FREQUENCY_OPTIONS: FieldOption[] = [
  makeOption("1x daily", "1x_daily"),
  makeOption("2x daily", "2x_daily"),
  makeOption("3x daily", "3x_daily"),
  makeOption("On-demand", "on_demand"),
];

const APPETITE_STATUS_OPTIONS: FieldOption[] = [
  makeOption("Strong appetite", "strong_appetite"),
  makeOption("Picky appetite", "picky_appetite"),
  makeOption("Increased appetite", "increased_appetite"),
  makeOption("Normal appetite", "normal_appetite"),
  makeOption("Poor appetite", "poor_appetite"),
  makeOption("Not eating", "not_eating"),
];

const BEHAVIOR_STATUS_OPTIONS: FieldOption[] = [
  makeOption("Friendly", "friendly"),
  makeOption("Nervous", "nervous"),
  makeOption("Aggressive", "aggressive"),
  makeOption("Alert", "alert"),
  makeOption("Defensive", "defensive"),
  makeOption("Highly anxious", "highly_anxious"),
];

type PresetOptions = "yesNo" | "frequency" | "appetite" | "behavior";

const PRESET_OPTIONS: Record<PresetOptions, FieldOption[]> = {
  yesNo: YES_NO_OPTIONS,
  frequency: FREQUENCY_OPTIONS,
  appetite: APPETITE_STATUS_OPTIONS,
  behavior: BEHAVIOR_STATUS_OPTIONS,
};

const createField = (
  id: string,
  label: string,
  type: FormField["type"],
  options?: FieldOption[] | PresetOptions,
  extra?: Partial<FormField>,
): FormField => {
  const field: Record<string, unknown> = { id, type, label };
  if (options) {
    field.options = typeof options === "string" ? PRESET_OPTIONS[options] : options;
  }
  return { ...field, ...extra } as FormField;
};

const yesNoRadio = (id: string, label: string): FormField =>
  createField(id, label, "radio", "yesNo");

const frequencyRadio = (id: string, label: string): FormField =>
  createField(id, label, "radio", "frequency");

const appetiteStatusRadio = (id: string, label: string): FormField =>
  createField(id, label, "radio", "appetite");

const behaviorStatusCheckbox = (id: string, label: string): FormField =>
  createField(id, label, "checkbox", "behavior", { multiple: true });

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
      label: "Companion name",
      placeholder: "Enter Companion name",
      required: true,
    },
    {
      id: "owner_name",
      type: "input",
      label: "Pet parent name",
      placeholder: "Enter pet parent name",
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
      placeholder: "List key risks that were explained to the pet parent",
    },
    {
      id: "consent_ack",
      type: "checkbox",
      label: "Pet parent agrees to proceed",
      options: [makeOption("I have read and understood the above")],
      multiple: true,
    },
    {
      id: "consent_signature",
      type: "signature",
      label: "Pet parent signature",
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
      placeholder: "Add observations and pet parent instructions",
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
    frequencyRadio("feeding_frequency", "Feeding frequency and timing"),
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
        makeOption("Separate feeding area (for anxious companions)", "separate_area"),
        makeOption("Eat with other companion", "eat_with_others"),
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
    frequencyRadio("frequency", "Frequency"),
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
      label: "Meals provided to companion",
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
      label: "Daily companion walk completed",
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
    { id: "pet_behavior_summary", type: "textarea", label: "companion behavior summary" },
    { id: "additional_expense", type: "textarea", label: "Additional expense" },
  ],
  "Boarder - Schedule": [
    frequencyRadio("poop_frequency", "Poop frequency and timing"),
    { id: "poop_time_slot", type: "input", label: "Specific time slot" },
    frequencyRadio("walking_time", "Walking time"),
    { id: "walking_time_slot", type: "input", label: "Time slot" },
    { id: "exercise_time", type: "input", label: "Exercise time", placeholder: "Describe exercise / Add link" },
    frequencyRadio("exercise_frequency", "Exercise frequency"),
    { id: "exercise_time_slot", type: "input", label: "Time slot" },
  ],
  "Boarder - Belongings": [
    yesNoRadio("pet_bedding", "Companion bedding"),
    yesNoRadio("food_bowl", "Food bowl"),
    yesNoRadio("pet_leash", "Companion leash"),
    yesNoRadio("litter_tray", "Litter tray"),
    { id: "list_of_toys", type: "textarea", label: "List of toys" },
  ],
  "Breeder - Health & Behavior": [
    yesNoRadio("signs_of_stress", "Signs of stress"),
    yesNoRadio("signs_of_discharge", "Signs of discharge"),
    yesNoRadio("signs_of_injury", "Signs of injury"),
    appetiteStatusRadio("appetite_status", "Companion appetite status"),
    behaviorStatusCheckbox("behavior_status", "Companion behavior status"),
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
      label: "Companion sleep pattern",
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
    yesNoRadio("natural_mating_process", "Utilised natural mating process"),
    yesNoRadio("genetic_screening_completed", "Completed genetic screening"),
    yesNoRadio("fertility_assessment_completed", "Completed fertility assessment"),
    appetiteStatusRadio("appetite_status", "Companion appetite status"),
    behaviorStatusCheckbox("behavior_status", "Companion behaviour status"),
    yesNoRadio("ultrasound_pregnancy_check", "Complete ultrasound / pregnancy check"),
    yesNoRadio("birthing_assistance_provided", "Provided birthing assistance"),
    yesNoRadio("neonatal_care_provided", "Provided neonatal / newborn care"),
    yesNoRadio("record_keeping_completed", "Record keeping completed"),
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
    yesNoRadio("provide_list_of_potential_mates", "Provide a list of potential mates"),
    yesNoRadio("preferred_vet_services_required", "Preferred veterinary services required"),
    { id: "preferred_vet_details", type: "textarea", label: "If yes, specify veterinarian's details" },
  ],
  "Breeder - Mating & Fertility Preferences": [
    yesNoRadio("natural_mating", "Natural mating"),
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
    yesNoRadio("semen_collection_evaluation", "Semen collection and evaluation"),
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
    yesNoRadio("fertility_assessment", "Fertility assessment"),
  ],
  "Breeder - Belongings": [
    yesNoRadio("pet_bedding_or_blanket", "Companion bedding or blanket"),
    yesNoRadio("pet_crate", "Companion crate"),
    yesNoRadio("pet_leash", "Companion leash"),
    yesNoRadio("litter_tray", "Litter tray"),
    { id: "list_of_toys", type: "textarea", label: "List of toys" },
  ],
  "Breeder - Check-in": [
    { id: "body_temperature", type: "input", label: "Pet's body temperature" },
    {
      id: "appetite_status_checkin",
      type: "radio",
      label: "Companion's appetite status",
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
      label: "Companion's behavior status",
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
    yesNoRadio("ultrasound_pregnancy_checks", "Ultrasound and pregnancy checks"),
    yesNoRadio("birthing_assistance", "Birthing assistance"),
    yesNoRadio("neonatal_newborn_care", "Neonatal and newborn care"),
    yesNoRadio("record_keeping", "Record keeping"),
    yesNoRadio("post_pregnancy_care", "Post-pregnancy care"),
  ],
  "Breeder - Health Summary": [{ id: "pet_health_summary", type: "textarea", label: "Companion health summary" }],
  "Groomer - Service Request & Preferences": [
    yesNoRadio("bathing_basic", "Given basic bath"),
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
    yesNoRadio("ear_cleaning", "Given ear cleaning?"),
    yesNoRadio("teeth_brushing", "Added teeth brushing"),
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
    yesNoRadio("de_shedding_treatment", "De-shedding treatment"),
    yesNoRadio("conditioner_after_groom", "Given conditioner treatment after grooming"),
    { id: "conditioner_brand", type: "input", label: "Specify conditioner brand" },
    yesNoRadio("dematting_detangling", "Dematting / Detangling"),
    yesNoRadio("nail_trimming", "Nail trimming"),
    yesNoRadio("paw_pad_cleaning", "Paw pad Cleaning"),
    yesNoRadio("anal_gland_expression", "Anal gland expression"),
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
    yesNoRadio("tick_flea_treatment", "Tick and flea treatment"),
    yesNoRadio("perfume_finishing_spray", "Perfume / Finishing spray"),
  ],
  "Groomer - Grooming Prep": [
    yesNoRadio("brushing_detangle_service", "Given brushing and detangle service to companion"),
    yesNoRadio("nail_trimming_paw_cleaning", "Given nail trimming and paw cleaning"),
    yesNoRadio("ear_cleaning_infection_check", "Given ear cleaning and infection check-up"),
    yesNoRadio("medicated_bath_needed", "Does companion require medicated bath to prevent flea / tick"),
    yesNoRadio("anal_gland_checked", "Anal gland checked"),
    yesNoRadio("sanitary_area_trimming", "Given sanitary area trimming"),
  ],
  "Groomer - Bathing & Cleaning Worklog": [
    yesNoRadio("basic_bath_done", "Given basic bath"),
    yesNoRadio("deshedding_done", "Given de-shedding treatment"),
    yesNoRadio("rinse_conditioning_done", "Given thorough rinse and conditioning."),
    yesNoRadio("paw_pad_care_done", "Given paw pad cleaning and care"),
  ],
  "Groomer - Haircut / Styling Worklog": [
    yesNoRadio("drying_with_dryer", "Given drying with towel + pet dryer"),
    yesNoRadio("parent_requested_styling_done", "Given parent-requested styling"),
    yesNoRadio("clipping_shaping_fluff", "Given clipping, shaping, and fluff drying."),
  ],
  "Groomer - Spa Add-ons Worklog": [
    yesNoRadio("final_brushing_done", "Given final brushing"),
    yesNoRadio("tick_flea_treatment_done", "Given tick & flea treatment"),
    yesNoRadio("parent_requested_styling_addon", "Given parent-requested styling"),
    yesNoRadio("perfume_spray_done", "Given perfume / finishing spray"),
    yesNoRadio("clean_fresh_collar", "Given clean and fresh collar"),
  ],
  "Groomer - Health Requirements": [
    yesNoRadio("grooming_history", "Has your companion received grooming services before?"),
    yesNoRadio("allergies_or_skin_issues", "Does your companion suffer from any allergies or skin issues?"),
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
