## Multi-org forms support (backend handoff)

### Goals
- Keep mobile untouched: same endpoints and shapes. Hospitals still get SOAP; non-hospitals (Boarder/Breeder/Groomer) should see `soapNotes` empty and business-specific templates only via `/mobile/appointments/:id/forms`.
- Attach business-type templates per appointment without breaking existing hospital data.

### Constraints
- Do **not** change mobile response shapes or paths:
  - `/mobile/appointments/:appointmentId/soap-notes` must remain; for non-hospitals return `{ appointmentId, soapNotes: {} }`.
  - `/mobile/appointments/:appointmentId/forms` must keep its structure; just vary which forms are attached.
- Existing hospital SOAP forms and submissions must stay valid.

### Org type detection
- Resolve org type from `appointment.organisationId` (Organisation.type: `HOSPITAL | BOARDER | BREEDER | GROOMER`).
- Cache org lookups to avoid extra queries per appointment fetch.

### Form model extensions
- Add optional `businessType` to Form (and index `{ orgId, businessType, category, status }`).
- Use it to filter templates when loading forms for an appointment.
- Keep visibility/status semantics unchanged.

### Appointment form selection (core change)
- In `FormService.getFormsForAppointment`:
  - Load org type.
  - If org type is HOSPITAL: current behavior (published SOAP + any attached forms).
  - If org type is non-hospital: skip SOAP categories; attach business-type templates (`businessType` match) and any appointment-attached forms.
  - Preserve service/species filters as today.
- In `FormService.getSOAPNotesByAppointment`: only return SOAP groups for HOSPITAL; else return empty `soapNotes`.
- When a submission is created for an appointment (any org type), ensure the formId is linked to the appointment (e.g., push into `appointment.formIds`) so `getFormsForAppointment` returns it on reload. Alternatively (or additionally), have `getFormsForAppointment` include the latest submission per form where `appointmentId` matches even if `formIds` is empty. Without this, past submissions disappear after refresh on web/mobile.

### Migration/seed checklist
1) Schema: add `businessType` to Form + index.
2) Data migration: set `businessType = null` (or omit) for existing hospital SOAP forms to avoid filtering them out.
3) Seed templates per business type (below) with `status=published`, `visibilityType=Internal` (or `Internal_External` if clients fill), and `businessType` set accordingly.
4) Verify: hospital appointments still render SOAP; non-hospital appointments show only business templates in `/mobile/appointments/:id/forms` and empty `soapNotes`.

### Template seeds – Boarder (from product spec)
- Already extracted; see `Boarding Checklist`, `Dietary Plan`, `Medication Details (Optional)`, `Daily Summary`, `Schedule`, `Belongings (Optional)` with checkbox/radio/date/textarea fields. (Previously shared JSON can be reused for seeding.)

### Template seeds – Breeder (extracted from provided screens)

#### Breeder: Health & Behavior Check
- `signs_of_stress` (radio: yes/no)
- `signs_of_discharge` (radio: yes/no)
- `signs_of_injury` (radio: yes/no)
- `appetite_status` (checkbox multi: strong_appetite, picky_appetite, increased_appetite, normal_appetite, poor_appetite, not_eating)
- `behavior_status` (checkbox multi: friendly, nervous, aggressive, alert, defensive, highly_anxious)
- `energy_level` (checkbox multi: energetic, lethargic, weak, normal, overexcited)
- `sleep_pattern` (checkbox multi: normal_sleep, lethargy, sleeps_well_after_activity, restless, difficulty_settling)

#### Breeder: Mating Log
- `mating_date` (date)
- `mating_time` (time)
- `natural_mating_process` (radio: yes/no)
- `genetic_screening_completed` (radio: yes/no)
- `fertility_assessment_completed` (radio: yes/no)
- `appetite_status` (same option set as above)
- `behavior_status` (same option set as above)
- `ultrasound_pregnancy_check` (radio: yes/no)
- `birthing_assistance_provided` (radio: yes/no)
- `neonatal_care_provided` (radio: yes/no)
- `record_keeping_completed` (radio: yes/no)

#### Breeder: Breeding Consultation & Planning
- `consultation_for_clients` (checkbox multi: stud_services, breeding_services)
- `heat_status_confirmation` (checkbox multi: visual_examination, progesterone_testing)
- `fertile_phase_start_date` (date)
- `fertile_phase_end_date` (date)
- `provide_list_of_potential_mates` (radio: yes/no)
- `preferred_vet_services_required` (radio: yes/no)
- `preferred_vet_details` (textarea, conditional on yes)

#### Breeder: Mating & Fertility Preferences
- `natural_mating` (radio: yes/no)
- `artificial_insemination` (checkbox multi: fresh_semen, chilled_semen, frozen_semen)
- `semen_collection_evaluation` (radio: yes/no)
- `genetic_screening` (checkbox multi: dna_testing, genetic_disorder_screening, breed_identification)
- `fertility_assessment` (radio: yes/no)

#### Breeder: Belongings (Optional)
- `pet_bedding_or_blanket` (radio: yes/no)
- `pet_crate` (radio: yes/no)
- `pet_leash` (radio: yes/no)
- `litter_tray` (radio: yes/no)
- `list_of_toys` (textarea)

#### Breeder: Check-in Information
- `body_temperature` (input/textarea)
- `appetite_status` (checkbox multi: strong_appetite, normal_appetite, increased_appetite, refusing_to_eat, selective_appetite, decreased_appetite)
- `behavior_status` (checkbox multi: friendly_behavior, alert_behavior, nervous_behavior, defensive_behavior, aggressive_behavior, highly_anxious_behavior)
- `confirm_female_heat_status` (checkbox multi: visual_examination, progesterone_testing)
- `heat_status_notes` (textarea)

#### Breeder: Pregnancy Care
- `ultrasound_pregnancy_checks` (radio: yes/no)
- `birthing_assistance` (radio: yes/no)
- `neonatal_newborn_care` (radio: yes/no)
- `record_keeping` (radio: yes/no)
- `post_pregnancy_care` (radio: yes/no)

#### Breeder: Health Summary
- `pet_health_summary` (textarea)

### Template seeds – Groomer (extracted from provided screens)

#### Groomer: Service Request & Preferences
- `bathing_basic` (radio: yes/no)
- `bath_type` (checkbox multi: basic, de_shedding, medicate, whitening)
- `ear_cleaning` (radio: yes/no)
- `teeth_brushing` (radio: yes/no)
- `haircut_style` (checkbox multi: breed_standard, summer_cut, custom)
- `de_shedding_treatment` (radio: yes/no)
- `conditioner_after_groom` (radio: yes/no)
- `conditioner_brand` (textarea)
- `dematting_detangling` (radio: yes/no)
- `nail_trimming` (radio: yes/no)
- `paw_pad_cleaning` (radio: yes/no)
- `anal_gland_expression` (radio: yes/no)
- `aromatherapy_bath` (checkbox multi: aromatherapy, herbal, oatmeal)
- `tick_flea_treatment` (radio: yes/no)
- `perfume_finishing_spray` (radio: yes/no)

#### Groomer: Grooming Prep Checklist
- `brushing_detangle` (radio: yes/no)
- `nail_trimming_paw_cleaning` (radio: yes/no)
- `ear_cleaning_infection_check` (radio: yes/no)
- `medicated_bath_needed` (radio: yes/no)
- `anal_gland_checked` (radio: yes/no)
- `sanitary_area_trimming` (radio: yes/no)

#### Groomer: Bathing & Cleaning (Worklog)
- `basic_bath_done` (radio: yes/no)
- `deshedding_done` (radio: yes/no)
- `rinse_conditioning_done` (radio: yes/no)
- `paw_pad_care_done` (radio: yes/no)

#### Groomer: Haircut / Styling (Worklog)
- `drying_with_dryer` (radio: yes/no)
- `parent_requested_styling_done` (radio: yes/no)
- `clipping_shaping_fluff` (radio: yes/no)

#### Groomer: Spa & Special Add-ons (Worklog)
- `final_brushing_done` (radio: yes/no)
- `tick_flea_treatment_done` (radio: yes/no)
- `parent_requested_styling_addon` (radio: yes/no)
- `perfume_spray_done` (radio: yes/no)
- `clean_fresh_collar` (radio: yes/no)

#### Groomer: Health & Requirements
- `grooming_history` (radio: yes/no — has pet received grooming before?)
- `allergies_or_skin_issues` (radio: yes/no)
- `allergy_details` (textarea, conditional)
- `preferred_coat_specs_image` (file upload)
- `preferred_coat_specs_notes` (textarea)
- `wound_area_details` (textarea)

> Apply `businessType=GROOMER`, `category=Custom`, publish. Keep labels as above; IDs can follow your naming convention; set required=false unless product requires otherwise.

### Seeding guidance
- Use categories as `Custom` unless you introduce new category strings. Tie selection via the relevant `businessType`.
- Keep labels as above; adjust IDs to your naming convention. Required flags can stay false unless product mandates otherwise.
- If you need default values, keep empty; do not change response shape.

### Acceptance checks
- Hospital org: SOAP endpoint returns SOAP data; forms list unchanged.
- Non-hospital org: SOAP endpoint returns empty `soapNotes`; forms list returns seeded business-type templates; no 500s.
- Mobile: still renders “Forms” list with new templates; “SOAP Notes” hidden when `soapNotes` empty.
- Web: can render business-type sections based on org type (handled in frontend).
