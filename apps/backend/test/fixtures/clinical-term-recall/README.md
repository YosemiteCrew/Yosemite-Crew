# Clinical term recall sample

The query sample and the harness behind the before/after numbers in #3375.

`sample.json` is generated, not written by hand. `build-sample.mjs` walks the shipped
vocabulary sorted by `ycCode` at a fixed stride, so the sample is reproducible and nobody
chose which queries appear in it:

```sh
node test/fixtures/clinical-term-recall/build-sample.mjs \
  data/yc_concepts.json test/fixtures/clinical-term-recall/sample.json
```

Five strata, 73 queries:

| kind          | n   | what it is                                                           |
| ------------- | --- | -------------------------------------------------------------------- |
| `issue`       | 3   | the queries named in the issue and in the maintainer's split comment |
| `reordered`   | 30  | a concept's own label with its words reversed                        |
| `shortened`   | 15  | the first and last word of a four-word-or-longer label               |
| `designation` | 15  | a SNOMED designation whose wording differs from the VeNom label      |
| `single-word` | 10  | control: these must be identical before and after                    |

`reordered` and `shortened` are wordings a clinician can reasonably type that no shipped
term contains as a substring, which is the defect. `designation` queries already work, and
are the control that widening does not disturb what worked. `single-word` queries are the
control for the statement being unchanged.

## Reproducing the measurement

Needs a Postgres with the migrations applied and the vocabulary imported
(`ClinicalTermsService.importFromFile("data/yc_concepts.json")`, 11,742 concepts). Run
`measure.ts` once from a checkout of the base commit and once from the branch, against the
same database, then compare:

```sh
npx tsx test/fixtures/clinical-term-recall/measure.ts \
  test/fixtures/clinical-term-recall/sample.json /tmp/before.json
node test/fixtures/clinical-term-recall/report.mjs /tmp/before.json /tmp/after.json
```

`report.mjs` scores a concept absent from the top 10 as position 11, so a query that never
surfaces its concept cannot be dropped from the mean and flatter the result. It also checks
two controls: that no single-word query moved, and that the before page is a prefix of the
after page.
