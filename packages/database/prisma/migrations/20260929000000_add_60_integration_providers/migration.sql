-- Add 60 new integration providers to the IntegrationProvider enum
-- This migration adds the enum values for all 60 integration workflows

-- Clinical Assistance (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'LAIKA';
ALTER TYPE "IntegrationProvider" ADD VALUE 'VETNOX';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CLINICAL_KEY';
ALTER TYPE "IntegrationProvider" ADD VALUE 'DRUG_INTERACTION_CHECKER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'DOSAGE_CALCULATOR';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PROTOCOL_LIBRARY';

-- Voice & Clinical Document (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'VETNIO';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TALKATO';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SCRIBE_VET';
ALTER TYPE "IntegrationProvider" ADD VALUE 'DISCHARGE_BUILDER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TEMPLATE_ENGINE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'VOICE_COMMANDS';

-- Intake & Continuing Care (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'DIGITAL_INTAKE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PATIENT_MONITOR';
ALTER TYPE "IntegrationProvider" ADD VALUE 'FOLLOWUP_AUTOMATION';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CARE_PLAN_MANAGER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'WELLNESS_TRACKER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'BEHAVIOR_LOGGER';

-- Website & Client Portal (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'WEBSITE_BUILDER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CLIENT_PORTAL';
ALTER TYPE "IntegrationProvider" ADD VALUE 'ONLINE_BOOKING';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PET_PROFILE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TELEHEALTH_PORTAL';
ALTER TYPE "IntegrationProvider" ADD VALUE 'REVIEW_MANAGER';

-- Reception & Communication (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'SMS_AUTOMATION';
ALTER TYPE "IntegrationProvider" ADD VALUE 'EMAIL_CAMPAIGNS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'APPOINTMENT_REMINDERS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CLIENT_MESSAGING';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CALL_INTEGRATION';
ALTER TYPE "IntegrationProvider" ADD VALUE 'WHATSAPP_BUSINESS';

-- Finance & Practice Operations (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'QUICKBOOKS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'XERO';
ALTER TYPE "IntegrationProvider" ADD VALUE 'INVENTORY_SYNC';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PAYROLL_PROVIDER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'EXPENSE_TRACKER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'BILLING_AUTOMATION';

-- Diagnostics & Connected Device (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'RAD_ANALYZER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'ANTECH';
ALTER TYPE "IntegrationProvider" ADD VALUE 'HESKA';
ALTER TYPE "IntegrationProvider" ADD VALUE 'VETSCAN';
ALTER TYPE "IntegrationProvider" ADD VALUE 'MONITOR_SYNC';

-- Analytics & Controlled Export (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'BUSINESS_INTELLIGENCE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'BENCHMARKING';
ALTER TYPE "IntegrationProvider" ADD VALUE 'DATA_EXPORT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'REVENUE_ANALYTICS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CLINICAL_ANALYTICS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'COMPLIANCE_REPORTER';

-- Knowledge & Configuration (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'PLUMB_VETERINARY';
ALTER TYPE "IntegrationProvider" ADD VALUE 'FORM_BUILDER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TEMPLATE_MANAGER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CONFIG_SYNC';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PROTOCOL_SYNC';

-- Partner & Commerce (6)
ALTER TYPE "IntegrationProvider" ADD VALUE 'PHARMACY_INTEGRATION';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PET_INSURANCE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'REFERRAL_NETWORK';
ALTER TYPE "IntegrationProvider" ADD VALUE 'LOYALTY_PROGRAM';
ALTER TYPE "IntegrationProvider" ADD VALUE 'E_COMMERCE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SUPPLY_CHAIN';