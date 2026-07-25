import path from 'node:path';

// Resolve `candidate` against `root` and assert the result stays inside `root`.
//
// These scripts build filesystem paths from data they did not author: SF: entries
// in a coverage report, directory listings, paths passed on the command line. A
// containment assertion keeps that data from addressing anything outside the
// tree it is supposed to describe - a coverage report naming ../../etc/passwd is
// mis-rooted by definition, and treating it as a resolvable source file would
// quietly inflate the resolution rate the caller is checking.
//
// Returns null instead of throwing so callers can decide whether an escaping
// path is a hard error or simply does not count.
export function resolveWithin(root, candidate) {
  const base = path.resolve(root);
  const resolved = path.resolve(base, candidate);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}
