# Reconciliation and Acceptance

## Comparable Snapshots

Record scope, extraction time and timezone, inclusion filters, sites, schema versions, and exporter warnings. Keep file hashes when supported to identify the exact evidence analyzed. A hash documents file identity, not clinical correctness or completeness.

Define an approved mapping: source entity/field, target entity/field, identifier crosswalk, transformation, null handling, and exceptions. Retain original identifiers in the crosswalk. Do not strip prefixes or leading zeros unless the documented transformation requires it. Parse locale-specific dates and decimals only after resolving the locale.

For each entity report total rows, distinct valid keys, null keys, duplicate-key groups, missing keys, extra keys, and field differences. When identifiers change, compare through the crosswalk and flag unmapped or multiply mapped keys. A sample cannot establish whole-dataset counts unless those counts were separately measured.

Fictional example: source IDs are A, B, C; destination IDs are A, B, B. Both contain three rows. Destination distinct IDs are two; C is missing and B is duplicated. The migration fails identity reconciliation despite the matching total.

## Veterinary Records

Choose tests for entities actually in scope:

| Area                    | Compare                                                              | Review with the practice                                                             |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Client/patient identity | Stable IDs, crosswalk, ownership links, archived/deceased state      | Historic owners, shared ownership, access to previous-owner personal details         |
| Clinical history        | Encounters, dates, author, addenda, warnings, plans, attachments     | Meaning, chronology, amendments, and record readability                              |
| Medication information  | Recorded product, strength, units, instruction text, status          | Any altered value or active/discontinued mismatch; do not infer clinical equivalence |
| Diagnostics             | Orders, results, units, reference ranges, images and report links    | Whether results remain associated with the correct patient and encounter             |
| Operations              | Future appointments, recalls, tasks, responsible users, active forms | Missing reminders, unassigned follow-ups, changed statuses                           |
| Financial records       | Invoices, lines, taxes, payments, allocations, credits and deposits  | Account-level balance and historical audit trail, not just practice-wide total       |

Do not relabel similar medications, codes, or diagnoses as equivalent without an approved mapping. A PDF history may preserve readable content but lose searchable structured fields; show the trade-off rather than treating both forms as identical.

## Financial Reconciliation

Use exact decimal arithmetic or integer minor units with the confirmed currency precision. Do not assume all currencies have two decimal places. Keep currencies separate; compare like statuses, dates, gross/net treatment, and sign conventions.

Where the schema supports it, reconcile opening balance plus new charges and debit adjustments, minus payments and credit adjustments, to closing balance. Define what each term includes. Count a deposit or credit once according to the system's accounting treatment, not once on the account and again in its allocation.

Compare both entity-level records and aggregates by account and currency. Offsetting errors can conceal loss: a fictional source has account A = 100.00 and B = 50.00; target A = 80.00 and B = 70.00. Both total 150.00, but both accounts differ by 20.00. Do not accept the total as reconciliation.

Recompute using the approved rounding rules when transformations change precision. Report exact and tolerance-based differences separately; obtain owner approval for a tolerance instead of silently ignoring small discrepancies. A blank amount, unknown currency, or missing opening balance blocks the affected calculation.

## Attachments and Large Assets

Distinguish manifest row count, files present, nonempty files, files opened successfully, and record linkage. Check for absolute or parent-directory paths before processing an archive; inspect contents before extraction and keep extraction contained. Do not execute files.

An attachment URL may be a temporary reference rather than a durable export. If bytes are unavailable, report accessibility and persistence as untested. Compare hashes only when byte-for-byte identity is expected. A documented conversion changes hashes and requires format/content checks instead. A passing file signature does not prove every page or image renders correctly.

Use stratified sampling for manual review: long histories, multiple owners, archived records, amended notes, multiple currencies if present, unusual characters, and large attachments. Record the actual selection and why; do not invent statistical confidence for a convenience sample.

## Cutover Acceptance Checklist

- Practice-approved scope and mappings, with source snapshot and final delta included.
- Essential record relationships and clinically important fields reconciled.
- Account-level balances and assets checked within the agreed scope.
- Destination access and workflows demonstrated by the appropriate practice owners.
- Original evidence retained securely; a recovery approach with an observed restore test or an explicit untested blocker.
- Named cutover owner, communication plan, and criteria for stopping or postponing.
- An explicit source-of-truth decision during transition, including how to preserve records created after cutover if reverting. Restoring an old backup alone can lose new work.
- Continued lawful access to legacy records and a retention/exit plan approved for the practice's jurisdiction and agreement.

The audit proposes acceptance; only the responsible practice owners can approve it. Do not infer retention periods, account permissions, or a right to terminate the source contract.
