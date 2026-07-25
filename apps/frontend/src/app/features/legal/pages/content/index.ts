import type { LegalSection } from '../legalContentTypes';
import { TERMS_BODY_SECTIONS } from './termsBody';
import { TERMS_EXHIBIT_A_SECTIONS } from './termsExhibitA';
import { TERMS_EXHIBIT_B_SECTIONS } from './termsExhibitB';
import { TERMS_APPENDIX_1_SECTIONS } from './termsAppendix1';
import { TERMS_APPENDIX_2_SECTIONS } from './termsAppendix2';

export { PRIVACY_INTRO, PRIVACY_SECTIONS } from './privacyPolicy';

/** The agreement in document order: body sections, then exhibits and appendices. */
export const TERMS_SECTIONS: LegalSection[] = [
  ...TERMS_BODY_SECTIONS,
  ...TERMS_EXHIBIT_A_SECTIONS,
  ...TERMS_EXHIBIT_B_SECTIONS,
  ...TERMS_APPENDIX_1_SECTIONS,
  ...TERMS_APPENDIX_2_SECTIONS,
];
