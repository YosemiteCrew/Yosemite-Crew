#!/usr/bin/env node
// Keep the public roadmap board honest, automatically.
//
// Usage:
//   node scripts/roadmap/sync.mjs --dry-run
//   node scripts/roadmap/sync.mjs
//   node scripts/roadmap/sync.mjs --archive-after-days 30 --json
//
// Requires a token with the `project` scope in GITHUB_TOKEN or ROADMAP_TOKEN.
// The Actions GITHUB_TOKEN cannot write to an ORGANISATION project no matter how
// its permissions block is written, so the workflow passes a PAT instead. That is
// a GitHub limitation, not an oversight here.
//
// What it does, every run:
//   1. Adds every open issue in the repo that is missing from the board.
//   2. Fills empty Category/Priority/Start date cells from the issue itself.
//   3. Forces Status to match the tracker when the tracker is unambiguous
//      (closed -> Completed, reopened -> back to an open status).
//   4. Archives items whose issue closed more than --archive-after-days ago.
//
// What it deliberately does NOT do: overwrite a Category, Priority or open Status
// that a human has already set. The board is meant to be editable; an automation
// that reverts your edit overnight trains everyone to stop editing. Only facts
// the tracker owns - is it closed, when was it opened - are enforced.
//
// Step 4 is the part that stops the rot. The board reached 388 items / 387 closed
// because nothing ever left it. Completed work stays visible for a month so a
// reader can see recent shipping, then archives - archived items are retained by
// GitHub and can be restored, so no history is lost.
import { argv, env, exit, stdout, stderr } from 'node:process';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import {
  CATEGORIES,
  STATUSES,
  classifyCategory,
  classifyPriority,
  classifyStatus,
  targetDateFor,
  PRIORITIES,
  STATUS_RANK,
} from './classify.mjs';

const OWNER = env.ROADMAP_OWNER || 'YosemiteCrew';
const REPO = env.ROADMAP_REPO || 'Yosemite-Crew';
const PROJECT_NUMBER = Number(env.ROADMAP_PROJECT_NUMBER || 6);
const API = 'https://api.github.com/graphql';

const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const DRY_RUN = Boolean(arg('dry-run', false));
const AS_JSON = Boolean(arg('json', false));
const ARCHIVE_AFTER_DAYS = Number(arg('archive-after-days', 30));

const token = env.ROADMAP_TOKEN || env.GITHUB_TOKEN;

const log = (msg) => {
  if (!AS_JSON) stdout.write(`${msg}\n`);
};

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      authorization: `bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'yosemite-roadmap-sync',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GitHub GraphQL HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const body = await res.json();
  if (body.errors?.length) {
    // INSUFFICIENT_SCOPES is the failure everyone hits first, so name the cure.
    const scopeError = body.errors.find((e) => e.type === 'INSUFFICIENT_SCOPES');
    if (scopeError) {
      throw new Error(
        `GitHub rejected the call for missing scopes. The token needs the \`project\` scope. ${scopeError.message}`
      );
    }
    throw new Error(`GitHub GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  return body.data;
}

// Page through any connection without hand-rolling a cursor loop per query.
async function paginate(query, variables, pick) {
  const out = [];
  let cursor = null;
  for (;;) {
    const data = await gql(query, { ...variables, cursor });
    const conn = pick(data);
    out.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) return out;
    cursor = conn.pageInfo.endCursor;
  }
}

const PROJECT_QUERY = `
query($owner:String!, $number:Int!) {
  organization(login:$owner) {
    projectV2(number:$number) {
      id title url
      fields(first:50) {
        nodes {
          ... on ProjectV2FieldCommon { id name dataType }
          ... on ProjectV2SingleSelectField { id name options { id name } }
        }
      }
    }
  }
}`;

const ITEMS_QUERY = `
query($owner:String!, $number:Int!, $cursor:String) {
  organization(login:$owner) {
    projectV2(number:$number) {
      items(first:100, after:$cursor, archivedStates:[ARCHIVED, NOT_ARCHIVED]) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isArchived
          fieldValues(first:30) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
              ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
              ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } }
            }
          }
          content {
            ... on Issue { id number state stateReason closedAt }
            ... on PullRequest { id number state closedAt }
          }
        }
      }
    }
  }
}`;

// Open issues, with the linked PRs that tell us whether work has actually begun.
const OPEN_ISSUES_QUERY = `
query($owner:String!, $repo:String!, $cursor:String) {
  repository(owner:$owner, name:$repo) {
    issues(first:50, after:$cursor, states:[OPEN], orderBy:{field:CREATED_AT, direction:ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id number title body state createdAt
        labels(first:20) { nodes { name } }
        assignees(first:10) { nodes { login } }
        closedByPullRequestsReferences(first:10, includeClosedPrs:false) {
          nodes { number state isDraft }
        }
      }
    }
  }
}`;

// Every open pull request, with whatever issues it says it closes.
//
// The obvious source, Issue.closedByPullRequestsReferences, is empty for every
// issue in this repository: GitHub only records a closing reference when the PR
// targets the DEFAULT branch, and every PR here targets `dev`. Relying on it left
// the "Under Testing" column holding 0 of 96 items, unreachable by construction.
// So read the PRs directly and match them back to issues ourselves.
const OPEN_PRS_QUERY = `
query($owner:String!, $repo:String!, $cursor:String) {
  repository(owner:$owner, name:$repo) {
    pullRequests(first:50, after:$cursor, states:[OPEN]) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number state isDraft title body
        closingIssuesReferences(first:10) { nodes { number } }
      }
    }
  }
}`;

// "Fixes #123", "closes #123", "resolved #123". Deliberately the same verb set
// GitHub itself honours, so the map matches what a reader would expect.
const CLOSING_KEYWORD = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)\b/gi;

/** issue number -> [{ state, isDraft }] for every open PR that claims to close it. */
export function buildLinkedPrMap(pullRequests) {
  const map = new Map();
  const add = (num, pr) => {
    if (!map.has(num)) map.set(num, []);
    const bucket = map.get(num);
    if (!bucket.some((p) => p.number === pr.number)) bucket.push(pr);
  };
  for (const pr of pullRequests) {
    const entry = { number: pr.number, state: pr.state, isDraft: pr.isDraft };
    // Union of both sources: the structured one keeps working if `dev` ever
    // becomes the default branch, the text one is what actually fires today.
    for (const n of pr.closingIssuesReferences?.nodes || []) add(n.number, entry);
    for (const m of `${pr.title || ''}\n${pr.body || ''}`.matchAll(CLOSING_KEYWORD)) {
      add(Number(m[1]), entry);
    }
  }
  return map;
}

const UNARCHIVE_ITEM = `
mutation($projectId:ID!, $itemId:ID!) {
  unarchiveProjectV2Item(input:{projectId:$projectId, itemId:$itemId}) { item { id } }
}`;

const ADD_ITEM = `
mutation($projectId:ID!, $contentId:ID!) {
  addProjectV2ItemById(input:{projectId:$projectId, contentId:$contentId}) { item { id } }
}`;

const ARCHIVE_ITEM = `
mutation($projectId:ID!, $itemId:ID!) {
  archiveProjectV2Item(input:{projectId:$projectId, itemId:$itemId}) { item { id } }
}`;

const SET_SELECT = `
mutation($projectId:ID!, $itemId:ID!, $fieldId:ID!, $optionId:String!) {
  updateProjectV2ItemFieldValue(input:{
    projectId:$projectId, itemId:$itemId, fieldId:$fieldId,
    value:{singleSelectOptionId:$optionId}
  }) { projectV2Item { id } }
}`;

const SET_DATE = `
mutation($projectId:ID!, $itemId:ID!, $fieldId:ID!, $date:Date!) {
  updateProjectV2ItemFieldValue(input:{
    projectId:$projectId, itemId:$itemId, fieldId:$fieldId, value:{date:$date}
  }) { projectV2Item { id } }
}`;

const fieldValue = (item, name) => {
  for (const n of item.fieldValues?.nodes || []) {
    if (n?.field?.name === name) return n.name ?? n.text ?? n.date ?? null;
  }
  return null;
};

// Load the board and prove it still has the shape this script expects. Option
// ids are resolved by NAME every run: updateProjectV2Field regenerates every
// option id whenever the option set is edited, so a cached id is a time bomb.
async function loadBoard() {
  const project = (await gql(PROJECT_QUERY, { owner: OWNER, number: PROJECT_NUMBER })).organization
    .projectV2;
  if (!project) throw new Error(`No project #${PROJECT_NUMBER} on ${OWNER}`);

  const fields = new Map(project.fields.nodes.filter(Boolean).map((f) => [f.name, f]));
  const missing = ['Status', 'Category', 'Priority', 'Start date', 'End date'].filter(
    (n) => !fields.has(n)
  );
  if (missing.length) throw new Error(`Board is missing fields: ${missing.join(', ')}`);

  // Validate the OPTION sets too, not just the field names. Renaming
  // "Platform & Infra" in the project UI used to make every Category write for
  // 60% of the board a silent skip on a green build; renaming "Completed" would
  // quietly kill the open-issue-parked-in-Completed correction, which is the
  // single reason this script exists. Fail the run instead.
  const expected = {
    Status: Object.values(STATUSES),
    Category: Object.values(CATEGORIES),
    Priority: Object.values(PRIORITIES),
  };
  const missingOptions = Object.entries(expected).flatMap(([field, names]) => {
    const have = new Set((fields.get(field).options || []).map((o) => o.name));
    return names.filter((n) => !have.has(n)).map((n) => `${field}: "${n}"`);
  });
  if (missingOptions.length) {
    throw new Error(
      `Board is missing single-select options: ${missingOptions.join(', ')}. ` +
        'Restore the option name in the project UI, or update scripts/roadmap/classify.mjs to match.'
    );
  }

  const optionId = (fieldName, optionName) =>
    (fields.get(fieldName).options || []).find((x) => x.name === optionName)?.id ?? null;

  return { project, fields, optionId };
}

// The two field writers, bound to one board and one action log. Both are no-ops
// against the API under --dry-run but still record what they would have done, so
// a dry run's report is directly comparable with the live run that follows it.
function makeWriters({ project, fields, optionId, actions }) {
  const setSelect = async (item, fieldName, optionName, ref) => {
    const oid = optionId(fieldName, optionName);
    if (!oid) {
      actions.skipped.push(`${ref}: no "${optionName}" option on ${fieldName}`);
      return;
    }
    if (!DRY_RUN) {
      await gql(SET_SELECT, {
        projectId: project.id,
        itemId: item.id,
        fieldId: fields.get(fieldName).id,
        optionId: oid,
      });
    }
    actions.updated.push(`${ref}: ${fieldName} -> ${optionName}`);
  };

  const setDate = async (item, fieldName, isoDate, ref) => {
    if (!DRY_RUN) {
      await gql(SET_DATE, {
        projectId: project.id,
        itemId: item.id,
        fieldId: fields.get(fieldName).id,
        date: isoDate.slice(0, 10),
      });
    }
    actions.updated.push(`${ref}: ${fieldName} -> ${isoDate.slice(0, 10)}`);
  };

  return { setSelect, setDate };
}

// Put every open issue on the board.
//
// Under --dry-run no item is created on GitHub, but one is still tracked in
// memory with no field values, so the reconcile pass that follows reports the
// writes a live run would make. Skipping that bookkeeping would make a dry run
// silently omit field updates for exactly the issues it is about to add, which
// is the opposite of what a dry run is for.
async function addMissingIssues({
  project,
  openIssues,
  byContentId,
  archivedByContentId,
  live,
  actions,
}) {
  for (const issue of openIssues) {
    if (byContentId.has(issue.id)) continue;

    // Reopened after being archived. addProjectV2ItemById would hand back the
    // SAME archived item, so treating this as a fresh add left the work
    // permanently invisible on the board while overwriting the item's real field
    // values with defaults on every single run. Bring it back instead, keeping
    // whatever it already holds.
    const archived = archivedByContentId.get(issue.id);
    if (archived) {
      if (!DRY_RUN) {
        await gql(UNARCHIVE_ITEM, { projectId: project.id, itemId: archived.id });
      }
      archived.content = issue;
      byContentId.set(issue.id, archived);
      live.push(archived);
      actions.restored.push(`#${issue.number} ${issue.title}`);
      continue;
    }

    actions.added.push(`#${issue.number} ${issue.title}`);

    const id = DRY_RUN
      ? `dry-run:${issue.number}`
      : (await gql(ADD_ITEM, { projectId: project.id, contentId: issue.id })).addProjectV2ItemById
          .item.id;

    const item = { id, fieldValues: { nodes: [] }, content: issue };
    byContentId.set(issue.id, item);
    live.push(item);
  }
}

// Fill in what the board does not know about one open issue.
//
// Empty cells only, with one exception: an OPEN issue sitting in Completed is
// corrected. That specific lie is the reason this script exists, so it outranks
// the general rule that a human's edit is left alone.
async function reconcileIssue({ issue, item, setSelect, setDate, actions, today, linkedPrs }) {
  const ref = `#${issue.number}`;
  const labels = (issue.labels?.nodes || []).map((l) => l.name);

  if (!fieldValue(item, 'Category')) {
    const { category, reason } = classifyCategory({
      title: issue.title,
      body: issue.body,
      labels,
    });
    if (category) await setSelect(item, 'Category', category, ref);
    else actions.uncategorised.push(`${ref} ${issue.title.slice(0, 70)} (${reason})`);
  }

  // Held in a variable because the target date below depends on it, and a value a
  // human already set must drive that target rather than the derived one.
  let priority = fieldValue(item, 'Priority');
  if (!priority) {
    priority = classifyPriority({ labels, title: issue.title });
    if (priority) {
      await setSelect(item, 'Priority', priority, ref);
    } else {
      // Untriaged. Leave BOTH cells empty and say so: writing a guess here is
      // what published two `security` issues as Normal with a 91-day target,
      // because the fill-once rule then made that guess permanent.
      actions.untriaged.push(`${ref} ${issue.title.slice(0, 70)} (no priority-bearing label yet)`);
    }
  }

  // The roadmap view is a timeline. Without a start date an item does not plot at
  // all, which is why the board's ROADMAP_LAYOUT view had been rendering empty.
  if (!fieldValue(item, 'Start date')) {
    await setDate(item, 'Start date', issue.createdAt, ref);
  }

  // A start date alone plots a bar that ends the day it began, so the timeline
  // shows only where work came from. The target gives it somewhere to point.
  // Skipped entirely without a priority: the target is derived from it, and
  // baking in a defaulted 91 days is exactly the bug above.
  if (priority && !fieldValue(item, 'End date')) {
    await setDate(item, 'End date', targetDateFor(priority, today), ref);
  }

  // Status is re-derived every run and moves FORWARD only. Fill-once froze it at
  // the `opened` run, when the issue had no assignee and no PR, so nothing could
  // ever leave "Not Started". Monotonic means a genuine advance lands while a
  // human's hand-set "Under Testing" is never demoted.
  const current = fieldValue(item, 'Status');
  const derived = classifyStatus({
    state: issue.state,
    stateReason: issue.stateReason,
    assignees: issue.assignees?.nodes || [],
    linkedPrs: linkedPrs || [],
  });
  const advances = STATUS_RANK[derived] > (STATUS_RANK[current] ?? -1);
  // An OPEN issue parked in Completed is the one move backwards worth making.
  if (derived && (!current || current === STATUSES.COMPLETED || advances)) {
    if (derived !== current) await setSelect(item, 'Status', derived, ref);
  }
}

// Retire finished work so the board stays a roadmap and not an archive. Recent
// completions are stamped Completed with an end date and kept visible; older ones
// are archived. GitHub retains archived items, so this loses nothing.
async function retireCompleted({ project, live, cutoff, setSelect, setDate, actions }) {
  for (const item of live) {
    const c = item.content;
    if (!c?.closedAt) continue;

    // Closed as NOT PLANNED. Never stamp it Completed with a fabricated delivery
    // date on a public roadmap - archive it straight away, because abandoned
    // scope is not the same as recent shipping and does not belong in the
    // 30-day window at all.
    if (c.stateReason === 'NOT_PLANNED') {
      if (!DRY_RUN) await gql(ARCHIVE_ITEM, { projectId: project.id, itemId: item.id });
      actions.archived.push(`#${c.number} (not planned, closed ${c.closedAt.slice(0, 10)})`);
      continue;
    }

    if (Date.parse(c.closedAt) > cutoff) {
      if (fieldValue(item, 'Status') !== STATUSES.COMPLETED) {
        await setSelect(item, 'Status', STATUSES.COMPLETED, `#${c.number}`);
      }
      // Overwrite, not fill. Any End date on a closed item is the estimate it
      // carried while open, and an estimate never outranks the date it actually
      // landed - the same reason Status is forced to Completed here.
      if (fieldValue(item, 'End date') !== c.closedAt.slice(0, 10)) {
        await setDate(item, 'End date', c.closedAt, `#${c.number}`);
      }
      continue;
    }

    if (!DRY_RUN) await gql(ARCHIVE_ITEM, { projectId: project.id, itemId: item.id });
    actions.archived.push(`#${c.number} (closed ${c.closedAt.slice(0, 10)})`);
  }
}

function report({ summary, actions }) {
  if (AS_JSON) {
    stdout.write(`${JSON.stringify({ summary, actions }, null, 2)}\n`);
    return;
  }
  log(`\nRoadmap sync ${DRY_RUN ? '(dry run)' : ''} -> ${summary.project}`);
  log(
    `  board items ${summary.boardItemsBefore} (${summary.liveItemsBefore} live)  open issues ${summary.openIssues}`
  );
  log(
    `  added ${summary.added}  archived ${summary.archived}  field updates ${summary.fieldUpdates}`
  );
  for (const a of actions.added.slice(0, 100)) log(`    + ${a}`);
  for (const r of actions.restored) log(`    ^ restored (reopened) ${r}`);
  if (actions.archived.length) {
    log(`  archived (closed over ${ARCHIVE_AFTER_DAYS}d ago): ${actions.archived.length}`);
  }
  if (actions.uncategorised.length) {
    log(`\n  NEEDS A HUMAN - no category could be derived:`);
    for (const u of actions.uncategorised) log(`    ? ${u}`);
  }
  if (actions.untriaged.length) {
    log(`\n  NEEDS A HUMAN - no priority-bearing label yet:`);
    for (const u of actions.untriaged) log(`    ? ${u}`);
  }
  if (actions.skipped.length) {
    log(`\n  SKIPPED:`);
    for (const s of actions.skipped) log(`    ! ${s}`);
  }
  log('');
}

async function main() {
  const { project, fields, optionId } = await loadBoard();

  const [items, openIssues, openPrs] = await Promise.all([
    paginate(
      ITEMS_QUERY,
      { owner: OWNER, number: PROJECT_NUMBER },
      (d) => d.organization.projectV2.items
    ),
    paginate(OPEN_ISSUES_QUERY, { owner: OWNER, repo: REPO }, (d) => d.repository.issues),
    paginate(OPEN_PRS_QUERY, { owner: OWNER, repo: REPO }, (d) => d.repository.pullRequests),
  ]);

  const linkedPrMap = buildLinkedPrMap(openPrs);

  const live = items.filter((i) => !i.isArchived);
  // Archived items are now fetched too, so a reopened issue can be restored
  // rather than endlessly re-added as a phantom.
  const archivedByContentId = new Map(
    items.filter((i) => i.isArchived && i.content?.id).map((i) => [i.content.id, i])
  );
  // Snapshot before anything mutates `live`. Deriving this afterwards by
  // subtracting the added count is wrong under --dry-run, where the additions are
  // counted but never pushed.
  const liveItemsBefore = live.length;
  const byContentId = new Map(live.filter((i) => i.content?.id).map((i) => [i.content.id, i]));

  const actions = {
    added: [],
    restored: [],
    archived: [],
    updated: [],
    uncategorised: [],
    untriaged: [],
    skipped: [],
  };
  const { setSelect, setDate } = makeWriters({ project, fields, optionId, actions });
  // One clock reading for the whole run, so every target set today agrees.
  const today = new Date().toISOString().slice(0, 10);

  await addMissingIssues({ project, openIssues, byContentId, archivedByContentId, live, actions });

  for (const issue of openIssues) {
    await reconcileIssue({
      issue,
      item: byContentId.get(issue.id),
      setSelect,
      setDate,
      actions,
      today,
      linkedPrs: linkedPrMap.get(issue.number) || [],
    });
  }

  await retireCompleted({
    project,
    live,
    cutoff: Date.now() - ARCHIVE_AFTER_DAYS * 86400000,
    setSelect,
    setDate,
    actions,
  });

  report({
    summary: {
      project: project.url,
      dryRun: DRY_RUN,
      boardItemsBefore: items.length,
      liveItemsBefore,
      openIssues: openIssues.length,
      openPrs: openPrs.length,
      added: actions.added.length,
      restored: actions.restored.length,
      archived: actions.archived.length,
      fieldUpdates: actions.updated.length,
      uncategorised: actions.uncategorised.length,
      untriaged: actions.untriaged.length,
      skipped: actions.skipped.length,
    },
    actions,
  });
}

// Only run when invoked directly, so the unit test can import buildLinkedPrMap.
// Compared as resolved filesystem paths: import.meta.url percent-encodes
// characters such as spaces while argv[1] does not, so a raw string comparison
// silently skips main() in any clone path containing a space.
const invokedDirectly = () => {
  if (!argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(argv[1]);
  } catch {
    return false;
  }
};

if (invokedDirectly()) {
  if (!token) {
    stderr.write('roadmap-sync: no ROADMAP_TOKEN or GITHUB_TOKEN in the environment\n');
    exit(2);
  }
  main().catch((err) => {
    stderr.write(`roadmap-sync failed: ${err.message}\n`);
    exit(1);
  });
}
