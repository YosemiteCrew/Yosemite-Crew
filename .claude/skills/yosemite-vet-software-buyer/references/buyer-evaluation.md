# Buyer Evaluation

## Establish Whether a Purchase Helps

Describe the friction as an observable workflow: who performs it, how often, what fails, and what improvement would be valuable. Ask whether configuration, training, an already-paid feature, or an existing integration could solve it. Do not assume replacing the main records system is necessary to improve one workflow.

Include the people doing the work: reception, nursing or technician staff, clinicians, the practice manager, and finance where relevant. An owner's approval does not demonstrate that frontline staff can use the tool.

| Starting point       | What changes the decision                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New practice         | Opening dependencies, initial volumes, future staffing, hardware, internet, training, and how the first appointment reaches the first reconciled invoice. |
| Replacement          | Unsolved pain, export rights, data quality, overlap costs, migration scope, training capacity, and the next cancellation deadline.                        |
| Add-on               | Whether the core system already covers the need; duplicated records, extra logins, sync failures, and responsibility across suppliers.                    |
| Acquisition          | Transferability of licenses, change-of-control clauses, inherited contracts, access credentials, data authority, and ability to preserve continuity.      |
| Renewal              | Actual usage, unused licenses, support history, new prices, changed terms, and whether an upgrade restarts the commitment.                                |
| Multiple sites       | Permission boundaries, shared clients, location-specific inventory and pricing, consolidated reporting, and site sale or closure.                         |
| Mobile or ambulatory | Real connectivity, offline behavior, sync conflicts, mobile hardware, printing, routing, and field billing.                                               |

Write a small requirements table: workflow, essential or desirable, acceptance test, responsible staff role, and evidence needed. Avoid counting a long feature list as a needs assessment.

## Test the Category Being Bought

| Category                                           | Ask the supplier to demonstrate                                                                                                                        | Less obvious buying questions                                                                                                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main practice system and clinical records          | Booking through check-in, consult, diagnostics, dispensing, invoice, payment, and follow-up; correct a finalized note without losing its history.      | Migration of attachments and histories; permissions; multiple owners; audit trails; read-only access after cancellation; report reconciliation.                                                                 |
| Booking and scheduling                             | Appointment types with different durations, clinician and equipment availability, rescheduling, a cancellation, and two simultaneous booking attempts. | Instant confirmed booking or merely a request; synchronization delay; timezone behavior; deposits; message fees; waitlist rules.                                                                                |
| Client communications and apps                     | A multi-patient household, consent choices, a reply reaching the right team, and suppression of inappropriate reminders.                               | Number ownership and portability; per-segment text billing; delivery charges; messaging quotas; manual review and patient-status rules; exportable consent history.                                             |
| AI reception and phone tools                       | A routine booking, an urgent-sounding call transferred to a human, an unsupported request, an accent or language variation, and a failed handoff.      | Per-minute costs, overages, recordings, consent, number portability, downtime routing, staff escalation, and who monitors unhandled calls. Do not let purchase testing become automated clinical triage advice. |
| AI scribe and clinical assistance                  | A fictional encounter with negation, units, corrections, several speakers, and similar patient names; clinician review before finalizing.              | Raw recording retention; transcript versus note export; model-training and secondary-use rights; subgroup validation; correction time; quotas and failed-session charges.                                       |
| Diagnostics, imaging, and laboratory tools         | An order with correct patient identifiers, a corrected result, a large image set, and viewing or exporting data outside the product.                   | Native images versus rendered reports; measurements and annotations; device compatibility; storage and retrieval charges; clinical validation and supported species.                                            |
| Treatment boards and inpatient tools               | A shift handover, changed treatment timing, an overdue task, a completed task linked to billing, and downtime reconciliation.                          | Concurrent updates, escalation ownership, who can correct an entry, audit history, dependencies on the main system, and 24-hour support scope.                                                                  |
| Inventory, pharmacy, and prescribing               | Purchase order through receiving, partial pack use, return, expiry, batch traceability, and stock reconciliation.                                      | Pack-to-unit conversions; site transfers; supplier restrictions; minimum purchases; dispensing fees; locally applicable prescription and controlled-drug records.                                               |
| Payments and finance                               | Split tender, deposits, partial refunds, a disputed payment, settlement, and accounting reconciliation.                                                | Compulsory processing, effective rates, reserves, terminal leases, cancellation of the separate merchant agreement, portability of payment tokens, and reconciliation exports.                                  |
| Wellness plans and subscriptions                   | Enrollment, failed payment, cancellation, unused entitlements, a refund, and transfer to another patient or site where permitted.                      | Who carries credit risk, discount clawbacks, fees per plan, remaining care obligations, and whether the plan survives a software change.                                                                        |
| Telehealth and remote monitoring                   | Scheduling, consent, human review, recording relevant information, failed connection, and escalation to in-person care.                                | Jurisdictional rules, professional eligibility, emergency exclusions, monitoring hours, false alerts, client accessibility, and record export.                                                                  |
| Analytics, accounting, and group reporting         | Trace a dashboard figure back to original records; explain a refund, time boundary, site transfer, and corrected entry.                                | Data definitions, latency, mappings, permitted benchmarking, export granularity, historical comparability, and cost per entity.                                                                                 |
| Reputation, marketing, and other operational tools | The exact campaign or task, approval, recipient controls, reporting, and account handover.                                                             | Ownership of domains, content, lists, numbers and ad accounts; agency access; platform dependencies; asset export; promises of outcomes. Check current platform rules for review solicitation.                  |

For an unlisted category, use the same questions: what job, who uses it, what data enters and leaves, what can fail, who fixes it, what is charged, and how the practice stops using it.

## Run a Useful Demo or Trial

Choose a few representative scenarios plus the highest-consequence failure. Give each candidate the same task and let a future user attempt it. Use fictional or properly de-identified material in an authorized environment. Do not upload a live practice database to obtain a quote or casual demo.

Record completion, correctness, time, manual re-entry, help required, and unresolved exceptions. A recording or screenshot is useful evidence only for what it actually shows. Do not promise a trial is free until billing activation, cancellation, and data treatment are understood.

Useful cross-category scenarios:

- Two staff update the same item; confirm the outcome and history.
- A task fails halfway; confirm what was saved, how staff notice, and how they recover.
- Remove an employee's access; confirm the account and relevant sessions are disabled.
- Correct a patient link or factual error; confirm a durable audit trail.
- Export a representative sample and have the receiving person open and interpret it.
- Interrupt the connection in a permitted demo environment; distinguish offline operation, cached read-only access, and complete unavailability.

Do not run intrusive security tests, disrupt a live system, or imply a demo confirms security architecture.

## Understand an Integration

The presence of an integration name or logo does not specify what works. Record:

| Question                 | Required answer                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| What moves?              | Exact records and fields, including attachments, corrections, refunds, and consent where relevant.          |
| Which direction?         | Read-only, write-only, two-way, or a manual export and import.                                              |
| When?                    | Trigger, synchronization interval, expected delay, and backfill limits.                                     |
| Who can get it?          | Actual product version, plan, region, partner approval, and availability today.                             |
| What happens on failure? | Notification, retry, duplicate prevention, conflict handling, reconciliation, and accountable support team. |
| What does it cost?       | Charges from both suppliers, middleware, installation, volumes, support, and future changes.                |
| What can change?         | API scopes, rate limits, deprecation notice, loss of partner access, and fallback or exit rights.           |
| How do we verify?        | A demonstration of the buyer's exact workflow and written confirmation of production support.               |

Do not confuse API access with an unlimited right to export, migrate, or connect another application. Technical access and contractual permission are separate checks.

## Protect Records and Continuity

For tools holding material practice data, require a named person to own migration and recovery. Identify the data to preserve: patient and client relationships, clinical histories, attachments, images, active appointments, invoices and balances, stock, prescriptions, consents, and audit history as applicable.

Specify source and destination totals, mapping rules, representative record checks, and reconciliation tolerances. Financial balances and patient identity errors require explicit resolution; do not average them away. Investigate exclusions rather than accepting a statement that the migration is complete.

Before a major change, agree a tested backup and restore process, a read-only legacy-access plan, a cutover owner, and criteria for delaying go-live. A rollback after new records have been created needs reconciliation; restoring an old snapshot can discard new clinical and financial activity.

Ask for recovery objectives in plain language: maximum tolerable lost work and target time to restore service. Confirm what an outage excludes, what the practice can still do, how downtime records are captured, and who reconciles them afterward.

For self-hosting, explicitly assign updates, monitoring, backups, restoration, encryption, identity management, hosting bills, and incident response. For managed services, identify what the supplier handles and what still belongs to the practice.

## Evidence of Security and Support

Ask about individual accounts, role permissions, multi-factor authentication, offboarding, encryption, audit logs, backup separation and restore testing, incident notification, subprocessors, and where data is stored and accessed. Match the depth to the information and operational dependency involved.

A security certification or report is evidence with a date, scope, and exceptions, not a blanket guarantee. Ask whether it covers the actual service and hosting arrangement. An online calculator using no stored identifiers does not have the same exposure as a records system or recorded consultation service.

Record support hours and timezone, channels, severity definitions, initial response versus resolution targets, escalation, training limits, and charges. Availability of a phone number does not establish round-the-clock technical support.

Ask comparable practices about concrete incidents, actual training effort, unexpected charges, and whether they have exercised an export. Treat supplied references as selected experiences rather than a representative satisfaction survey.
