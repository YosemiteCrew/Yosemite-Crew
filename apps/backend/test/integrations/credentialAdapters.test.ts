import { AntechAdapter } from "src/integrations/antech/antech.adapter";
import { AppointmentRemindersAdapter } from "src/integrations/appointment-reminders/appointment-reminders.adapter";
import { BehaviorLoggerAdapter } from "src/integrations/behavior-logger/behavior-logger.adapter";
import { BenchmarkingAdapter } from "src/integrations/benchmarking/benchmarking.adapter";
import { BillingAutomationAdapter } from "src/integrations/billing-automation/billing-automation.adapter";
import { BusinessIntelligenceAdapter } from "src/integrations/business-intelligence/business-intelligence.adapter";
import { CallIntegrationAdapter } from "src/integrations/call-integration/call-integration.adapter";
import { CarePlanManagerAdapter } from "src/integrations/care-plan-manager/care-plan-manager.adapter";
import { ClientMessagingAdapter } from "src/integrations/client-messaging/client-messaging.adapter";
import { ClientPortalAdapter } from "src/integrations/client-portal/client-portal.adapter";
import { ClinicalAnalyticsAdapter } from "src/integrations/clinical-analytics/clinical-analytics.adapter";
import { ClinicalKeyAdapter } from "src/integrations/clinical-key/clinical-key.adapter";
import { ComplianceReporterAdapter } from "src/integrations/compliance-reporter/compliance-reporter.adapter";
import { ConfigSyncAdapter } from "src/integrations/config-sync/config-sync.adapter";
import { DataExportAdapter } from "src/integrations/data-export/data-export.adapter";
import { DigitalIntakeAdapter } from "src/integrations/digital-intake/digital-intake.adapter";
import { DischargeBuilderAdapter } from "src/integrations/discharge-builder/discharge-builder.adapter";
import { DosageCalculatorAdapter } from "src/integrations/dosage-calculator/dosage-calculator.adapter";
import { DrugInteractionCheckerAdapter } from "src/integrations/drug-interaction-checker/drug-interaction-checker.adapter";
import { ECommerceAdapter } from "src/integrations/e-commerce/e-commerce.adapter";
import { EmailCampaignsAdapter } from "src/integrations/email-campaigns/email-campaigns.adapter";
import { ExpenseTrackerAdapter } from "src/integrations/expense-tracker/expense-tracker.adapter";
import { FollowupAutomationAdapter } from "src/integrations/followup-automation/followup-automation.adapter";
import { FormBuilderAdapter } from "src/integrations/form-builder/form-builder.adapter";
import { HeskaAdapter } from "src/integrations/heska/heska.adapter";
import { InventorySyncAdapter } from "src/integrations/inventory-sync/inventory-sync.adapter";
import { LaikaAdapter } from "src/integrations/laika/laika.adapter";
import { LoyaltyProgramAdapter } from "src/integrations/loyalty-program/loyalty-program.adapter";
import { MonitorSyncAdapter } from "src/integrations/monitor-sync/monitor-sync.adapter";
import { OnlineBookingAdapter } from "src/integrations/online-booking/online-booking.adapter";
import { PatientMonitorAdapter } from "src/integrations/patient-monitor/patient-monitor.adapter";
import { PayrollProviderAdapter } from "src/integrations/payroll-provider/payroll-provider.adapter";
import { PetInsuranceAdapter } from "src/integrations/pet-insurance/pet-insurance.adapter";
import { PetProfileAdapter } from "src/integrations/pet-profile/pet-profile.adapter";
import { PharmacyIntegrationAdapter } from "src/integrations/pharmacy-integration/pharmacy-integration.adapter";
import { PlumbVeterinaryAdapter } from "src/integrations/plumb-veterinary/plumb-veterinary.adapter";
import { ProtocolLibraryAdapter } from "src/integrations/protocol-library/protocol-library.adapter";
import { ProtocolSyncAdapter } from "src/integrations/protocol-sync/protocol-sync.adapter";
import { QuickBooksAdapter } from "src/integrations/quickbooks/quickbooks.adapter";
import { RadAnalyzerAdapter } from "src/integrations/rad-analyzer/rad-analyzer.adapter";
import { ReferralNetworkAdapter } from "src/integrations/referral-network/referral-network.adapter";
import { RevenueAnalyticsAdapter } from "src/integrations/revenue-analytics/revenue-analytics.adapter";
import { ReviewManagerAdapter } from "src/integrations/review-manager/review-manager.adapter";
import { ScribeVetAdapter } from "src/integrations/scribe-vet/scribe-vet.adapter";
import { SmsAutomationAdapter } from "src/integrations/sms-automation/sms-automation.adapter";
import { SupplyChainAdapter } from "src/integrations/supply-chain/supply-chain.adapter";
import { TalkatoAdapter } from "src/integrations/talkato/talkato.adapter";
import { TelehealthPortalAdapter } from "src/integrations/telehealth-portal/telehealth-portal.adapter";
import { TemplateEngineAdapter } from "src/integrations/template-engine/template-engine.adapter";
import { TemplateManagerAdapter } from "src/integrations/template-manager/template-manager.adapter";
import { VetnioAdapter } from "src/integrations/vetnio/vetnio.adapter";
import { VetnoxAdapter } from "src/integrations/vetnox/vetnox.adapter";
import { VetScanAdapter } from "src/integrations/vetscan/vetscan.adapter";
import { VoiceCommandsAdapter } from "src/integrations/voice-commands/voice-commands.adapter";
import { WebsiteBuilderAdapter } from "src/integrations/website-builder/website-builder.adapter";
import { WellnessTrackerAdapter } from "src/integrations/wellness-tracker/wellness-tracker.adapter";
import { WhatsAppBusinessAdapter } from "src/integrations/whatsapp-business/whatsapp-business.adapter";
import { XeroAdapter } from "src/integrations/xero/xero.adapter";

type Adapter = {
  validateCredentials(
    credentials: unknown,
  ): Promise<{ ok: boolean; reason?: string }>;
};

const cases: Array<[string, () => Adapter, string[]]> = [
  [
    "AntechAdapter",
    () => new AntechAdapter(),
    ["username", "password", "accountId"],
  ],
  [
    "AppointmentRemindersAdapter",
    () => new AppointmentRemindersAdapter(),
    ["apiKey"],
  ],
  ["BehaviorLoggerAdapter", () => new BehaviorLoggerAdapter(), ["apiKey"]],
  [
    "BenchmarkingAdapter",
    () => new BenchmarkingAdapter(),
    ["apiKey", "practiceId"],
  ],
  [
    "BillingAutomationAdapter",
    () => new BillingAutomationAdapter(),
    ["apiKey", "orgId"],
  ],
  [
    "BusinessIntelligenceAdapter",
    () => new BusinessIntelligenceAdapter(),
    ["apiKey", "orgId"],
  ],
  [
    "CallIntegrationAdapter",
    () => new CallIntegrationAdapter(),
    ["apiKey", "accountId"],
  ],
  [
    "CarePlanManagerAdapter",
    () => new CarePlanManagerAdapter(),
    ["apiKey", "orgId"],
  ],
  [
    "ClientMessagingAdapter",
    () => new ClientMessagingAdapter(),
    ["apiKey", "orgId"],
  ],
  ["ClientPortalAdapter", () => new ClientPortalAdapter(), ["apiKey", "orgId"]],
  [
    "ClinicalAnalyticsAdapter",
    () => new ClinicalAnalyticsAdapter(),
    ["apiKey", "orgId"],
  ],
  [
    "ClinicalKeyAdapter",
    () => new ClinicalKeyAdapter(),
    ["username", "password"],
  ],
  [
    "ComplianceReporterAdapter",
    () => new ComplianceReporterAdapter(),
    ["apiKey", "jurisdiction"],
  ],
  ["ConfigSyncAdapter", () => new ConfigSyncAdapter(), ["apiKey", "orgId"]],
  [
    "DataExportAdapter",
    () => new DataExportAdapter(),
    ["apiKey", "exportScope"],
  ],
  [
    "DigitalIntakeAdapter",
    () => new DigitalIntakeAdapter(),
    ["apiKey", "orgId"],
  ],
  ["DischargeBuilderAdapter", () => new DischargeBuilderAdapter(), ["apiKey"]],
  ["DosageCalculatorAdapter", () => new DosageCalculatorAdapter(), ["apiKey"]],
  [
    "DrugInteractionCheckerAdapter",
    () => new DrugInteractionCheckerAdapter(),
    ["apiKey"],
  ],
  ["ECommerceAdapter", () => new ECommerceAdapter(), ["apiKey", "storeId"]],
  [
    "EmailCampaignsAdapter",
    () => new EmailCampaignsAdapter(),
    ["apiKey", "fromEmail"],
  ],
  ["ExpenseTrackerAdapter", () => new ExpenseTrackerAdapter(), ["apiKey"]],
  [
    "FollowupAutomationAdapter",
    () => new FollowupAutomationAdapter(),
    ["apiKey"],
  ],
  ["FormBuilderAdapter", () => new FormBuilderAdapter(), ["apiKey", "orgId"]],
  ["HeskaAdapter", () => new HeskaAdapter(), ["apiKey", "deviceSerial"]],
  [
    "InventorySyncAdapter",
    () => new InventorySyncAdapter(),
    ["apiKey", "warehouseId"],
  ],
  [
    "LoyaltyProgramAdapter",
    () => new LoyaltyProgramAdapter(),
    ["apiKey", "programId"],
  ],
  [
    "MonitorSyncAdapter",
    () => new MonitorSyncAdapter(),
    ["apiKey", "deviceId"],
  ],
  ["OnlineBookingAdapter", () => new OnlineBookingAdapter(), ["apiKey"]],
  [
    "PatientMonitorAdapter",
    () => new PatientMonitorAdapter(),
    ["apiKey", "deviceId"],
  ],
  [
    "PayrollProviderAdapter",
    () => new PayrollProviderAdapter(),
    ["apiKey", "companyId"],
  ],
  [
    "PetInsuranceAdapter",
    () => new PetInsuranceAdapter(),
    ["apiKey", "partnerId"],
  ],
  ["PetProfileAdapter", () => new PetProfileAdapter(), ["apiKey", "orgId"]],
  [
    "PharmacyIntegrationAdapter",
    () => new PharmacyIntegrationAdapter(),
    ["apiKey", "pharmacyId"],
  ],
  [
    "PlumbVeterinaryAdapter",
    () => new PlumbVeterinaryAdapter(),
    ["username", "password"],
  ],
  [
    "ProtocolLibraryAdapter",
    () => new ProtocolLibraryAdapter(),
    ["apiKey", "orgId"],
  ],
  ["ProtocolSyncAdapter", () => new ProtocolSyncAdapter(), ["apiKey"]],
  [
    "QuickBooksAdapter",
    () => new QuickBooksAdapter(),
    ["realmId", "accessToken", "refreshToken"],
  ],
  [
    "RadAnalyzerAdapter",
    () => new RadAnalyzerAdapter(),
    ["apiKey", "deviceId"],
  ],
  [
    "ReferralNetworkAdapter",
    () => new ReferralNetworkAdapter(),
    ["apiKey", "orgId"],
  ],
  ["RevenueAnalyticsAdapter", () => new RevenueAnalyticsAdapter(), ["apiKey"]],
  ["ReviewManagerAdapter", () => new ReviewManagerAdapter(), ["apiKey"]],
  ["ScribeVetAdapter", () => new ScribeVetAdapter(), ["apiKey", "practiceId"]],
  [
    "SmsAutomationAdapter",
    () => new SmsAutomationAdapter(),
    ["accountSid", "authToken", "fromNumber"],
  ],
  [
    "SupplyChainAdapter",
    () => new SupplyChainAdapter(),
    ["apiKey", "vendorId"],
  ],
  ["TalkatoAdapter", () => new TalkatoAdapter(), ["apiKey"]],
  [
    "TelehealthPortalAdapter",
    () => new TelehealthPortalAdapter(),
    ["apiKey", "orgId"],
  ],
  [
    "TemplateEngineAdapter",
    () => new TemplateEngineAdapter(),
    ["apiKey", "orgId"],
  ],
  ["TemplateManagerAdapter", () => new TemplateManagerAdapter(), ["apiKey"]],
  ["VetnioAdapter", () => new VetnioAdapter(), ["apiKey", "orgId"]],
  ["VetnoxAdapter", () => new VetnoxAdapter(), ["apiKey", "practiceId"]],
  ["VetScanAdapter", () => new VetScanAdapter(), ["username", "password"]],
  ["VoiceCommandsAdapter", () => new VoiceCommandsAdapter(), ["apiKey"]],
  [
    "WebsiteBuilderAdapter",
    () => new WebsiteBuilderAdapter(),
    ["apiKey", "domain"],
  ],
  ["WellnessTrackerAdapter", () => new WellnessTrackerAdapter(), ["apiKey"]],
  [
    "WhatsAppBusinessAdapter",
    () => new WhatsAppBusinessAdapter(),
    ["apiKey", "phoneNumberId"],
  ],
  [
    "XeroAdapter",
    () => new XeroAdapter(),
    ["clientId", "clientSecret", "tenantId"],
  ],
];

const filled = (fields: string[]) =>
  Object.fromEntries(fields.map((field) => [field, `${field}-value`]));

describe.each(cases)("%s credential validation", (_name, create, fields) => {
  it("rejects missing or empty credentials", async () => {
    const adapter = create();
    const missing = { ok: false, reason: "Missing credentials." };
    await expect(adapter.validateCredentials(undefined)).resolves.toEqual(
      missing,
    );
    await expect(adapter.validateCredentials({})).resolves.toEqual(missing);
  });

  it("does not report a connection for well-formed credentials", async () => {
    await expect(
      create().validateCredentials(filled(fields)),
    ).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining("until a connection is available."),
    });
  });

  it.each(fields)("reports %s when it is blank or absent", async (field) => {
    const adapter = create();
    const expected = { ok: false, reason: `${field} is required.` };
    await expect(
      adapter.validateCredentials({ ...filled(fields), [field]: "   " }),
    ).resolves.toEqual(expected);
    const withoutField = filled(fields);
    delete withoutField[field];
    await expect(
      adapter.validateCredentials({ ...withoutField, unrelated: "x" }),
    ).resolves.toEqual(expected);
  });
});

describe("LaikaAdapter credential validation", () => {
  it.each([undefined, {}, { apiKey: "any text at all" }])(
    "never reports a connection for %p",
    async (credentials) => {
      const adapter: Adapter = new LaikaAdapter();
      await expect(adapter.validateCredentials(credentials)).resolves.toEqual({
        ok: false,
        reason: "LAIKA cannot be validated until a connection is available.",
      });
    },
  );
});
