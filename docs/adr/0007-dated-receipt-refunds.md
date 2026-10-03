# 0007. Dated receipt refunds

**Status:** Proposed
**Date:** 2026-10-03

## Context

A past client statement needs the refund total that applied at its cutoff. The latest total alone cannot show when earlier partial refunds happened, especially when notifications arrive out of order.

## Decision

Client statements use the original amount and date of each completed refund. Repeated notifications do not add a refund twice, and a later notification can supply earlier refund records.

## Consequences

### Good

Past statements show earlier partial refunds on their original dates and show later refunds only after they happen. Each completed refund retains its original amount.

### Accepted trade-offs

Older refunds without dated evidence remain incomplete rather than being assigned an invented date. Statements for those periods require the missing records to be recovered.

Recording a newer total does not supply missing dates. Statements remain unavailable until the recovered refund amounts match the receipt's refunded total.

## Alternatives considered

Using the latest total for every period was rejected because it changes past balances. Recording only increases as notifications arrive was rejected because it loses earlier events delivered late.
