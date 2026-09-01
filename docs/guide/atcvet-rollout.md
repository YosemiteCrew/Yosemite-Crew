# ATCvet rollout

The ATCvet medication spine ships as code plus a data file; the database rows are
created by an import, not by a migration. A deploy therefore creates the enums,
columns and indexes but leaves the vocabulary empty until the import is run once
per environment.

That separation is deliberate. The index changes once a year, while the API
deploys many times a week, so running an 8,315-row import on every deploy would
add minutes to each one to re-write rows that have not changed. It also keeps a
bad data file from riding out with an ordinary code deploy.

## After deploying a release that adds or updates ATCvet

Run once, on the target environment, from `apps/backend`:

```bash
pnpm import:atcvet-index                 # dry run: prints counts and every skip
pnpm import:atcvet-index -- --apply      # writes
```

Expected on the 2026 release: `8315 codes (6417 substances, 1898 groups), 8300
edges` and no skips. The import is idempotent, so re-running it is safe.

Optionally link the practice's own drug list and stock to the spine:

```bash
pnpm backfill:atc-codes                  # dry run: reports every match and skip
pnpm backfill:atc-codes -- --apply
```

The backfill never guesses: a drug whose name matches no ATCvet substance, or
matches several, stays uncoded and is listed with the reason.

## Yearly release

Convert the new workbook, then re-run the import:

```bash
node apps/backend/scripts/convert-atcvet-xlsx.mjs "<new index>.xlsx" apps/backend/data/atcvet_index.json
pnpm import:atcvet-index -- --apply
```

Codes withdrawn by the new release are deactivated, not deleted, so existing
prescriptions and formulary rows that reference them still resolve. Retirement is
skipped entirely when the extract does not look like a complete release (fewer
than 5,000 codes, or more than 10% smaller than what is currently active), which
stops a truncated file from switching the vocabulary off.

## Verifying

```bash
# substances are searchable
curl -s "$API/v1/codes/medications/suggest?q=doxycycline" | jq '.items[0]'
```

A coded prescription then exports an ATCvet coding under
`http://www.whocc.no/atcvet` in its `medicationCodeableConcept`.
