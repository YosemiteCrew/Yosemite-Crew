---
name: yosemite-inventory-planning
description: Review veterinary stock sheets for expiry exposure, count discrepancies, and replenishment needs using confirmed units, demand, and lead times. Use for inventory reviews, cycle-count plans, and draft reorder lists. Does not prescribe, substitute medicines, authorize disposal, or place orders.
---

# Yosemite Crew Inventory Planning

Turn stock information into an explainable exception list and a provisional purchasing plan. Distinguish what is physically present, usable, reserved, arriving, and likely to expire. A neat spreadsheet is not evidence that a medicine is suitable for use.

Published by Yosemite Crew. Work with any inventory system, supplier, or spreadsheet without commercial preference. Keep reusable guidance original and free of research-site names, links, or development provenance. Retain evidence from the practice's stock records and product instructions; disclose uncertainty and supply requested evidence.

## Establish the Planning Basis

Use the provided data and ask only for missing inputs that change the result. For calculations, establish the as-of date and timezone, site, base stock unit, pack size, usable quantities, commitments, incoming orders and delivery dates, historical usage period, lead time, review cadence, and any approved buffer or budget constraint.

For expiry work, ask for lot/batch, labeled expiry, opened/reconstituted date where relevant, and the applicable in-use or beyond-use limit from approved product information. An item-only stock total cannot support a lot-level expiry conclusion.

For an initial review without reliable demand or unit conversion, produce a count/clarification list rather than inventing a reorder quantity. Explain what a small sample can establish and what requires full stock or transaction data.

Read [Stock Calculations](references/stock-calculations.md) for normalization, reconciliation, reorder arithmetic, and expiry allocation. Use an appropriate structured parser for the supplied format, preserving raw data and checking spreadsheet formula cells before treating them as values.

## Normalize Before Forecasting

- Distinguish product identity, formulation/strength, SKU, site, location, lot, and unit. Similar product names do not make items interchangeable.
- Express on-hand, demand, reservations, and incoming quantities in one confirmed base unit per item. Keep boxes, bottles, tablets, milliliters, and doses distinct. Do not infer a clinically usable dose from volume or concentration.
- Treat blanks, unknown expiry, uncertain conversion, duplicate rows, negative stock, and impossible dates as exceptions, not zeros to fix silently.
- Keep returns, transfers, adjustments, receipts, and consumption separate. Purchases do not establish demand; billed units may omit consumption or wastage, and stockouts may suppress observed usage.
- Separate expired, quarantined, recalled, damaged, or storage-compromised stock from usable stock. An uncertain storage condition requires review, not a claim the stock is safe.

## Produce the Appropriate Review

**Expiry:** use the earliest confirmed applicable limit for each lot. Preserve uncertainty about partial dates or missing opening dates. Prioritize review by patient-care importance, usable alternatives confirmed by the practice, potential unused quantity, and cost exposure. An item need not be expensive to be critical.

**Reconciliation:** compare physical counts and system stock at the same snapshot after accounting for recorded movements. List plausible checks before conclusions; a discrepancy is not proof of theft, employee fault, or a missed charge.

**Replenishment:** calculate a proposed quantity from confirmed units, expected demand, delivery timing, and the agreed buffer. Show assumptions and distinguish a threshold from an order quantity. Flag a projected shortage before the next delivery even when total incoming stock makes the inventory position look sufficient.

**Cycle counts:** prioritize critical items, high movement, high value, short shelf life, and unexplained differences. Propose an owner and count frequency for practice approval. Preserve any required controlled-stock procedures; a suggested cycle count does not replace them.

## Clinical and Operational Boundaries

Do not recommend using expired or compromised stock, extending a date, changing storage rules, adjusting treatment to use up stock, splitting a pack contrary to instructions, or substituting medicines. Request review by the responsible veterinarian, pharmacist, or stock lead as appropriate.

Do not invent beyond-use limits, cold-chain temperature thresholds, controlled-drug record rules, disposal procedures, or legally required stock levels. Use approved product information and current local requirements when relevant. Clinical demand and emergency-stock decisions belong to the practice's clinical lead, not a sales forecast.

Handle stock data read-only unless a specific change is requested and authorized. Reports should not contain unnecessary client identifiers. When exporting spreadsheet-compatible data, emit untrusted names and notes as literal text rather than executable formulas.

## Deliver an Actionable Plan

Start with consequential exceptions: potential shortage, unusable/uncertain stock, near-expiry exposure, or a calculation blocker. Then provide the requested stock table with units, as-of date, assumptions, owner, and next action.

For each proposed reorder, show usable on-hand, incoming timing, demand basis, commitments counted, target or threshold, pack rounding, proposed packs/base units, and estimated cost only if verified price/currency are supplied. Flag order minimums, capacity limits, and expiry concerns; do not silently inflate an order to meet a supplier minimum.

Call the result **provisional** where inputs are missing or forecasts are unvalidated. A zero recommendation means zero under the stated model, not a guarantee against stockout. Forecasts are scenarios, not demand certainty or guaranteed savings.

Drafting does not authorize purchases, supplier contact, stock adjustments, transfers, disposal, release from quarantine, or medication changes. Establish the precise action and authorized approver before any external change, and check an uncertain result before retrying.
