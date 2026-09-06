#!/usr/bin/env bash
#
# Which startup controls stop a cutover, and - more importantly - which do not.
#
# /health/controls exists so a security control that FAILED TO APPLY does not
# look like one that was never asked to (apps/backend/src/config/startup-controls.ts).
# The deploy's smoke boot runs the real bundle against the real environment
# before cutover, which is the one moment a rollback is still free, and until
# now it read only /health - which answers 200 for a process whose entire /auth
# surface is 404, because /health is liveness and was designed to.
#
# The obvious wiring is wrong. /health/controls returns 503 whenever ANY control
# is `failed`, and stream-upload-policy records `failed` when Stream's
# updateAppSettings rejects. startup-controls.ts is explicit that this must not
# take the API down - "a Stream outage should not take the API down, it should
# be VISIBLE" - so gating cutover on the aggregate would convert a third-party
# outage into a blocked deploy, which is that decision inverted.
#
# Hence: NAMED controls, and a rule stated as a positive rather than a negative.

# deploy_blocking_control_failures <controls-json> <blocking-names>
#
# <blocking-names> is ONE argument: a whitespace-separated list. It used to be
# variadic, which forced the caller to leave its list unquoted for word
# splitting - and an unquoted expansion is also a pathname expansion, so a name
# containing a glob character would have expanded against the deploy host's
# working directory before this function ever saw it. Nothing sets such a name,
# and no test here can distinguish it because the expansion happens at the call
# site rather than in here. Taking one quoted argument removes the exposure by
# construction instead: node does the splitting, on whitespace, below.
#
# Echoes one line per named control that positively reports `failed`. Echoes
# nothing - and so ships - in every other case:
#
#   named control `failed`      BLOCK. The only blocking state.
#   named control `skipped`     ship. Auth switched off is a deployment fact,
#                               not a fault; treating it as one is the same
#                               mistake as ignoring the endpoint, mirrored.
#   named control ABSENT,       ship. A ROLLBACK deploys an older bundle that
#   body has no `expected`      never records the control, so blocking on
#                               absence would refuse the deploy most needed to
#                               work. Absence alone is not evidence of a fault,
#                               and the absence of `expected` is what marks the
#                               bundle as older than the declaration itself.
#
#   named control ABSENT,       ship. This bundle declares what it records and
#   `expected` omits it         does not claim this one. Same reasoning as the
#                               row above, arrived at positively rather than by
#                               a missing key: what the deploy asks to block on
#                               is not what this bundle knows how to report.
#
#   named control ABSENT from   BLOCK. The bundle said it would record this
#   a READABLE controls list,   control before it answered on its port, and then
#   `expected` NAMES it         #                               did not. That is a positive report of failure
#                               reconstructed from two facts instead of one, and
#                               it is why startup-controls.ts reports `expected`
#                               alongside the reports (#2759, #2761). It used to
#                               be indistinguishable from the two rows above.
#   endpoint unreachable,       ship. /health is already the liveness gate and
#   not JSON, or JSON whose     it runs first; a second liveness check that
#   `controls` is not an array  guesses at a body is not one. The last of those
#                               matters because of the BLOCK row below: a
#                               declaration can only contradict a list that was
#                               actually read, so an unreadable `controls` makes
#                               `expected` inert rather than damning. A readable
#                               EMPTY list is not this case - see that row.
#   unnamed control `failed`    ship. See the Stream reasoning above.
#
#   node itself cannot run      STOP THE DEPLOY, and this is the one row that is
#                               not decided here. Command substitution in an
#                               assignment carries the command's status, so
#                               api-deploy.sh's `set -e` fires before the cutover
#                               checks and the EXIT trap prints the rollback sha.
#                               Deliberate: an unreadable BODY is a fact about
#                               the process, but an interpreter that will not
#                               start is a gate that could not run, and a gate
#                               that could not run is not a gate that passed.
#                               The smoke boot proved node works two lines
#                               earlier, so reaching this is genuinely anomalous.
#
# The caller prints the body either way, so every one of those cases is
# reported. What this function decides is only which of them stops the deploy.
#
# Node rather than sed: the shape is ours, but a gate that mis-parses is worse
# than no gate, and the box already proved node works by booting the bundle on
# the smoke port two lines earlier.
deploy_blocking_control_failures() {
  local json="${1-}"
  local names="${2-}"

  # Both short-circuits only avoid a pointless subprocess: node reaches the same
  # answer for an unparseable body and for an empty name list. Neither carries
  # any part of the decision above, and removing them changes no test.
  [ -n "$json" ] || return 0
  [ -n "$names" ] || return 0

  DEPLOY_REQUIRED_CONTROLS="$names" node -e '
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => {
      const required = (process.env.DEPLOY_REQUIRED_CONTROLS || "")
        .split(/\s+/)
        .filter(Boolean);

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      // Whether the list of what WAS recorded can be read at all. This used to
      // be an inert defensive fallback - nothing distinguished an unreadable
      // list from an empty one, because only a report positively saying
      // failed could block and neither shape has one. Reading absence made it
      // load-bearing, and in the wrong direction: a body with a good
      // declaration and a controls key that is a string or missing would have
      // blocked, which is a body we cannot read stopping the deploy. Raised in
      // review on #2763.
      //
      // An EMPTY array is a different answer and still blocks: that is a list
      // we read, saying nothing was recorded, against a bundle that said it
      // would. Readable-and-empty is a contradiction; unreadable is not an
      // answer at all.
      const readable = Boolean(parsed) && Array.isArray(parsed.controls);
      const reports = readable ? parsed.controls : [];

      // What this bundle says it registers before answering on its port. A
      // body without the key predates the declaration, and a key of the wrong
      // shape is a body we cannot read - both ship, for the same reason an
      // unparseable body does. Only a well-formed list can turn an absent
      // report into a failure.
      //
      // The rule below is MEMBERSHIP, not presence, and that is deliberate:
      // the question asked of each name is "did this bundle claim it", never
      // "does this bundle have the key". Presence and an empty list therefore
      // decide identically, and an empty-array default in place of the null
      // below changes no answer - measured, not assumed. A presence-based
      // rule would be broken
      // by exactly that substitution, which is why it is not one.
      //
      // Array.isArray rather than truthiness is load-bearing and separate: a
      // string also has .includes, and "authentication".includes("authentication")
      // is true, so a malformed key would block every deploy.
      const declared =
        readable && Array.isArray(parsed.expected) ? parsed.expected : null;

      for (const name of required) {
        const report = reports.find(
          (candidate) => candidate && candidate.name === name,
        );
        if (!report) {
          // Absence decides nothing by itself. It becomes a failure only when
          // the declaration published by this same bundle contradicts it.
          //
          // No apostrophe and no backtick anywhere in this script: it is the
          // argument to node -e inside a SINGLE-quoted bash string, so either
          // one ends the quoting and the rest of the file becomes shell.
          if (declared && declared.includes(name)) {
            process.stdout.write(name + ": declared but never reported\n");
          }
          continue;
        }
        if (report.state !== "failed") continue;
        const detail =
          typeof report.detail === "string" && report.detail
            ? " (" + report.detail + ")"
            : "";
        process.stdout.write(name + ": failed" + detail + "\n");
      }
    });
  ' <<< "$json"
}
