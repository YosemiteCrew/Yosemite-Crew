/**
 * Widen a hand-written filesystem double to the seam it stands in for.
 *
 * The production modules type their injectable fs seams as `typeof fs.readFileSync`
 * and friends — the complete Node overload sets, which no hand-written double can
 * implement (`readFileSync` alone has five overloads whose return type depends on
 * the options argument). A double that only serves the one call shape the module
 * under test uses is therefore never assignable to the dependency interface.
 *
 * `fsSeam` keeps the double's own body fully type-checked — the callback passed in
 * is inferred and checked as written — and widens only the resulting mock, which is
 * the same convention `tests/helpers/memory-fs.ts` already follows by declaring its
 * mocks as bare `jest.Mock`. Production use of these seams is still checked against
 * the real `fs` types by the `src` arm of `type-check`.
 */
export const fsSeam = <A extends unknown[], R>(impl: (...args: A) => R): jest.Mock => jest.fn(impl);
