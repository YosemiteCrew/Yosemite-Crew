# Coverage gates

Two gates run over the same merged coverage report, and they answer different
questions. Both live in `.github/workflows/_test.yaml`.

## Aggregate floor (`COVERAGE_FLOORS`)

Enforced by `scripts/ci/merge-coverage.mjs` on every run. It merges the shard
reports into one istanbul map and checks the whole-app percentage for each of
statements, branches, functions and lines.

This is a regression tripwire for the app as a whole. It cannot detect untested
code arriving in a single pull request: frontend measures around 98% against a
floor of 80, so eighteen points of uncovered code can accumulate before the
number moves, and backend and mobile sit at `lines=1`, which only catches a
report that measured nothing at all.

## Added-line floor (`DIFF_COVERAGE_FLOORS`)

Enforced by `scripts/ci/diff-coverage.mjs`, on pull requests only. It diffs the
branch against its merge base and requires that a given share of the executable
lines the branch **adds** are covered.

Properties worth knowing:

- **Only added lines count.** Touching one line of a poorly covered legacy file
  does not make covering the rest of that file your problem. The cost of the
  gate scales with the size of the change.
- **Non-executable lines are excluded from both sides of the ratio.** Comments,
  blank lines, type-only declarations and interfaces never appear in the
  coverage map, so a documentation-heavy diff is not penalised.
- **A new file with no test fails.** Every app sets `collectCoverageFrom`, so an
  untested source file appears in the map with zero hits rather than being
  absent from it.
- **Files outside `collectCoverageFrom` are reported but never gated.** Test
  files, `.d.ts` files and explicitly excluded paths are listed as
  "not instrumented" and excluded from the ratio.
- **A diff that adds no executable lines passes.** The aggregate floor still
  applies to the app as a whole.
- **It fails closed.** A missing, empty or unparseable coverage map is an error,
  never a pass. A gate that measures nothing must not report success.

Push runs skip this gate. Once several pull requests have landed together there
is no meaningful "lines this change adds", and the aggregate floor already
guards the branch.

### Coverage needs source maps under the v8 provider

Three of the four apps set `coverageProvider: 'v8'`, which maps compiled output
back to source through source maps. Where those maps are missing, v8-to-istanbul
cannot attribute ranges and reports **every line of a loaded module as
executed**, including function bodies nothing calls.

`apps/desktop` hit exactly this: its `tsconfig.test.json` inherited
`sourceMap: false` from the production tsconfig. Fixed in issue #2238 by setting
`sourceMap: true` for the test config.

The failure is worth recognising because of its shape rather than its size. The
aggregate barely moved when it was fixed:

| metric     | before             | after              |
| ---------- | ------------------ | ------------------ |
| statements | 98.12% (9505/9687) | 98.01% (9495/9687) |
| branches   | 89.02% (2238/2514) | 89.5% (2174/2429)  |
| functions  | 99.32% (592/596)   | 99.3% (575/579)    |

Desktop's suite really does execute nearly everything, so almost no existing
line was being credited falsely. What broke was the marginal case: **newly added
dead code measured as fully covered**, so the added-line gate could not fail on
this app and the aggregate floor could not notice new uncovered code either. An
aggregate that looks right is not evidence that the underlying data is right.

If you add an app or change a transform, verify with a canary: append an
exported function nothing calls, run coverage, and confirm its body reports zero
hits. `apps/backend` also uses the v8 provider and has not been checked this way.

### Ratcheting the floors

`frontend` and `desktop` are set at the standard their suites already meet.
`backend` and `mobile` start lower on purpose: neither has ever been held to a
coverage number, and a gate calibrated to where they ought to be rather than
where they are gets switched off rather than met.

Every run logs the measured figure:

```
diff-coverage: 46/50 added executable lines covered (92%), floor 60%
```

When an app's measured figure has sat comfortably above its floor for a while,
raise the floor in `DIFF_COVERAGE_FLOORS`. Raise it in small steps; the point is
that the number only ever moves up.

### Running it locally

The gate needs a merged coverage map, which `merge-coverage.mjs` writes next to
`lcov.info` as `coverage-final.json`. A single unsharded run produces one
directly:

```sh
pnpm --filter @yosemite-crew/desktop exec jest \
  --coverage --coverageReporters=json --coverageDirectory=coverage

git diff --unified=0 origin/dev...HEAD -- apps/desktop > changed.diff

node scripts/ci/diff-coverage.mjs \
  --coverage apps/desktop/coverage/coverage-final.json \
  --diff changed.diff \
  --floor 90 \
  --app-dir apps/desktop
```

Output marks each measured file `ok` or `MISS`, and lists the uncovered line
ranges for anything that missed.
