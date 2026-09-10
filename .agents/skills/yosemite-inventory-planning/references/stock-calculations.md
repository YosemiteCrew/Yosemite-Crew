# Stock Calculations

## Units and Reconciliation

Define a base unit per item and record every conversion. Fictional example: three boxes of 20 single-use items plus four loose items is 64 items, not seven or 3.2 boxes to order. Distinguish the counting unit from the purchasable pack.

Expected closing stock = opening stock + receipts + transfers in + approved positive adjustments - consumption - transfers out - approved negative adjustments. Classify returns according to their actual direction and usability. Do not count a returned item as usable automatically.

Physical variance = counted stock - expected closing stock, in the same unit and at the same time. A positive variance is an excess relative to the ledger, not automatically an accounting gain. Investigate unit conversion, cutoff timing, unposted movements, and count method before proposing a correction.

## Demand Basis

Show the actual time window and denominator. If 300 units were consumed over 30 calendar days, average demand is 10 units per calendar day. A lead time in working days needs a consistent calendar or a stated conversion; do not multiply incompatible units.

Distinguish ordinary consumption, exceptional one-off use, booked demand, returns, and wastage. Explain any exclusion. Where stockouts occurred, observed consumption may understate demand. Where demand is zero or negative, report days of supply as not estimable under this model rather than dividing by zero or reporting negative days.

Use a recent representative period chosen with the practice. For seasonal or intermittent demand, show scenarios or a range rather than inventing a precise service-level buffer. A user-specified safety stock is a planning input, not a statistically validated guarantee.

## Reorder Arithmetic

Use an agreed inventory policy. For a simple periodic review, define:

- d: expected base-unit demand per day.
- L: confirmed replenishment lead time in the same day basis.
- R: interval until the next order review, in that day basis.
- S: approved safety stock in base units.
- H: usable on-hand stock.
- O: confirmed incoming stock that arrives within the relevant planning horizon; track exact timing separately.
- C: unmet commitments not already included in forecast demand. Do not subtract reservations here if H is already net of those reservations.

Inventory position P = H + O - C.

Order-up-to target T = d x (L + R) + S.

Proposed base-unit gap Q = max(0, T - P).

For pack size B, proposed packs = ceiling(Q / B); proposed ordered units = packs x B. Do not round down a positive fractional pack unless split-pack purchasing is confirmed. Apply and disclose actual minimum order and pack-multiple rules only after this calculation, then flag any excess stock they create.

A continuous-review reorder point d x L + S is a trigger, not the order-up-to target or order quantity. Do not mix these two policies without stating the chosen rule. Unknown L, B, or usable H blocks a precise order proposal. A missing S can support a clearly labeled no-buffer scenario, not a claim that zero safety stock is adequate.

### Fictional Worked Example

Use d = 4 items/calendar day, L = 5 days, R = 7 days, S = 8 items, H = 18 items, O = 20 items arriving on day 3, C = 6 items, and B = 12 items/pack. Commitments are additional to forecast, due now, and H has not already subtracted them.

P = 18 + 20 - 6 = 32 items. T = 4 x 12 + 8 = 56 items. Q = 24 items, so the proposed order is two packs, totaling 24 items.

This total-position calculation is not a timing check. Starting available stock is 12 items after commitments; at four items/day it reaches zero at day 3. The incoming order's precise arrival time therefore matters. If it slips to day 6, the plan has a pre-delivery shortage even though P and the two-pack calculation are unchanged. Escalate the shortage for an approved response; do not invent a substitute medicine or assume a new order arrives sooner.

## Expiry-Aware Projection

Track lots separately and allocate forecast consumption in date order, using earliest applicable expiry first among otherwise usable, permitted lots. Include dated receipts and commitments only once. Remove any remaining lot quantity from projected usability when its confirmed limit is reached. Do not count units forecast to expire before use as future supply.

Fictional example: lot A has 30 units usable until the end of day 2; lot B has 50 units usable throughout the horizon. Demand is 10 units per day, with no additional commitments or receipts. Allocate 20 units to A over days 1 and 2; its remaining 10 units become potential unused expiry exposure. Do not also allocate those same 20 demand units to B. Actual use may differ from the forecast.

Use the earliest confirmed applicable date among labeled expiry and approved in-use/beyond-use limits. An unknown opened date or an ambiguous month-only label is an unresolved input, not an invented exact deadline. Segregate uncertain quantities in the report for physical/product-information review.

Value projected unused quantities using the supplied unit acquisition cost and currency, if known. Retail sales value, inventory carrying value, and avoidable cash loss are different measures. Do not call all expiry exposure a realizable saving or recoverable supplier credit.

## Output Fields

For an expiry list: item, site, lot, unit, usable/held quantity, applicable limit and evidence, projected unused quantity, cost basis if known, uncertainty, and review owner.

For a reorder list: item/site, unit and pack conversion, H/O/C, delivery dates, d/L/R/S, P/T/Q, packs, projected shortage date if supported, expiry/capacity constraints, and approval status. For missing inputs, leave affected calculations unknown rather than inserting zeros.
