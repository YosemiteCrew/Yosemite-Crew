'use strict';

// Minimal reconciliation plan for the tab strip.
//
// The strip polls the main process once a second and used to answer by
// clearing `innerHTML` and rebuilding every tab. Whatever had keyboard focus
// inside it was therefore destroyed within a second and focus fell to the body,
// which is why the strip could not be operated with a keyboard at all even once
// the tabs were focusable. Rebuilding also re-inserted a fresh favicon <img>
// each time, so a favicon that fails to load pushed the label sideways on every
// poll.
//
// This computes which elements to remove and which to insert where, given the
// ids currently in the DOM and the ids the new state wants, so unchanged tabs
// keep their element identity — and with it their focus, their selection and
// their in-flight favicon. It is deliberately DOM-free: the page applies the
// plan with removeChild/insertBefore, and this can be unit-tested in node.
//
// Plain browser script for the same reason as tabbar-a11y.js: the tab bar is a
// local page loaded over file:// under a strict CSP.
(function (root) {
  // Returns { remove, insert }:
  //   remove  ids whose elements are no longer wanted, in DOM order
  //   insert  ordered steps of { id, before, isNew }; `before` is the id to
  //           insert ahead of, or null to append. Applying them in order, after
  //           the removals, leaves the DOM in exactly `nextIds` order while
  //           touching only the nodes that actually moved.
  const plan = function (currentIds, nextIds) {
    const current = Array.isArray(currentIds) ? currentIds : [];
    const next = Array.isArray(nextIds) ? nextIds : [];
    const wanted = new Set(next);

    const remove = current.filter(function (id) {
      return !wanted.has(id);
    });

    // `working` mirrors what the DOM will look like as the steps are applied,
    // so each step's `before` is resolved against the state that step sees.
    const working = current.filter(function (id) {
      return wanted.has(id);
    });
    const insert = [];

    for (let i = 0; i < next.length; i++) {
      const id = next[i];
      if (working[i] === id) continue;

      const at = working.indexOf(id);
      const isNew = at === -1;
      if (!isNew) working.splice(at, 1);

      const before = i < working.length ? working[i] : null;
      working.splice(i, 0, id);
      insert.push({ id: id, before: before, isNew: isNew });
    }

    return { remove: remove, insert: insert };
  };

  const api = { plan: plan };
  root.ycTabStripDiff = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
