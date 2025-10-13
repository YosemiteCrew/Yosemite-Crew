export type {
  UserOrganizationRequestDTO,
  UserOrganizationResponseDTO,
  UserOrganizationDTOAttributes,
} from "./dto/user-organization.dto";
export {
  fromUserOrganizationRequestDTO,
  toUserOrganizationResponseDTO,
} from "./dto/user-organization.dto";
export type { InventoryType } from "./Inventory/InventoryType";

export { toFHIRUserOrganization } from "./userOrganization";
export { toFHIRRelatedPerson } from "./parent";
export { toFHIROrganization } from "./organization";
export type { Parent } from "./parent";
export type {
  OrganizationRequestDTO,
  OrganizationResponseDTO,
  OrganizationDTOAttributes,
} from "./dto/organization.dto";
export {
  fromOrganizationRequestDTO,
  toOrganizationResponseDTO,
} from "./dto/organization.dto";
export type {
  AddressRequestDTO,
  AddressResponseDTO,
  AddressDTOAttributes,
} from "./dto/address.dto";
export { fromAddressRequestDTO, toAddressResponseDTO } from "./dto/address.dto";
export type {
  ParentRequestDTO,
  ParentResponseDTO,
  ParentDTOAttributesType,
} from "./dto/parent.dto";
export { fromParentRequestDTO, toParentResponseDTO } from "./dto/parent.dto";

export type { Organization, ToFHIROrganizationOptions } from "./organization";
export type {
  UserOrganization,
  ToFHIRUserOrganizationOptions,
} from "./userOrganization";

export type {
  AdminDepartmentItem,
  AdminFHIRHealthcareService,
} from "./models/admin-department";
export type {
  DataItem,
  FHIRBundleGraph,
  FHIRBundleGraphForSpecialitywiseAppointments,
  FHIRtoJSONSpeacilityStats,
} from "./hospital-type/hospitalTypes";

export type { PractitionerData } from "./InviteTeamsMembers/invite-teams-members";

export type {
  BusinessProfile,
  FhirOrganization,
  name,
} from "./HospitalProfile/hospital.profile.types";

export type {
  FHIRAppointmentData,
  MyAppointmentData,
  AppointmentForTable,
  NormalResponseForTable,
} from "./web-appointments-types/web-appointments";

export type { ProcedurePackageJSON } from "./Procedure/procedureType";

export type {
  TicketStatus,
  FhirSupportTicket,
  CreateSupportTicket,
  TicketCategory,
  TicketPlatform,
  UserType,
  UserStatus,
} from "./support/support-types";

export type {
  ConvertToFhirVetProfileParams,
  OperatingHourType,
  VetNameType,
} from "./complete-vet-profile/complete-vet-profile";
