# 0006. Dated invoice history

**Status:** Proposed
**Date:** 2026-10-03

## Context

A client statement for a past period must retain the charges and due dates that applied then. Later amendments, finalization or cancellation must not replace that earlier picture.

## Decision

Preserve each change to an invoice's amount, currency, account, status and payment dates together with the invoice change. Give each revision a date and an ordering that remains unambiguous when several changes occur together.

## Consequences

### Good

Past statements can distinguish the original charge from a later amendment or cancellation. An unsuccessful invoice change leaves no revision behind.

### Accepted trade-offs

Existing invoices start with a clearly marked baseline, not an invented earlier history. Periods before the available history may require correction of the underlying records before a statement can be generated.

## Alternatives considered

Using the current invoice for every period was rejected because it changes past balances. Recording revisions separately from invoice changes was rejected because one could succeed without the other.
