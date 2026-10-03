export const INTEGRATION_PROVIDERS = [
  "IDEXX",
  "MERCK_MANUALS",
  "LAIKA",
  "VETNOX",
  "CLINICAL_KEY",
  "DRUG_INTERACTION_CHECKER",
  "DOSAGE_CALCULATOR",
  "PROTOCOL_LIBRARY",
  "VETNIO",
  "TALKATO",
  "SCRIBE_VET",
  "DISCHARGE_BUILDER",
  "TEMPLATE_ENGINE",
  "VOICE_COMMANDS",
  "DIGITAL_INTAKE",
  "PATIENT_MONITOR",
  "FOLLOWUP_AUTOMATION",
  "CARE_PLAN_MANAGER",
  "WELLNESS_TRACKER",
  "BEHAVIOR_LOGGER",
  "WEBSITE_BUILDER",
  "CLIENT_PORTAL",
  "ONLINE_BOOKING",
  "PET_PROFILE",
  "TELEHEALTH_PORTAL",
  "REVIEW_MANAGER",
  "SMS_AUTOMATION",
  "EMAIL_CAMPAIGNS",
  "APPOINTMENT_REMINDERS",
  "CLIENT_MESSAGING",
  "CALL_INTEGRATION",
  "WHATSAPP_BUSINESS",
  "QUICKBOOKS",
  "XERO",
  "INVENTORY_SYNC",
  "PAYROLL_PROVIDER",
  "EXPENSE_TRACKER",
  "BILLING_AUTOMATION",
  "RAD_ANALYZER",
  "ANTECH",
  "HESKA",
  "VETSCAN",
  "MONITOR_SYNC",
  "BUSINESS_INTELLIGENCE",
  "BENCHMARKING",
  "DATA_EXPORT",
  "REVENUE_ANALYTICS",
  "CLINICAL_ANALYTICS",
  "COMPLIANCE_REPORTER",
  "PLUMB_VETERINARY",
  "FORM_BUILDER",
  "TEMPLATE_MANAGER",
  "CONFIG_SYNC",
  "PROTOCOL_SYNC",
  "PHARMACY_INTEGRATION",
  "PET_INSURANCE",
  "REFERRAL_NETWORK",
  "LOYALTY_PROGRAM",
  "E_COMMERCE",
  "SUPPLY_CHAIN",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type IntegrationStatus = "enabled" | "disabled" | "error" | "pending";

export type IntegrationCredentialsStatus =
  "missing" | "invalid" | "valid" | "pending";

export type IdexxCredentials = {
  username: string;
  password: string;
  labAccountId?: string;
};

export type MerckCredentials = Record<string, never>;

export type LaikaCredentials = { apiKey: string };
export type VetnoxCredentials = { apiKey: string; practiceId: string };
export type ClinicalKeyCredentials = { username: string; password: string };
export type DrugInteractionCheckerCredentials = { apiKey: string };
export type DosageCalculatorCredentials = { apiKey: string };
export type ProtocolLibraryCredentials = { apiKey: string; orgId: string };
export type VetnioCredentials = { apiKey: string; orgId: string };
export type TalkatoCredentials = { apiKey: string };
export type ScribeVetCredentials = { apiKey: string; practiceId: string };
export type DischargeBuilderCredentials = { apiKey: string };
export type TemplateEngineCredentials = { apiKey: string; orgId: string };
export type VoiceCommandsCredentials = { apiKey: string };
export type DigitalIntakeCredentials = { apiKey: string; orgId: string };
export type PatientMonitorCredentials = { apiKey: string; deviceId: string };
export type FollowupAutomationCredentials = { apiKey: string };
export type CarePlanManagerCredentials = { apiKey: string; orgId: string };
export type WellnessTrackerCredentials = { apiKey: string };
export type BehaviorLoggerCredentials = { apiKey: string };
export type WebsiteBuilderCredentials = { apiKey: string; domain: string };
export type ClientPortalCredentials = { apiKey: string; orgId: string };
export type OnlineBookingCredentials = { apiKey: string };
export type PetProfileCredentials = { apiKey: string; orgId: string };
export type TelehealthPortalCredentials = { apiKey: string; orgId: string };
export type ReviewManagerCredentials = { apiKey: string };
export type SmsAutomationCredentials = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};
export type EmailCampaignsCredentials = { apiKey: string; fromEmail: string };
export type AppointmentRemindersCredentials = { apiKey: string };
export type ClientMessagingCredentials = { apiKey: string; orgId: string };
export type CallIntegrationCredentials = { apiKey: string; accountId: string };
export type WhatsAppBusinessCredentials = {
  apiKey: string;
  phoneNumberId: string;
};
export type QuickBooksCredentials = {
  realmId: string;
  accessToken: string;
  refreshToken: string;
};
export type XeroCredentials = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
};
export type InventorySyncCredentials = { apiKey: string; warehouseId: string };
export type PayrollProviderCredentials = { apiKey: string; companyId: string };
export type ExpenseTrackerCredentials = { apiKey: string };
export type BillingAutomationCredentials = { apiKey: string; orgId: string };
export type RadAnalyzerCredentials = { apiKey: string; deviceId: string };
export type AntechCredentials = {
  username: string;
  password: string;
  accountId: string;
};
export type HeskaCredentials = { apiKey: string; deviceSerial: string };
export type VetScanCredentials = { username: string; password: string };
export type MonitorSyncCredentials = { apiKey: string; deviceId: string };
export type BusinessIntelligenceCredentials = { apiKey: string; orgId: string };
export type BenchmarkingCredentials = { apiKey: string; practiceId: string };
export type DataExportCredentials = { apiKey: string; exportScope: string };
export type RevenueAnalyticsCredentials = { apiKey: string };
export type ClinicalAnalyticsCredentials = { apiKey: string; orgId: string };
export type ComplianceReporterCredentials = {
  apiKey: string;
  jurisdiction: string;
};
export type PlumbVeterinaryCredentials = { username: string; password: string };
export type FormBuilderCredentials = { apiKey: string; orgId: string };
export type TemplateManagerCredentials = { apiKey: string };
export type ConfigSyncCredentials = { apiKey: string; orgId: string };
export type ProtocolSyncCredentials = { apiKey: string };
export type PharmacyIntegrationCredentials = {
  apiKey: string;
  pharmacyId: string;
};
export type PetInsuranceCredentials = { apiKey: string; partnerId: string };
export type ReferralNetworkCredentials = { apiKey: string; orgId: string };
export type LoyaltyProgramCredentials = { apiKey: string; programId: string };
export type ECommerceCredentials = { apiKey: string; storeId: string };
export type SupplyChainCredentials = { apiKey: string; vendorId: string };

export type IntegrationCredentials =
  | IdexxCredentials
  | MerckCredentials
  | LaikaCredentials
  | VetnoxCredentials
  | ClinicalKeyCredentials
  | DrugInteractionCheckerCredentials
  | DosageCalculatorCredentials
  | ProtocolLibraryCredentials
  | VetnioCredentials
  | TalkatoCredentials
  | ScribeVetCredentials
  | DischargeBuilderCredentials
  | TemplateEngineCredentials
  | VoiceCommandsCredentials
  | DigitalIntakeCredentials
  | PatientMonitorCredentials
  | FollowupAutomationCredentials
  | CarePlanManagerCredentials
  | WellnessTrackerCredentials
  | BehaviorLoggerCredentials
  | WebsiteBuilderCredentials
  | ClientPortalCredentials
  | OnlineBookingCredentials
  | PetProfileCredentials
  | TelehealthPortalCredentials
  | ReviewManagerCredentials
  | SmsAutomationCredentials
  | EmailCampaignsCredentials
  | AppointmentRemindersCredentials
  | ClientMessagingCredentials
  | CallIntegrationCredentials
  | WhatsAppBusinessCredentials
  | QuickBooksCredentials
  | XeroCredentials
  | InventorySyncCredentials
  | PayrollProviderCredentials
  | ExpenseTrackerCredentials
  | BillingAutomationCredentials
  | RadAnalyzerCredentials
  | AntechCredentials
  | HeskaCredentials
  | VetScanCredentials
  | MonitorSyncCredentials
  | BusinessIntelligenceCredentials
  | BenchmarkingCredentials
  | DataExportCredentials
  | RevenueAnalyticsCredentials
  | ClinicalAnalyticsCredentials
  | ComplianceReporterCredentials
  | PlumbVeterinaryCredentials
  | FormBuilderCredentials
  | TemplateManagerCredentials
  | ConfigSyncCredentials
  | ProtocolSyncCredentials
  | PharmacyIntegrationCredentials
  | PetInsuranceCredentials
  | ReferralNetworkCredentials
  | LoyaltyProgramCredentials
  | ECommerceCredentials
  | SupplyChainCredentials
  | Record<string, unknown>;

export type IntegrationConfig = Record<string, unknown>;

export type IntegrationValidationResult =
  { ok: true } | { ok: false; reason: string };

export interface IntegrationAdapter {
  validateCredentials(
    credentials: IntegrationCredentials,
  ): Promise<IntegrationValidationResult>;
}

export const normalizeProvider = (
  value: string | undefined | null,
): IntegrationProvider | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (INTEGRATION_PROVIDERS.includes(normalized as IntegrationProvider)) {
    return normalized as IntegrationProvider;
  }
  return null;
};
