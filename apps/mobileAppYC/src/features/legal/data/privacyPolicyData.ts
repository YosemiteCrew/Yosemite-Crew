import type {LegalSection} from './legalContentTypes';

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    id: 'overview',
    title: '1. Privacy Overview',
    blocks: [
      {
        type: 'paragraph',
        segments: [
          {text: 'Purpose', bold: true},
          {
            text: ' This sample introduction shows how to highlight just the first word of a paragraph. Replace the copy with your actual policy summary.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'This sentence demonstrates ',
          },
          {
            text: 'underlined guidance text',
            underline: true,
          },
          {
            text: ' that you can freely edit in the data file.',
          },
        ],
      },
    ],
  },
  {
    id: 'data-collection',
    title: '2. Data Collection & Use',
    blocks: [
      {
        type: 'ordered-list',
        items: [
          {
            marker: '2.1',
            markerBold: true,
            segments: [
              {
                text: ' We collect account information such as your name, email address, pet details, and preferences to personalise your experience.',
              },
            ],
          },
          {
            marker: '2.2',
            markerBold: true,
            segments: [
              {
                text: ' Diagnostic and analytics data helps us improve app stability. You may opt out via device settings.',
              },
            ],
          },
          {
            marker: '2.3',
            markerBold: true,
            segments: [
              {
                text: ' We only retain personal information for as long as necessary to deliver services or comply with our legal obligations.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'rights',
    title: '3. Your Rights',
    blocks: [
      {
        type: 'paragraph',
        segments: [
          {
            text: 'Access',
            bold: true,
          },
          {
            text: ' You may request a copy of the personal data we hold about you at any time.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'Rectification',
            bold: true,
          },
          {
            text: ' Let us know if any of your information is incorrect and we will update it promptly.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'Deletion',
            bold: true,
          },
          {
            text: ' You can exercise your right to erasure through the Data Subject Access Request form in the Contact Us module.',
          },
        ],
      },
    ],
  },
];

export type {LegalSection as PrivacySection} from './legalContentTypes';
