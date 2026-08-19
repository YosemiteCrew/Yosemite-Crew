import { fromFHIRQuestionnaireResponse } from '@yosemite-crew/types';

/**
 * linkId comes from an externally submitted FHIR QuestionnaireResponse, so it
 * reaches the answers object as a caller-chosen property name.
 */
describe('fromFHIRQuestionnaireResponse prototype pollution', () => {
  afterEach(() => {
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  /**
   * The answer is a valueAttachment on purpose. answerToValue returns a plain
   * STRING for valueString, and assigning a string to `__proto__` is a silent
   * no-op in JS, so a string payload cannot demonstrate the bug. valueAttachment
   * returns an object, which is what actually invokes the prototype setter.
   */
  const responseWith = (linkId: string) =>
    JSON.parse(
      JSON.stringify({
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        item: [
          {
            linkId,
            answer: [{ valueAttachment: { url: 'x', title: 'polluted' } }],
          },
          { linkId: 'real', answer: [{ valueString: 'kept' }] },
        ],
      })
    );

  it('ignores a __proto__ linkId instead of rewriting the prototype', () => {
    const submission = fromFHIRQuestionnaireResponse(responseWith('__proto__'));

    // The load-bearing assertion: without the guard the assignment invokes the
    // prototype setter, so a key-count check alone would still look correct.
    expect(Object.getPrototypeOf(submission.answers)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(submission.answers.real).toBe('kept');
  });

  it.each(['constructor', 'prototype'])('ignores a %s linkId', (linkId) => {
    const submission = fromFHIRQuestionnaireResponse(responseWith(linkId));

    expect(Object.keys(submission.answers)).toEqual(['real']);
  });
});
