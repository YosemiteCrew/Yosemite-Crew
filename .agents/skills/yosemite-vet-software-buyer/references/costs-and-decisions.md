# Costs and Decisions

## Calculate the Same Scope

Use a common currency, tax treatment, user and site count, volume assumptions, start date, and time horizon. Show 12 months for an ordinary first comparison and a longer horizon when commitment or migration makes it relevant. State the actual horizon rather than calling every estimate a lifetime cost.

Separate invoiced cash costs, internal staff effort, contingent exit costs, and uncertain opportunity costs. Use actual quotes when supplied. Mark unknown charges as unknown, never zero. Do not treat a lower-bound subtotal as a complete total.

| Cost layer                    | Include when relevant                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial cash                  | Setup, data extraction, cleanup, migration, integration work, hardware, installation, training, travel, and nonrefundable deposits.                                    |
| Recurring cash                | Base subscription, clinician and staff accounts, sites, required modules, hosting, backups, support, interfaces, messaging, AI usage, and storage.                     |
| Transactions and variable use | Card processing, per-transaction fees, disputes, refunds, texts and segments, minutes, usage above quotas, and required minimum purchases.                             |
| Transition cash               | Overlapping subscriptions, temporary staffing, overtime, legacy access, and paid correction work.                                                                      |
| Exit cash                     | Notice-period commitments not already counted, early-termination charges if applicable, export assistance, hardware obligations, and replacement migration.            |
| Internal effort               | Training, data checking, maintenance, troubleshooting, manual re-entry, and administration. State hours and a supplied loaded hourly cost separately from cash outlay. |
| Opportunity cost              | Documented, scenario-based operational disruption. Treat lost capacity or revenue as uncertain and separate from payroll and profit.                                   |

For recurring amounts, calculate each period with its applicable price, license count, and consumption; include price increases from the date they apply. A flat multiplication is valid only when the rate and quantities are stable.

```text
Cash cost over horizon = initial cash + sum of recurring and usage cash
                      + transition cash + exit cash incurred in that horizon

Internal effort value = sum of hours by role x relevant loaded hourly cost

Payment cost = sum of processed volume by rate category x applicable rate
             + number of chargeable transactions x per-transaction fee
             + relevant fixed, dispute, refund, and other charges

Usage overage = max(0, chargeable usage - included allowance) x overage rate
```

Report minimum contractual commitment separately. Use remaining unavoidable payments after applying the actual termination rights, notice terms, credits, and refunds. Do not double count it on top of the same subscription payments in total cost.

Prevent double counting between the subscription and bundled items, between initial and migration fees, and between payment volume fees and per-transaction costs already included in a quoted blended rate. Confirm whether taxes are recoverable rather than silently excluding them.

## Original Hypothetical Example

The following is arithmetic practice, not a market price estimate. Both candidates are assumed to have equal required scope, fixed rates for 12 months, equal taxes excluded, and no other charges for this example only. Actual missing fees remain unknown.

| Item                                    | Candidate A | Candidate B |
| --------------------------------------- | ----------: | ----------: |
| Base each month                         |         300 |         550 |
| Required modules each month             |         180 |           0 |
| Initial setup                           |       2,000 |         800 |
| Year-one cost before payment processing |       7,760 |       7,400 |
| Illustrative processing rate            |        2.7% |        2.2% |
| Annual processed volume                 |     600,000 |     600,000 |
| Processing cost, percentage only        |      16,200 |      13,200 |
| Combined illustrative cash cost         |      23,960 |      20,600 |

Candidate B's base price is higher but the assumed first-year cash cost is 3,360 lower. This is a cost comparison, not a recommendation: workflow, terms, security, implementation, and unknown charges can change the choice. In a real comparison include card mix, fixed transaction charges, settlement terms, and whether those rates are actually available.

## Benefits Without Invented Savings

Measure a baseline and then the same task with the proposed tool. Distinguish time released, actual cash saved, added capacity used, and contribution earned. Avoid claiming that all saved minutes turn into revenue or reduced payroll.

```text
Potential time released per month = relevant tasks per month
                                 x observed minutes saved per task / 60

Potential labor value = time released x loaded hourly cost

Break-even incremental contribution per month = incremental monthly cash cost
                                             + initial incremental cash / chosen months
```

Report labor value as capacity unless reduced expenditure is evidenced. If projecting added appointments, constrain them by demand and staffing, and use contribution after variable costs rather than gross revenue. Do not add the value of saved time and the contribution from appointments using that same time without a defensible separation.

Use buyer-supplied low, expected, and high usage or migration-effort scenarios where uncertainty matters. Show which assumptions would change the decision. Do not insert unverified industry percentages for revenue leakage, migration loss, AI accuracy, or productivity.

## Score Only What Evidence Supports

Start with essential conditions. Record each as pass, fail, or unknown with the evidence and owner of the next check. A fail or unknown cannot be canceled by a high score elsewhere.

If there are several plausible options, agree a few weighted criteria before scoring. Categories might include workflow fit, staff usability, integration fit, commercial terms, full cost, implementation, support, and operational resilience. Avoid counting the same benefit twice under different headings.

Weights express this buyer's preferences, not an industry standard. Use nonnegative weights with a positive total; normalize them to 100 for presentation. Set the applicable criteria once for every candidate. If a criterion is inapplicable to the purchase, remove it for all candidates before scoring; do not drop a weak criterion for one supplier.

| Score   | Evidence of fit for this buyer                                               |
| ------- | ---------------------------------------------------------------------------- |
| 0       | Evidence establishes the requirement cannot be met.                          |
| 1       | Major limitation or costly workaround.                                       |
| 2       | Partly meets the requirement with material tradeoffs.                        |
| 3       | Meets the agreed acceptance criteria.                                        |
| 4       | Meets the criteria with demonstrated additional value relevant to the buyer. |
| Unknown | Insufficient evidence; not a zero or a pass.                                 |

Keep supplier statements, observed test results, and contractual commitments identifiable alongside each score. A statement about a capability alone should remain provisional until the evidence required for that criterion is obtained.

For weights totaling 100:

```text
Evidence coverage = sum of weights with an evidenced score
Lower supported score = sum of weight x evidenced score / 4
Upper possible score = lower supported score + sum of unknown weights
```

The resulting interval is an evidence range, not a statistical confidence interval or probability of success. Do not renormalize over the known criteria: a product with one good answer must not appear perfect. When evidence is complete the lower and upper values coincide.

Hypothetical check: weights 40, 35, and 25; scores 3, unknown, and 2. Evidence coverage is 65%; the supported score range is 42.5 to 77.5 out of 100. The unknown criterion still needs evaluation. An unresolved essential condition independently blocks purchase approval.

If candidate ranges overlap or reasonable changes in weights change the winner, describe the tradeoff and collect the evidence most likely to resolve it. Do not manufacture a ranking.

## Buyer Decision Memo

Use only the sections that help the specific decision:

1. **Recommendation:** What to do now, why, and the conditions that would change it.
2. **Context:** Category, jurisdiction, practice size, must-have workflows, budget, dates, and assumptions.
3. **Essential conditions:** Pass, fail, and unknown, each with evidence.
4. **Comparison:** Same-scope costs, minimum commitment, material strengths and limitations, and evidence status.
5. **Contract findings:** Clause reference, commercial consequence, requested change, and next owner.
6. **Trial and transition:** Acceptance scenarios, readiness conditions, records continuity, and exit arrangements.
7. **Open questions:** Prioritized by consequence and whether the answer can change the decision.

The final action should be concrete: obtain a complete export sample, clarify a renewal deadline, request an itemized quote, test a named workflow, negotiate a particular term, or decline an unsuitable option. A sales call is not the automatic next step.
