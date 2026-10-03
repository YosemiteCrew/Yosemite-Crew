import { addCalendarDays, addCalendarMonths } from "./personal-data-rights";

/** Pure rules shared by the future pesticide record workflows. */

const assertCalendarDate = (date: string): string => {
  addCalendarDays(date, 0);
  return date;
};

const addCalendarYears = (date: string, years: number): string =>
  addCalendarMonths(date, years * 12);

export const FIXED_RETENTION_RECORD_CLASSES = [
  "production",
  "device-production",
  "receipt",
  "shipment",
  "restricted-use-advertising",
] as const;

export type FixedRetentionRecordClass =
  (typeof FIXED_RETENTION_RECORD_CLASSES)[number];

export type PesticideRecordRetentionInput =
  | {
      recordClass: FixedRetentionRecordClass;
      latestEventOn: string;
    }
  | { recordClass: "guaranty"; expiresOn: string }
  | { recordClass: "export-contract"; expiresOn: string }
  | {
      recordClass: "disposal" | "human-test";
      latestEventOn: string;
    }
  | {
      recordClass: "research-data";
      registrationValid: boolean;
      companyInBusiness: boolean;
    };

export type PesticideRecordRetention = {
  keepUntil: string | null;
  mayForwardAfter: string | null;
  awaitingConfirmation: boolean;
  reason:
    | "two-years-from-latest-event"
    | "one-year-after-guaranty-expiry"
    | "two-years-after-contract-expiry"
    | "twenty-years-or-forward-after-three"
    | "while-registration-valid-and-company-in-business";
};

/**
 * Computes the record-specific retention boundary. A `null` `keepUntil`
 * means the research-data duty depends on live registration and company
 * state instead of a guessed date.
 */
export const pesticideRecordRetention = (
  record: PesticideRecordRetentionInput,
): PesticideRecordRetention => {
  switch (record.recordClass) {
    case "production":
    case "device-production":
    case "receipt":
    case "shipment":
    case "restricted-use-advertising":
      return {
        keepUntil: addCalendarYears(record.latestEventOn, 2),
        mayForwardAfter: null,
        awaitingConfirmation: true,
        reason: "two-years-from-latest-event",
      };
    case "guaranty":
      return {
        keepUntil: addCalendarYears(record.expiresOn, 1),
        mayForwardAfter: null,
        awaitingConfirmation: false,
        reason: "one-year-after-guaranty-expiry",
      };
    case "export-contract":
      return {
        keepUntil: addCalendarYears(record.expiresOn, 2),
        mayForwardAfter: null,
        awaitingConfirmation: false,
        reason: "two-years-after-contract-expiry",
      };
    case "disposal":
    case "human-test":
      return {
        keepUntil: addCalendarYears(record.latestEventOn, 20),
        mayForwardAfter: addCalendarYears(record.latestEventOn, 3),
        awaitingConfirmation: true,
        reason: "twenty-years-or-forward-after-three",
      };
    case "research-data":
      return {
        keepUntil: null,
        mayForwardAfter: null,
        awaitingConfirmation: false,
        reason: "while-registration-valid-and-company-in-business",
      };
  }
};

export const researchDataMustBeKept = (input: {
  registrationValid: boolean;
  companyInBusiness: boolean;
}): boolean => input.registrationValid && input.companyInBusiness;

export type PesticideNotice =
  | {
      kind: "intent-to-cancel";
      receivedOn: string;
      publishedOn: string;
      delivery: "delivered" | "undeliverable" | "refused";
    }
  | { kind: "conditional-registration"; receivedOn: string }
  | { kind: "imminent-hazard-suspension"; receivedOn: string }
  | { kind: "emergency-suspension"; effectiveOn: string }
  | { kind: "missed-data-suspension"; receivedOn: string }
  | { kind: "voluntary-cancellation-comment"; publishedOn: string }
  | { kind: "minor-use-cancellation-wait"; requestedOn: string }
  | { kind: "registration-transfer-application"; transferOn: string };

/** Calendar-day deadline for a registration notice or follow-up. */
export const pesticideNoticeDueOn = (notice: PesticideNotice): string => {
  switch (notice.kind) {
    case "intent-to-cancel": {
      const receivedOn =
        notice.delivery === "delivered"
          ? assertCalendarDate(notice.receivedOn)
          : assertCalendarDate(notice.publishedOn);
      const publishedOn = assertCalendarDate(notice.publishedOn);
      return addCalendarDays(
        receivedOn > publishedOn ? receivedOn : publishedOn,
        30,
      );
    }
    case "conditional-registration":
      return addCalendarDays(notice.receivedOn, 30);
    case "imminent-hazard-suspension":
      return addCalendarDays(notice.receivedOn, 5);
    case "emergency-suspension":
      return addCalendarDays(notice.effectiveOn, 90);
    case "missed-data-suspension":
      return addCalendarDays(notice.receivedOn, 30);
    case "voluntary-cancellation-comment":
      return addCalendarDays(notice.publishedOn, 30);
    case "minor-use-cancellation-wait":
      return addCalendarDays(notice.requestedOn, 180);
    case "registration-transfer-application":
      return addCalendarDays(notice.transferOn, 30);
  }
};

export type PesticideNoticeStatus = "completed" | "open" | "overdue";

export const pesticideNoticeStatus = (
  notice: PesticideNotice,
  today: string,
  completedOn?: string | null,
): PesticideNoticeStatus => {
  assertCalendarDate(today);
  if (completedOn) {
    assertCalendarDate(completedOn);
    return "completed";
  }
  return today > pesticideNoticeDueOn(notice) ? "overdue" : "open";
};

export type BatchRegistrationBasis = {
  kind:
    | "registration"
    | "experimental-use-permit"
    | "pending-application"
    | "export";
  reference: string;
};

export type BatchStartDecision =
  { allowed: true } | { allowed: false; reason: "registration-basis-required" };

export const canStartPesticideBatch = (
  basis?: BatchRegistrationBasis | null,
): BatchStartDecision =>
  basis?.reference.trim()
    ? { allowed: true }
    : { allowed: false, reason: "registration-basis-required" };

export type ExperimentalPermitDispatchDecision =
  { allowed: true } | { allowed: false; reason: "permit-participant-required" };

export const canDispatchUnderExperimentalPermit = (input: {
  consigneeId: string;
  participantIds: readonly string[];
}): ExperimentalPermitDispatchDecision =>
  input.participantIds.includes(input.consigneeId)
    ? { allowed: true }
    : { allowed: false, reason: "permit-participant-required" };
