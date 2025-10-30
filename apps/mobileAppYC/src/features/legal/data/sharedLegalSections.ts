import type {LegalSection, OrderedListBlock, ParagraphBlock, TextSegment} from './legalContentTypes';
import {p, seg, b, u, ol, oli} from './legalContentHelpers';

// Common company information
export const COMPANY_NAME = 'DuneXploration UG (haftungsbeschränkt)';
export const COMPANY_ADDRESS = 'Am Finther Weg 7\n55127 Mainz';
export const COMPANY_FULL_ADDRESS = 'Am Finther Weg 7, 55127 Mainz, Germany';
export const SECURITY_EMAIL = 'security@yosemitecrew.com';

// Common controller section
export const createControllerSection = (): LegalSection => ({
  id: 'controller-dpo',
  title: '1. Controller and Data Protection Officer',
  blocks: [
    p(
      b('The Controller is:\n'),
      seg(`${COMPANY_NAME}\n${COMPANY_ADDRESS}\n`),
      u(SECURITY_EMAIL)
    ),
    p(b('\nOur data protection officer can be contacted at:\n'), seg('Email: '), u(SECURITY_EMAIL)),
  ],
});

// Common recipients list for privacy
export const createRecipientsList = (): OrderedListBlock => ol(
  oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.'),
  oli('•', ' Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.'),
  oli('•', ' Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.')
);

// Common legal basis for legitimate interest
export const createLegitimateInterestBasis = (): ParagraphBlock =>
  p(b('Legal basis: '), seg('The legitimate interest in ensuring the technical functionality and security of our software (Art. 6 para. 1 lit. f) GDPR).'));

// Common storage period for logs
export const createLogStoragePeriod = (): ParagraphBlock =>
  p(b('Storage period: '), seg('Log data is deleted after 7 days.'));

// Common recipients for mobile
export const createMobileRecipientsList = (): OrderedListBlock => ol(
  oli('•', ' Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.'),
  oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.'),
  oli('•', ' Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.')
);

// Common legal basis for contract
export const createContractBasis = (): ParagraphBlock =>
  p(
    b('Legal basis: '),
    seg('The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).')
  );

// Common storage period for active account
export const createActiveAccountStorage = (): ParagraphBlock =>
  p(b('Storage period: '), seg('We store the data as long as the user account is active. Data may be deleted upon account deletion unless legal retention applies.'));

// Common contact section
export const createContactSection = (title: string, id: string): LegalSection => ({
  id,
  title,
  blocks: [
    p(
      seg(
        'We take all reasonable precautions to protect and secure your data. We welcome your questions and comments regarding data protection. If you have any questions regarding the collection, processing, or use of your personal data, or if you wish to request information, correction, blocking, or deletion of data, or revoke your consent, please contact '
      ),
      u('security@yosemitecrew.com'),
      seg('.')
    )
  ],
});

// Common data subject rights section
export const createDataSubjectRightsSection = (): LegalSection => ({
  id: 'data-subject-rights',
  title: '8. What rights do you have with regard to the personal data you provide to us?',
  blocks: [
    p(seg('You have the following rights, provided that the legal requirements are met. To exercise these rights, you can contact using the following address: '), u('security@yosemitecrew.com'), seg('.')),
    p(b('Art. 15 GDPR – Right of access by the data subject:\n'), seg('You have the right to obtain confirmation from us as to whether personal data concerning you are being processed and, if so, which data are being processed and the circumstances surrounding the processing.')),
    p(b('Art. 16 GDPR – Right to rectification:\n'), seg('You have the right to request that we immediately correct any inaccurate personal data concerning you. Taking into account the purposes of the processing, you also have the right to request the completion of incomplete personal data, including by means of a supplementary statement.')),
    p(b('Art. 17 GDPR – Right to erasure:\n'), seg('You have the right to request that we erase personal data concerning you without undue delay.')),
    p(b('Art. 18 GDPR – Right to restriction of processing:\n'), seg('You have the right to request that we restrict processing.')),
    p(
      b('Art. 20 GDPR – Right to data portability:\n'),
      seg(
        'In the event of processing based on consent or for the performance of a contract, you have the right to receive the personal data concerning you that you have provided to us in a structured, commonly used and machine-readable format and to transmit this data to another controller without hindrance from us or to have the data transmitted directly to the other controller, where technically feasible.'
      )
    ),
    p(
      b('Art. 77 GDPR in conjunction with § 19 BDSG – Right to lodge a complaint with a supervisory authority:\n'),
      seg('You have the right to lodge a complaint with a supervisory authority, in particular in the Member State of your habitual residence, place of work or place of the alleged infringement, if you consider that the processing of personal data relating to you infringes applicable law.')
    ),
  ],
});

// Common objection section
export const createObjectionSection = (): LegalSection => ({
  id: 'objection-consent',
  title: '9. In particular, right to object and withdrawal of consent',
  blocks: [
    p(
      seg(
        'You have the right to object at any time, on grounds relating to your particular situation, to the processing of personal data concerning you which is necessary for the performance of a task carried out in the public interest or in the exercise of official authority, or which is based on a legitimate interest on our part.'
      )
    ),
    p(
      seg(
        'If you object, we will no longer process your personal data unless we can demonstrate compelling legitimate grounds for the processing that override your interests, rights, and freedoms, or the processing is necessary for the establishment, exercise, or defense of legal claims.'
      )
    ),
    p(
      seg(
        'If we process your personal data for direct marketing purposes, you have the right to object to the processing at any time. If you object to processing for direct marketing purposes, we will no longer process your personal data for these purposes.'
      )
    ),
    p(seg('You can object at any time with future effect via one of the contact addresses known to you.')),
    p(b('Withdrawal of consent: '), seg('You can revoke your consent at any time with future effect via one of the contact addresses known to you.')),
  ],
});

// Common obligation to provide data
export const createObligationProvideData = (): LegalSection => ({
  id: 'obligation-provide',
  title: '10. Obligation to provide data',
  blocks: [p(seg('You are not contractually or legally obliged to provide us with personal data. However, without the data you provide, we are unable to offer you our services.'))],
});

// Social media section factory
export const createSocialMediaSection = (
  id: string,
  title: string,
  websiteUrl: string,
  operatorInfo: string,
  privacyUrl: string
): LegalSection => ({
  id,
  title,
  blocks: [
    p(seg('Our website can be accessed at: '), u(websiteUrl)),
    p(seg(`The network is operated by: ${operatorInfo}`)),
    p(seg('Privacy policy of the network: '), u(privacyUrl)),
  ],
});

// Common company intro for Terms
export const createCompanyIntro = (...additionalSegments: TextSegment[]): ParagraphBlock =>
  p(seg(`${COMPANY_NAME}, ${COMPANY_FULL_ADDRESS} ("DuneXploration" or "we/us/our")`), ...additionalSegments);

// Legal basis factory functions
export const createConsentBasis = (customText?: string): ParagraphBlock =>
  p(
    b('Legal basis: '),
    seg(customText || 'Voluntary consent to publish review (Art. 6 para 1 lit. a GDPR).')
  );

export const createEstablishmentBasis = (customText?: string): ParagraphBlock =>
  p(
    b('Legal basis: '),
    seg(customText || 'Establishment of the user relationship, Art. 6 para. 1 lit. b) GDPR.')
  );

// Recipient list variations
export const createWebRecipientsList = (): OrderedListBlock =>
  ol(
    oli('•', ' Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.'),
    oli('•', ' Google Cloud EMEA Ltd., 70 Sir John Rogerson\'s Quay, Dublin 2, Ireland.'),
    oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.')
  );

export const createGoogleOnlyRecipient = (): OrderedListBlock =>
  ol(oli('•', ' Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.'));

export const createBookingRecipientsList = (additionalRecipient?: string): OrderedListBlock =>
  ol(
    oli('•', ' Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.'),
    oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.'),
    ...(additionalRecipient ? [oli('•', ` ${additionalRecipient}`)] : [])
  );

export const createHealthRecipientsList = (): OrderedListBlock =>
  ol(
    oli('•', ' Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.'),
    oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.'),
    oli('•', ' Pet service provider selected by the user.')
  );

export const createReviewRecipientsList = (): OrderedListBlock =>
  ol(
    oli('•', ' Any user of the PMS — including the pet service provider selected by the user — can view the review.'),
    oli('•', ' Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.'),
    oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.')
  );

// Storage period variations
export const createActiveAccountStorageWithRetention = (): ParagraphBlock =>
  p(
    b('Storage period: '),
    seg(
      'The data will generally be processed for as long as you maintain your account with us. After termination of the account, your data will be deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.'
    )
  );

export const createConversationStorage = (): ParagraphBlock =>
  p(
    b('Storage period: '),
    seg('We store the data until the conversation or account is deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.')
  );

export const createInquiryStorage = (): ParagraphBlock =>
  p(b('Storage period: '), seg('The data will generally be processed for as long as it is necessary to process the inquiry.'));

export const createReviewStorage = (): ParagraphBlock =>
  p(
    b('Storage period: '),
    seg('We store the data until the review is manually removed by the user or deleted due to inactivity or policy violations.')
  );

export const createBookingStorage = (): ParagraphBlock =>
  p(
    b('Storage period: '),
    seg('The data collected as part of the booking will be deleted after the expiry of the applicable statutory retention obligations (6 years according to HGB, 10 years according to AO).')
  );

export const createHealthStorage = (): ParagraphBlock =>
  p(
    b('Storage period: '),
    seg('As long as the pet profile exists and data is not manually deleted. Full deletion occurs with account removal or upon user request.')
  );

export const createJointResponsibilityStorage = (): ParagraphBlock =>
  p(
    b('Storage period: '),
    seg('We do not store any personal data ourselves within the scope of joint responsibility. With regard to contact requests outside the network, the above information on establishing contact applies accordingly.')
  );
