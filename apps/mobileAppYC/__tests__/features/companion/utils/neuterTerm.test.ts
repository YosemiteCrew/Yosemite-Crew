import {neuterTerm} from '@/features/companion/utils/neuterTerm';

/**
 * The word was spelled out at four call sites and drifted: the Next handler
 * set "Neutered status is required" under a field labelled "Spayed status"
 * for a female companion. One helper now feeds the label, both validation
 * messages and the option list.
 */
describe('neuterTerm', () => {
  it('says Spayed for a female companion', () => {
    expect(neuterTerm('female')).toBe('Spayed');
  });

  it('says Neutered for a male companion', () => {
    expect(neuterTerm('male')).toBe('Neutered');
  });

  it('falls back to Neutered when the gender is not set yet', () => {
    expect(neuterTerm(undefined)).toBe('Neutered');
    expect(neuterTerm(null)).toBe('Neutered');
    expect(neuterTerm('')).toBe('Neutered');
  });

  it('builds a label and an error message that agree with each other', () => {
    for (const gender of ['female', 'male']) {
      const label = `${neuterTerm(gender)} status`;
      const error = `${neuterTerm(gender)} status is required`;
      expect(error.startsWith(label)).toBe(true);
    }
  });
});
