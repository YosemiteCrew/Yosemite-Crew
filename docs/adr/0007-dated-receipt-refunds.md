# 0007. Dated receipt refunds

**Status:** Proposed
**Date:** 2026-10-03

## Context

A past client statement needs the refund total that applied at its cutoff. The latest total alone cannot show when earlier partial refunds happened, especially when notifications arrive out of order.

## Decision

Keep each refund notification's date and cumulative amount alongside the receipt total. Repeated notifications preserve the original history, and earlier notifications remain available even after a later total has been recorded.

## Consequences

### Good

Past statements can distinguish successive partial refunds. The current total and its dated history are saved together or neither is saved.

### Accepted trade-offs

Older refunds without dated evidence remain incomplete rather than being assigned an invented date. Statements for those periods require the missing records to be recovered.

Keep the known undated refund amount on each receipt, including refunds already present when dated history starts. Recording a newer cumulative total does not erase that amount. Refund totals can still advance, but statements remain unavailable until the missing dates are recovered. Receipt writes preserve undated amounts in the same database operation.

## Alternatives considered

Using the latest total for every period was rejected because it changes past balances. Recording only increases as notifications arrive was rejected because it loses earlier events delivered late.
