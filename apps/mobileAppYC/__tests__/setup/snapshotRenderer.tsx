/**
 * Snapshot rendering helpers for react-test-renderer under React 19.
 *
 * Kept out of testUtils.tsx so that file stays untouched: it is not currently
 * prettier-formatted, so any edit there reformats ~300 unrelated lines.
 */

import {ReactElement} from 'react';
import renderer from 'react-test-renderer';

let mountedTrees: renderer.ReactTestRenderer[] = [];

/**
 * Render a tree for snapshotting.
 *
 * `renderer.create()` schedules the initial render asynchronously, so calling
 * `toJSON()` immediately after it returns `null`. Suites that did so committed
 * `null` snapshots and were therefore asserting that nothing rendered - no UI
 * change could ever fail them. Creating inside `act` drains the initial render
 * before the tree is serialised.
 *
 * The tree is retained so `cleanupSnapshotTrees` can unmount it even when the
 * snapshot assertion throws. That matters: React 19 keeps scheduler work queued
 * for a tree that is never unmounted, and from Jest 30 that work firing after
 * the environment is torn down fails whichever suite the worker picks up next.
 */
export const renderSnapshot = (ui: ReactElement) => {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(ui);
  });
  mountedTrees.push(tree);
  return tree.toJSON();
};

/** Unmount every tree `renderSnapshot` created. Call from `afterEach`. */
export const cleanupSnapshotTrees = () => {
  const trees = mountedTrees;
  mountedTrees = [];
  for (const tree of trees) {
    renderer.act(() => {
      tree.unmount();
    });
  }
};
