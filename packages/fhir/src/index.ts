export {
  fromFHIR,
  fhirToNormalForTable,
} from "./web-appointments/web-appointments";
export {
  convertFHIRToGraphData,
  FHIRtoJSONSpeacilityStats,
} from "./hospital-fhir/hospital-fhir";
export { PractitionerDatafromFHIR } from "./invites-teams/invites-teams";
export { convertFhirBundleToInventory } from "./inventory-fhir/inventoryFhir";
export { convertFHIRToAdminDepartments } from "./admin-departments/admin-departments";
export { toFHIRBusinessProfile } from "./hospital-profile-fhir";
export { toFhirSupportTicket } from "./support/support-data-fhir";
