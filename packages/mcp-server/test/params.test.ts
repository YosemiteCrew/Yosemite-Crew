import { compactParams, cursorParam, limitParam, organisationIdParam } from '../src/params.js';

describe('compactParams', () => {
  it('drops undefined so an omitted filter never reaches the query string', () => {
    expect(compactParams({ a: 1, b: undefined, c: null, d: '' })).toEqual({ a: 1, c: null, d: '' });
  });

  it('returns an empty object when everything is absent', () => {
    expect(compactParams({ a: undefined })).toEqual({});
  });
});

describe('parameter schemas', () => {
  it('bounds limit to the page size the server enforces', () => {
    expect(limitParam.safeParse(101).success).toBe(false);
    expect(limitParam.safeParse(0).success).toBe(false);
    expect(limitParam.safeParse(50).success).toBe(true);
    expect(limitParam.safeParse(undefined).success).toBe(true);
  });

  it('rejects an empty cursor rather than sending one', () => {
    expect(cursorParam.safeParse('').success).toBe(false);
    expect(cursorParam.safeParse('abc').success).toBe(true);
  });

  it('requires an organisation id', () => {
    expect(organisationIdParam.safeParse('').success).toBe(false);
    expect(organisationIdParam.safeParse('org-a').success).toBe(true);
  });

  /*
   * The description is the only thing telling an agent that the id comes from
   * list_organizations. Without it the model guesses, and every guess is a 403.
   */
  it('tells the agent where an organisation id comes from', () => {
    expect(organisationIdParam.description).toContain('list_organizations');
  });
});
