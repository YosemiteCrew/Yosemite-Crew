# Clinical term ordering sample

The crowded-page sample behind the ordering numbers in #3375.

`clinical-term-recall/` next door measures whether the right concept is reachable at all.
This one measures what the first page looks like once it is, which is the second
complaint in the issue body: "renal" matches 119 concepts and the first page is
alphabetical noise, with every "Renal failure" entry absent.

`sample.json` is generated, not written by hand:

```sh
node test/fixtures/clinical-term-ordering/build-sample.mjs \
  data/yc_concepts.json test/fixtures/clinical-term-ordering/sample.json
```

A query qualifies if it is the first word of some concept's label, is at least four
characters, and at least fifteen concepts share that prefix. 169 queries qualify; a fixed
stride over them in `ycCode` order takes 60, so nobody chose which appear. `renal` is
added explicitly if the stride misses it, because the issue names it.

## What this can and cannot measure

There is no ground truth for what a clinician typing "renal" intends. The issue's
acceptance criteria ask for "the position of the expected concept", and for a one-word
query there is no expected concept - which is why `clinical-term-recall/sample.json`
marks its single-word queries as ordering cases with `expected: null`.

So this sample carries no expected answers and `report.mjs` claims no recall figure. It
reports the two pages in full, plus one descriptive figure: how much of the first page a
single label family occupies, where a family is a label's first two words. That key is
deliberately coarse - it treats "Renal (kidney) cyst" and "Renal (kidney) disorder" as
one family - and it is applied identically to both arms.

**It is descriptive, not a proof.** A tiebreak that prefers shorter labels will tend to
spread first-two-word families apart on its own, so the figure describes the change
rather than justifying it. The evidence that the change does not cost anything is the
recall sample next door, whose expected concepts were chosen by stride rather than by
length; the evidence that it helps is the pages themselves, printed in full so a reviewer
can disagree with them.

## Reproducing the measurement

Needs a Postgres with the migrations applied and the vocabulary imported
(`ClinicalTermsService.importFromFile("data/yc_concepts.json")`, 11,742 concepts). Run
`measure.ts` from the recall fixture once from a checkout of the base commit and once
from the branch, against the same database, then compare:

```sh
npx tsx test/fixtures/clinical-term-recall/measure.ts \
  test/fixtures/clinical-term-ordering/sample.json /tmp/before.json
node test/fixtures/clinical-term-ordering/report.mjs /tmp/before.json /tmp/after.json
```
