export interface Demo {
  name: string;
  age: number;
}

export { toFHIRBusinessProfile, fromFHIRBusinessProfile } from "./hospital-profile-fhir";
export { parseFhirBundle, File, Files, Document, ParsedData } from "./add.doctor.type"
export { AppointmentsStatusFHIRConverter, convertFromFhirPurposeOfVisit, convertToFhirPurposeOfVisit, convertFromFhirAppointmentTypes, convertToFhirAppointmentTypes } from "./AppointmentStatus/apointmentStatusFhir";
export { convertToFhir, convertFhirToNormal } from "./feedback";
export { convertExerciseToFHIR, convertPlanTypesToFHIR, convertExerciseTypeToFHIR } from "./exercises";
export { convertPetToFHIR, convertFHIRToPet } from "./pets";
export { convertFhirToJson, convertToFhirInventoryData, convertFromFHIRInventory, convertToFHIRInventory, convertFhirBundleToInventory, InventoryOverviewConvertToFHIR,convertJsonToFhir ,convertToFHIRInventoryWhileAdding} from "./InventoryFhir/inventoryFhir";

export { convertProcedurePackagesToFHIRBundle, convertFHIRPackageToNormal, convertFhirToNormalToUpdateProcedurePackage } from "./ProcedurePackage/procedurePackage";
export { parseDiabetesObservation, toFHIRObservation } from "./diabetes/diabetes-fhir";
export { toFHIRBundleImmunization, VaccinationDoc } from "./immunization/immunization-fhir";
export { validate } from "./immunization/immunization-fhir-validator";
export { convertToFhirVetProfile, convertFromFhirVetProfile } from "./complete-vet-profile/complete-vet-profile";
export { convertToFHIRMyCalender, convertFromFHIRAppointments ,parseAppointment,convertFhirAppointmentBundle} from "./appointment/appointment-fhir";
export { BusinessFhirFormatter } from "./business-fhir/business-formatter-fhir";
export { generateFHIRBlogResponse,convertFHIRBlogToNormal, convertFHIRBlogsToNormal} from "./blog-fhir/blog";
export { convertGraphDataToFHIR, convertFHIRToGraphData, convertSpecialityWiseAppointmentsToFHIR, FHIRtoJSONSpeacilityStats, convertAppointmentStatsFromFHIR, convertAppointmentStatsToFHIR } from "./hospital-fhir/hospitalfhir";
export { convertDepartmentFromFHIR, convertToFHIRDepartment, convertDepartmentsFromFHIR, convertDepartmentsToFHIR } from "./addSpecialities/specialities-fhir";
export { fromFHIRInviteItem, fromFHIRInviteList, toFHIRInviteItem, toFHIRInviteList, fromFhirTeamOverview, toFhirTeamOverview, convertFromFhirTeamMembers, convertToFhirTeamMembers, convertFromFhirDepartment, convertToFhirDepartment } from './invites-teams/invites-teams'
export { convertFromFhirSlotBundle, convertToFhirSlotResource, convertFromFhirSlots, convertToFhirSlotResources } from "./doctor-slots/doctor-slots"
export { toFhirOrganizationBreeder } from "./details/breeder-fhir";
export { toFhirOrganizationGroomer } from "./details/groomer-fhir";
export { toFhirOrganizationBoarding } from "./details/boarding-fhir";
export { convertToFhirSummary } from "./details/summary-fhir";
export { fhirOrganizationSchema } from "./details/fhir-organization-validator";
export { FHIRSlotValidator, MonthlySlotValidator } from "./slots-fhir";
export { convertToPainAssessmentFhir } from "./assessment/pain-assessment-fhir";
export { convertFhirToNormalPetData, convertPetDataToFhir, convertFromFHIRDoctorOptions, convertToFHIRDoctorOptions, convertFHIRToTimeSlots, convertTimeSlotsToFHIR, convertAppointmentToFHIR, convertFHIRToAppointment, fromFHIR, toFHIR, convertDoctorsFromFHIR, convertDoctorsToFHIR, convertEmergencyAppointmentFromFHIR, convertEmergencyAppointmentToFHIR, convertEmergencyAppointmentFromFHIRForTable, convertEmergencyAppointmentToFHIRForTable } from "./WebAppointments/web-appointments"
export { convertAdminDepartmentsToFHIR, convertFHIRToAdminDepartments } from "./admin-departments/admin-departments"
export { fromFhirUser, toFhirUser} from "./profile/profile-data-fhir"
