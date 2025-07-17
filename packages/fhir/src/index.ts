export interface Demo {
  name: string;
  age: number;
}

export  {toFHIRBusinessProfile,fromFHIRBusinessProfile} from "./hospital-profile-fhir";
export {parseFhirBundle,File,Files,Document,ParsedData} from "./add.doctor.type"
export {AppointmentsStatusFHIRConverter} from "./AppointmentStatus/apointmentStatusFhir";
export  { convertToFhir, convertFhirToNormal} from "./feedback";
export  { convertExerciseToFHIR, convertPlanTypesToFHIR , convertExerciseTypeToFHIR} from "./exercises";
export { convertPetToFHIR , convertFHIRToPet } from "./pets";
export {convertToNormalToAddInventoryData,toInventoryBundleFHIR,InventoryOverviewConvertToFHIR,toInventoryFHIR} from "./InventoryFhir/inventoryFhir";
export {convertProcedurePackagesToFHIRBundle,convertFHIRPackageToNormal,convertFhirToNormalToUpdateProcedurePackage} from "./ProcedurePackage/procedurePackage";
export { parseDiabetesObservation, toFHIRObservation } from "./diabetes/diabetes-fhir";
export { toFHIRBundleImmunization,VaccinationDoc } from "./immunization/immunization-fhir";
export { validate } from "./immunization/immunization-fhir-validator";
export { convertToFhirVetProfile,convertFromFhirVetProfile } from "./complete-vet-profile/complete-vet-profile";
export { FHIRTransformer , fhirAppointmentFormatter } from "./appointment/appointment-fhir";
export {BusinessFhirFormatter} from "./business-fhir/business-formatter-fhir";
export {generateFHIRBlogResponse} from "./blog-fhir/blog";
export {convertFhirInventoryBundleToJson,convertFhirToJson} from "./InventoryFhir/inventoryFhir";
export {convertGraphDataToFHIR,convertFHIRToGraphData,convertSpecialityWiseAppointmentsToFHIR,FHIRtoJSONSpeacilityStats} from "./hospital-fhir/hospitalfhir";
export {convertDepartmentFromFHIR,convertToFHIRDepartment} from "./addSpecialities/specialities-fhir";
export {fromFHIRInviteItem,fromFHIRInviteList,toFHIRInviteItem,toFHIRInviteList,fromFhirTeamOverview,toFhirTeamOverview,convertFromFhirTeamMembers,convertToFhirTeamMembers } from './invites-teams/invites-teams'