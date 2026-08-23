/**
 * The word for a companion's neuter status, by gender.
 *
 * It used to be spelled out at four call sites in AddCompanionScreen and
 * drifted: the Next handler set "Neutered status is required" under a field
 * labelled "Spayed status" for a female companion. One helper now feeds the
 * option labels, the field label and both validation messages.
 *
 * It lives in its own module rather than being exported from the screen, so
 * that screen keeps only component exports and Fast Refresh can still preserve
 * its state.
 */
export const neuterTerm = (gender?: string | null): string =>
  gender === 'female' ? 'Spayed' : 'Neutered';
