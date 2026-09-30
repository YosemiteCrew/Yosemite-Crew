import { IdexxAdapter } from "./idexx/idexx.adapter";
import { MerckAdapter } from "./merck/merck.adapter";
import { LaikaAdapter } from "./laika/laika.adapter";
import { VetnoxAdapter } from "./vetnox/vetnox.adapter";
import { ClinicalKeyAdapter } from "./clinical-key/clinical-key.adapter";
import { DrugInteractionCheckerAdapter } from "./drug-interaction-checker/drug-interaction-checker.adapter";
import { DosageCalculatorAdapter } from "./dosage-calculator/dosage-calculator.adapter";
import { ProtocolLibraryAdapter } from "./protocol-library/protocol-library.adapter";
import { VetnioAdapter } from "./vetnio/vetnio.adapter";
import { TalkatoAdapter } from "./talkato/talkato.adapter";
import { ScribeVetAdapter } from "./scribe-vet/scribe-vet.adapter";
import { DischargeBuilderAdapter } from "./discharge-builder/discharge-builder.adapter";
import { TemplateEngineAdapter } from "./template-engine/template-engine.adapter";
import { VoiceCommandsAdapter } from "./voice-commands/voice-commands.adapter";
import { DigitalIntakeAdapter } from "./digital-intake/digital-intake.adapter";
import { PatientMonitorAdapter } from "./patient-monitor/patient-monitor.adapter";
import { FollowupAutomationAdapter } from "./followup-automation/followup-automation.adapter";
import { CarePlanManagerAdapter } from "./care-plan-manager/care-plan-manager.adapter";
import { WellnessTrackerAdapter } from "./wellness-tracker/wellness-tracker.adapter";
import { BehaviorLoggerAdapter } from "./behavior-logger/behavior-logger.adapter";
import { WebsiteBuilderAdapter } from "./website-builder/website-builder.adapter";
import { ClientPortalAdapter } from "./client-portal/client-portal.adapter";
import { OnlineBookingAdapter } from "./online-booking/online-booking.adapter";
import { PetProfileAdapter } from "./pet-profile/pet-profile.adapter";
import { TelehealthPortalAdapter } from "./telehealth-portal/telehealth-portal.adapter";
import { ReviewManagerAdapter } from "./review-manager/review-manager.adapter";
import { SmsAutomationAdapter } from "./sms-automation/sms-automation.adapter";
import { EmailCampaignsAdapter } from "./email-campaigns/email-campaigns.adapter";
import { AppointmentRemindersAdapter } from "./appointment-reminders/appointment-reminders.adapter";
import { ClientMessagingAdapter } from "./client-messaging/client-messaging.adapter";
import { CallIntegrationAdapter } from "./call-integration/call-integration.adapter";
import { WhatsAppBusinessAdapter } from "./whatsapp-business/whatsapp-business.adapter";
import { QuickBooksAdapter } from "./quickbooks/quickbooks.adapter";
import { XeroAdapter } from "./xero/xero.adapter";
import { InventorySyncAdapter } from "./inventory-sync/inventory-sync.adapter";
import { PayrollProviderAdapter } from "./payroll-provider/payroll-provider.adapter";
import { ExpenseTrackerAdapter } from "./expense-tracker/expense-tracker.adapter";
import { BillingAutomationAdapter } from "./billing-automation/billing-automation.adapter";
import { RadAnalyzerAdapter } from "./rad-analyzer/rad-analyzer.adapter";
import { AntechAdapter } from "./antech/antech.adapter";
import { HeskaAdapter } from "./heska/heska.adapter";
import { VetScanAdapter } from "./vetscan/vetscan.adapter";
import { MonitorSyncAdapter } from "./monitor-sync/monitor-sync.adapter";
import { BusinessIntelligenceAdapter } from "./business-intelligence/business-intelligence.adapter";
import { BenchmarkingAdapter } from "./benchmarking/benchmarking.adapter";
import { DataExportAdapter } from "./data-export/data-export.adapter";
import { RevenueAnalyticsAdapter } from "./revenue-analytics/revenue-analytics.adapter";
import { ClinicalAnalyticsAdapter } from "./clinical-analytics/clinical-analytics.adapter";
import { ComplianceReporterAdapter } from "./compliance-reporter/compliance-reporter.adapter";
import { PlumbVeterinaryAdapter } from "./plumb-veterinary/plumb-veterinary.adapter";
import { FormBuilderAdapter } from "./form-builder/form-builder.adapter";
import { TemplateManagerAdapter } from "./template-manager/template-manager.adapter";
import { ConfigSyncAdapter } from "./config-sync/config-sync.adapter";
import { ProtocolSyncAdapter } from "./protocol-sync/protocol-sync.adapter";
import { PharmacyIntegrationAdapter } from "./pharmacy-integration/pharmacy-integration.adapter";
import { PetInsuranceAdapter } from "./pet-insurance/pet-insurance.adapter";
import { ReferralNetworkAdapter } from "./referral-network/referral-network.adapter";
import { LoyaltyProgramAdapter } from "./loyalty-program/loyalty-program.adapter";
import { ECommerceAdapter } from "./e-commerce/e-commerce.adapter";
import { SupplyChainAdapter } from "./supply-chain/supply-chain.adapter";
import type { IntegrationAdapter, IntegrationProvider } from "./types";
export * from "./types";
export * from "./providerAvailability";

const adapters: Record<IntegrationProvider, IntegrationAdapter> = {
  IDEXX: new IdexxAdapter(),
  MERCK_MANUALS: new MerckAdapter(),
  LAIKA: new LaikaAdapter(),
  VETNOX: new VetnoxAdapter(),
  CLINICAL_KEY: new ClinicalKeyAdapter(),
  DRUG_INTERACTION_CHECKER: new DrugInteractionCheckerAdapter(),
  DOSAGE_CALCULATOR: new DosageCalculatorAdapter(),
  PROTOCOL_LIBRARY: new ProtocolLibraryAdapter(),
  VETNIO: new VetnioAdapter(),
  TALKATO: new TalkatoAdapter(),
  SCRIBE_VET: new ScribeVetAdapter(),
  DISCHARGE_BUILDER: new DischargeBuilderAdapter(),
  TEMPLATE_ENGINE: new TemplateEngineAdapter(),
  VOICE_COMMANDS: new VoiceCommandsAdapter(),
  DIGITAL_INTAKE: new DigitalIntakeAdapter(),
  PATIENT_MONITOR: new PatientMonitorAdapter(),
  FOLLOWUP_AUTOMATION: new FollowupAutomationAdapter(),
  CARE_PLAN_MANAGER: new CarePlanManagerAdapter(),
  WELLNESS_TRACKER: new WellnessTrackerAdapter(),
  BEHAVIOR_LOGGER: new BehaviorLoggerAdapter(),
  WEBSITE_BUILDER: new WebsiteBuilderAdapter(),
  CLIENT_PORTAL: new ClientPortalAdapter(),
  ONLINE_BOOKING: new OnlineBookingAdapter(),
  PET_PROFILE: new PetProfileAdapter(),
  TELEHEALTH_PORTAL: new TelehealthPortalAdapter(),
  REVIEW_MANAGER: new ReviewManagerAdapter(),
  SMS_AUTOMATION: new SmsAutomationAdapter(),
  EMAIL_CAMPAIGNS: new EmailCampaignsAdapter(),
  APPOINTMENT_REMINDERS: new AppointmentRemindersAdapter(),
  CLIENT_MESSAGING: new ClientMessagingAdapter(),
  CALL_INTEGRATION: new CallIntegrationAdapter(),
  WHATSAPP_BUSINESS: new WhatsAppBusinessAdapter(),
  QUICKBOOKS: new QuickBooksAdapter(),
  XERO: new XeroAdapter(),
  INVENTORY_SYNC: new InventorySyncAdapter(),
  PAYROLL_PROVIDER: new PayrollProviderAdapter(),
  EXPENSE_TRACKER: new ExpenseTrackerAdapter(),
  BILLING_AUTOMATION: new BillingAutomationAdapter(),
  RAD_ANALYZER: new RadAnalyzerAdapter(),
  ANTECH: new AntechAdapter(),
  HESKA: new HeskaAdapter(),
  VETSCAN: new VetScanAdapter(),
  MONITOR_SYNC: new MonitorSyncAdapter(),
  BUSINESS_INTELLIGENCE: new BusinessIntelligenceAdapter(),
  BENCHMARKING: new BenchmarkingAdapter(),
  DATA_EXPORT: new DataExportAdapter(),
  REVENUE_ANALYTICS: new RevenueAnalyticsAdapter(),
  CLINICAL_ANALYTICS: new ClinicalAnalyticsAdapter(),
  COMPLIANCE_REPORTER: new ComplianceReporterAdapter(),
  PLUMB_VETERINARY: new PlumbVeterinaryAdapter(),
  FORM_BUILDER: new FormBuilderAdapter(),
  TEMPLATE_MANAGER: new TemplateManagerAdapter(),
  CONFIG_SYNC: new ConfigSyncAdapter(),
  PROTOCOL_SYNC: new ProtocolSyncAdapter(),
  PHARMACY_INTEGRATION: new PharmacyIntegrationAdapter(),
  PET_INSURANCE: new PetInsuranceAdapter(),
  REFERRAL_NETWORK: new ReferralNetworkAdapter(),
  LOYALTY_PROGRAM: new LoyaltyProgramAdapter(),
  E_COMMERCE: new ECommerceAdapter(),
  SUPPLY_CHAIN: new SupplyChainAdapter(),
};

export const getIntegrationAdapter = (
  provider: IntegrationProvider,
): IntegrationAdapter => adapters[provider];
