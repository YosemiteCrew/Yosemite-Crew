# @yosemite-crew/agent-runtime

A provider-neutral execution boundary for optional Yosemite Crew agent workflows.

Workflows, tool schemas, source references, permissions, run identity and case
state stay in this package and in product code. Everything a vendor defines -
wire shape, session identifiers, authentication, request and response
translation - stays inside an adapter under `src/providers/`.

Nothing here is mounted on a route. This is the boundary and its contract
tests; enabling an agent surface is separate work.

## What the boundary owns

| Product-owned (this package)                | Vendor-owned (an adapter)           |
| ------------------------------------------- | ----------------------------------- |
| Run identifiers (`run-...`)                 | Session identifiers, request ids    |
| Workflow definition and instructions        | Prompt/session encoding on the wire |
| Tool schemas and the permission each needs  | Tool call encoding                  |
| Permission decisions and the audit trail    | Nothing                             |
| Result validation                           | Producing the candidate result      |
| Checkpoints, resume and restart             | Optional provider-side resume       |
| Budgets and the data-egress acknowledgement | Reporting usage                     |
| The normalised error taxonomy               | Mapping its own failures onto it    |

A vendor session identifier reaches `AgentRuntime` through
`hooks.onProviderSession` and is held in a private map. It is not written into
an event, a result or a checkpoint, and the first one announced for a run wins -
an adapter cannot repoint a product run at a second vendor conversation.

## Capability contract

`ExecutionProvider.capabilities()` declares what an adapter can do:

| Capability          | Meaning                                                 |
| ------------------- | ------------------------------------------------------- |
| `tool-calls`        | The provider can ask the product to run a declared tool |
| `structured-output` | The provider returns a document, not free text          |
| `progress-events`   | The provider reports intermediate progress              |
| `cancellation`      | A run in progress can be stopped                        |
| `provider-resume`   | The provider can continue a run it already holds        |

`ExecutionConfig.requiredCapabilities` is checked at construction.
A provider that cannot meet one is rejected with `capability-unsupported`,
naming the capability. There is no silent downgrade and no failover: a
configuration that names an unregistered provider throws rather than choosing a
registered one.

`provider-resume` is the only capability where a missing entry has a documented
fallback rather than a refusal. `AgentRuntime.resume` restarts from the product
checkpoint instead, re-reading record versions and the caller's current
permissions on the way in. That is a deliberate product decision: a resumed run
must not inherit authority from a vendor transcript.

## Normalised errors

Every failure a product surface can see is one of:
`budget-exceeded`, `cancelled`, `capability-unsupported`, `configuration-invalid`,
`credential-expired`, `credential-revoked`, `malformed-output`,
`permission-denied`, `provider-unavailable`, `unknown-run`.

An adapter that throws something unmapped is reported as `provider-unavailable`
and retryable. It is never a reason to try a different provider.

## Adding or swapping a provider

1. Add `src/providers/<name>/<name>-provider.ts` exporting a factory
   `(config: ExecutionConfig) => ExecutionProvider`. Take the transport and the
   credential resolver from the config; do not import a vendor SDK into any
   other directory.
2. Declare `capabilities()` honestly. Claiming `provider-resume` without one
   costs a run; omitting it costs a restart.
3. Map the wire's failures onto the error taxonomy. `normaliseTransportError`
   already covers HTTP 401 and 403.
4. Register the factory in `defaultProviderRegistry`.
5. Add the adapter to the `wires` table in `test/contract.test.ts`. The whole
   contract suite then runs against it unchanged - that is the portability
   check, not a separate test file.
6. Change `ExecutionConfig.provider` to select it. No domain workflow, tool
   schema or persona UI changes.

## Credentials and data egress

`ExecutionConfig.credential` is a resolver, not a value, so a credential is
fetched per request and is never held on the config object or captured in a log
line by being in scope. A resolver that throws is normalised like any other
failure.

`dataEgressAcknowledged` must be `true` or no provider is built at all. Sending
records to a provider is an explicit decision, taken once, per configuration.

## Budgets

`budget.maxToolCalls` is enforced in flight: the call that would exceed it is
refused, audited as a denial, and the run fails `budget-exceeded`.

`budget.maxCostUsd` is checked against the usage a provider reports, which
providers only report at the end of a run. It therefore fails a run after the
spend rather than preventing it. Use `maxToolCalls` for the hard stop.

## No-provider mode

Nothing in ordinary scheduling, clinical or billing work imports this package.
With no provider configured there is no agent surface and no behaviour change.

## Measured results

Measured on the branch for issue #3049 with `pnpm --filter
@yosemite-crew/agent-runtime run test:coverage`:

- 93 tests across 5 suites, all passing.
- Coverage: 98.7% statements, 92.19% branches, 100% functions, 98.65% lines.
- The contract suite runs 12 cases against each of the two adapters. Both
  produce identical briefings (deep equality) from the same synthetic fixture, and degrade
  identically when a tool is refused.
- 10 targeted mutants, all killed: dropped permission check, loosened budget
  comparison, lost first-session-wins, removed post-run budget guard, unnamed
  stop reason, skipped source refresh on resume, skipped capability
  negotiation, accepted unsourced finding, ignored egress acknowledgement,
  removed terminal-state progress guard.

No live provider credentials are needed for any of it: both adapters take their
transport from configuration, and the tests supply scripted ones.

## Known gaps

- The two adapters are exercised against scripted transports. A live hosted
  provider may reject or reshape a request in ways a script does not, so a
  first live run should be treated as a new measurement.
- `maxCostUsd` is post-hoc, as described above.
- The managed-session adapter's resume replays tool calls. A provider that
  resumes with its tool results intact will do less work than the contract test
  demonstrates, not more.
