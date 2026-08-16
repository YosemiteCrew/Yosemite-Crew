import type { LegalBlock, LegalSection } from '../legalContentTypes';

/** The policy opens with this paragraph, before the first numbered section. */
export const PRIVACY_INTRO: LegalBlock[] = [
  {
    type: 'p',
    content:
      'The protection and security of your personal information is important to us. This privacy policy describes how we collect, process, and store personal data through our open-source practice management software (hereinafter referred to as "PIMS", "PMS" or "the Software"). Our Software is available as a web application and as a mobile application. Unless stated otherwise, the information provided applies equally to both versions. This policy helps you to understand what information we collect, why we collect it, how we use it, and how long we store it.',
    k: 'b0',
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'trademark',
    title: 'Trademark notice',
    blocks: [
      {
        type: 'p',
        content:
          'This repository may reference or include integrations, plugins, names, logos, or trademarks of third-party companies (including but not limited to IDEXX, MSD Veterinary Manual, and other partners). Such trademarks and logos are the property of their respective owners and are used solely for identification or interoperability purposes. Nothing in this repository grants any right or license to use any third-party trademarks, logos, or branding except as permitted by the respective owners.',
        k: 'b0',
      },
    ],
  },
  {
    id: 'controller',
    title: '1. Controller and Data Protection Officer',
    blocks: [
      {
        type: 'p',
        content: [
          'The Controller is: ',
          { br: true, k: 'r0' },
          ' DuneXploration UG (haftungsbeschränkt) ',
          { br: true, k: 'r1' },
          ' Am Finther Weg 7 ',
          { br: true, k: 'r2' },
          ' 55127 Mainz ',
          { br: true, k: 'r3' },
          ' ',
          { text: 'security@yosemitecrew.com', href: 'mailto:security@yosemitecrew.com', k: 'r4' },
        ],
        k: 'b0',
      },
      {
        type: 'p',
        content: [
          'Our data protection officer can be contacted at: ',
          { br: true, k: 'r0' },
          ' Email: ',
          { text: 'security@yosemitecrew.com', href: 'mailto:security@yosemitecrew.com', k: 'r1' },
        ],
        k: 'b1',
      },
    ],
  },
  {
    id: 'roles',
    title: '2. Our role regarding your personal data',
    blocks: [
      {
        type: 'p',
        content:
          'Under the General Data Protection Regulation (GDPR), the controller determines the purposes and means of processing personal data. A processor processes personal data on behalf of the controller and only in accordance with their instructions.',
        k: 'b0',
      },
      {
        type: 'p',
        content:
          'Depending on the processing activity, DuneXploration may act as a controller or processor:',
        k: 'b1',
      },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'DuneXploration is the controller when it determines how and why your data is processed, for example when you create a user account',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content: [
                  'The ',
                  { text: 'pet service providers', bold: true, k: 'r0' },
                  ' (e.g. veterinary clinics, breeders, groomers, hospitals) act as controllers when they manage their interactions with you (e.g. appointments, invoices, prescriptions) and DuneXploration acts as their processor.',
                ],
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b2',
      },
      {
        type: 'p',
        content:
          'Regardless of whether DuneXploration is the controller or processor, DuneXploration takes appropriate measures to ensure the protection and confidentiality of the personal data that DuneXploration processes in accordance with the provisions of the GDPR and the legislation in Germany.',
        k: 'b3',
      },
    ],
  },
  {
    id: 'processing',
    title: '3. Processing activities in applications',
    blocks: [
      {
        type: 'p',
        content:
          'When you use our application, we process personal data. You are not legally required to provide this data, but without it, many features may not be available.',
        k: 'b0',
      },
      {
        type: 'p',
        content:
          'The following sections explain what data we process, for what purposes, for how long, and on what legal basis. You will also learn to whom we pass on your data. At the end of the privacy policy, you will also find information about our storage periods, general recipients, and algorithmic decision-making.',
        k: 'b1',
      },
      { type: 'h3', content: '3.1. Web Application', k: 'b2' },
      {
        type: 'p',
        content: 'Our web application is offered to business owners and web developers',
        k: 'b3',
      },
      { type: 'h4', content: '3.1.1. Server Provision and Hosting', k: 'b4' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' The web application can be self-hosted or hosted in the cloud. If you choose our cloud, we collect and temporarily store certain data to ensure the operation, availability, stability and security of the application.',
        ],
        k: 'b5',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  IP address, time and date of access, browser type and version, operating system.',
        ],
        k: 'b6',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  The legitimate interest in ensuring the technical functionality and security of our software (Art. 6 para. 1 lit. f) GDPR.',
        ],
        k: 'b7',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b8' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com).',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content:
                  'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b9',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  Log data is deleted after 7 days.',
        ],
        k: 'b10',
      },
      { type: 'h4', content: '3.1.2. Signing up and setting up a profile', k: 'b11' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' To register and onboard veterinary businesses, create accounts, and establish secure access for managing their practice‘s information and activities, thus allowing them to provide services through the platform.',
        ],
        k: 'b12',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  In particular, work email, business name, business type (veterinary business, breeding facility, pet sitter, groomer shop), registration number, address, specialised department, provided services, professional background (specialisation, qualification, medical license number), appointment duration (consultation mode, consultation fee, username)',
        ],
        k: 'b13',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b14' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content: 'Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i2',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com).',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b15',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  Establishment of the user relationship, Art. 6 para. 1 lit. b) GDPR. By providing voluntary profile information, you consent to the processing of this data, Art. 6 para. 1 lit. a) GDPR.',
        ],
        k: 'b16',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  The data will generally be processed for as long as you maintain your account with us. After termination of the account, your data will be deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.',
        ],
        k: 'b17',
      },
      { type: 'h4', content: '3.1.3. General Use of the Application', k: 'b18' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' To allow businesses to use the application and all its core functions (such as creating appointments, adding prescriptions, generating bills, creating appointments), we process the information you enter, and data generated during use.',
        ],
        k: 'b19',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  In particular, name, e-mail address, phone number, doctor’s name, prescription notes, billing details, payment information.',
        ],
        k: 'b20',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b21' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content: 'Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i2',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com).',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b22',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).',
        ],
        k: 'b23',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  We store the data as long as the user account is active. Data may be deleted upon account deletion unless legal retention applies.',
        ],
        k: 'b24',
      },
      { type: 'h4', content: '3.1.4. Contacting Clients and Communications', k: 'b25' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' The application allows communication with clients and within teams. This can include sending messages, images and videos related to the pet’s condition, treatment, or general care questions.',
        ],
        k: 'b26',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  Messages, attachments (photos, videos), pet-related context (e.g. symptoms, recent treatments), metadata (timestamps, sender/recipient).',
        ],
        k: 'b27',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b28' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content: 'Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i2',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com).',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b29',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).',
        ],
        k: 'b30',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  We store the data until the conversation or account is deleted unless the deletion of individual data or documents is prevented by statutory retention obligations',
        ],
        k: 'b31',
      },
      { type: 'h4', content: '3.1.5. Payment', k: 'b32' },
      {
        type: 'p',
        content:
          'Business owners and developers can implement their preferred payment options and payment services directly in the web application. The payment is directly performed over these payment providers. DuneXploration does not process any personal data in connection with the payment.',
        k: 'b33',
      },
      { type: 'h3', content: '3.2. Mobile Application', k: 'b34' },
      { type: 'h4', content: '3.2.1. Server Provision and Hosting', k: 'b35' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' The application is hosted on servers to be made technically available for users. For this purpose, we collect and temporarily store certain data to ensure the operation, availability, stability and security of the software.',
        ],
        k: 'b36',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  IP address, time and date of access, browser type and version, operating system.',
        ],
        k: 'b37',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b38' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b39',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  The legitimate interest in ensuring the technical functionality and security of our software (Art. 6 para. 1 lit. f) GDPR).',
        ],
        k: 'b40',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  Log data is deleted after 7 days.',
        ],
        k: 'b41',
      },
      { type: 'h4', content: '3.2.2. Signing up and setting up a profile', k: 'b42' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' To onboard new users (pet owners, breeders, groomers, and vet doctors) to the mobile application, enabling account creation, authentication, and access to platform features.',
        ],
        k: 'b43',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  In particular, name, e-mail address, phone number, address, type of user.',
        ],
        k: 'b44',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b45' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com).',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland,',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i2',
            blocks: [
              {
                type: 'text',
                content:
                  'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg, and',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i3',
            blocks: [
              {
                type: 'text',
                content:
                  'Your identity provider, if you use the log-in of a third party service (we support Meta, Google or Apple).',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b46',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  Establishment of the user relationship, Art. 6 para. 1 lit. b) GDPR.',
        ],
        k: 'b47',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  The data will generally be processed for as long as you maintain your account with us. After termination of the account, your data will be deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.',
        ],
        k: 'b48',
      },
      { type: 'h4', content: '3.2.3. General Use of the Application', k: 'b49' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' To allow users to use the application and all its core functions (such as creating pet profiles, managing daily care tasks, recording notes of health data, adding vaccination record, creating exercise plans etc), we process the information you enter and data generated during use.',
        ],
        k: 'b50',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  In particular, name, e-mail address, phone number, type and content of enquiry, message.',
        ],
        k: 'b51',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b52' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com),',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland,',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i2',
            blocks: [
              {
                type: 'text',
                content:
                  'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg, and',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b53',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).',
        ],
        k: 'b54',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  We store the data as long as the user account is active. Data may be deleted upon account deletion unless legal retention applies.',
        ],
        k: 'b55',
      },
      { type: 'h4', content: '3.2.4. Booking Appointments', k: 'b56' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' To enable pet owners to book appointments with veterinarians through the Yosemite Crew mobile application.',
        ],
        k: 'b57',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  Name, e-mail address, telephone number, booking details and, if applicable, desired appointment reminders or additional comments on your booking. The data marked as mandatory fields must be provided in order to make a booking.',
        ],
        k: 'b58',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b59' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com),',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland,',
                k: 'b0',
              },
            ],
          },
          { k: 'i2', blocks: [{ type: 'text', content: 'Selected veterinarians.', k: 'b0' }] },
        ],
        k: 'b60',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).',
        ],
        k: 'b61',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  The data collected as part of the booking will be deleted after the expiry of the applicable statutory retention obligations (6 years according to HGB, 10 years according to AO).',
        ],
        k: 'b62',
      },
      { type: 'h4', content: '3.2.5. Contacting Veterinarians and Communications', k: 'b63' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' To enable meaningful communication between pet owners and veterinary professionals the user can contact veterinarians directly through the application. This can include sending messages, images and videos related to the pet’s condition, treatment, or general care questions. If you contact the veterinarian, your data will be processed to the extent necessary for the veterinarian to answer your inquiry and for any follow-up measures.',
        ],
        k: 'b64',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  Messages, attachments (photos, videos), pet-related context (e.g. symptoms, recent treatments), metadata (timestamps, sender/recipient).',
        ],
        k: 'b65',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b66' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com),',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland,',
                k: 'b0',
              },
            ],
          },
          { k: 'i2', blocks: [{ type: 'text', content: 'Selected veterinarians.', k: 'b0' }] },
        ],
        k: 'b67',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).',
        ],
        k: 'b68',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  We store the data until the conversation or account is deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.',
        ],
        k: 'b69',
      },
      { type: 'h4', content: '3.2.6. Review and Ratings', k: 'b70' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' Users can provide feedback on services received from pet service providers to help other users to make their decision and enhance user friendliness.',
        ],
        k: 'b71',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          '  Rating (in the form of stars), review text, name, timestamp.',
        ],
        k: 'b72',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b73' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Any user of the PIMS - including the pet service provider selected by the user - can view the review.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content:
                  'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i2',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com).',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b74',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  Voluntary consent to publish review (Art. 6 para 1 lit. a GDPR).',
        ],
        k: 'b75',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  We store the data until the review is manually removed by the user or deleted due to inactivity or policy violations.',
        ],
        k: 'b76',
      },
      { type: 'h4', content: '3.2.7. Payment', k: 'b77' },
      {
        type: 'p',
        content:
          'Users can pay assessment fees directly or receive invoices for treatments via the app. When payment is made through the app, the transaction is directly performed by the pet service providers own payment services. We will not process any payment data in connection with the payment process.',
        k: 'b78',
      },
      { type: 'h4', content: '3.2.8. Pet Medical Records and Health Features', k: 'b79' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          " To enable users to record, track and share their pet's medical and health information, such as medical conditions, medications, vaccination status and observations (e.g. water intake or pain levels), users can add information to their profile. This allows for better monitoring and communication with veterinary care providers.",
        ],
        k: 'b80',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          "  Pet's medical records (vaccinations, prescriptions, diagnoses), daily health logs, notes on behaviour or pain, exercise schedules, reminders, task lists.",
        ],
        k: 'b81',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b82' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com).',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i2',
            blocks: [
              { type: 'text', content: 'Pet service provider selected by the user.', k: 'b0' },
            ],
          },
        ],
        k: 'b83',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  The legitimate interest in pursuing the aforementioned purposes (Art. 6 para. 1 lit. f. GDPR).',
        ],
        k: 'b84',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  As long as the pet profile exists and data is not manually deleted. Full deletion occurs with account removal or upon user request.',
        ],
        k: 'b85',
      },
      { type: 'h4', content: '3.2.9. Contacting Us', k: 'b86' },
      {
        type: 'p',
        content: [
          { text: 'Purpose:', bold: true, k: 'r0' },
          ' Users can contact us through the application by sending us a message. Users can submit a general enquiry, feature request or a data subject access request. When you contact us at, your data will be processed to the extent necessary to answer your enquiry and for any follow-up measures.',
        ],
        k: 'b87',
      },
      {
        type: 'p',
        content: [
          { text: 'Categories of data:', bold: true, k: 'r0' },
          ' Inventory data (e.g., names, addresses), contact details, content data, metadata (timestamps, sender/recipient).',
        ],
        k: 'b88',
      },
      { type: 'p', content: [{ text: 'Recipient:', bold: true, k: 'r0' }], k: 'b89' },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content:
                  'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i2',
            blocks: [
              {
                type: 'text',
                content:
                  'Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy contact: privacy@supabase.com).',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b90',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  Contract fulfillment and pre-contractual inquiries (Art. 6 para. 1 lit. b. GDPR); legitimate interests (Art. 6 para. 1 lit. f. GDPR) in the processing of communication.',
        ],
        k: 'b91',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  The data will generally be processed for as long as it is necessary to process the inquiry.',
        ],
        k: 'b92',
      },
    ],
  },
  {
    id: 'social-media',
    title: '4. Presence on social media',
    blocks: [
      {
        type: 'p',
        content:
          'We have profiles on social networks. Our social media accounts complement our PIMS and offer you the opportunity to interact with us. As soon as you access our social media profiles on social networks, the terms and conditions and data processing guidelines of the respective operators apply. The data collected about you when you use the services is processed by the networks and may also be transferred to countries outside the European Union where there is no adequate level of protection for the processing of personal data. We have no influence on data processing in social networks, as we are users of the network just like you. Information on this and on what data is processed by the social networks and for what purposes the data is used can be found in the privacy policy of the respective network listed below. We use the following social networks:',
        k: 'b0',
      },
      { type: 'h3', content: '4.1. LinkedIn', k: 'b1' },
      {
        type: 'p',
        content: [
          'Our website can be accessed at:  ',
          {
            text: 'https://de.linkedin.com/company/yosemitecrew',
            href: 'https://de.linkedin.com/company/yosemitecrew',
            k: 'r0',
          },
        ],
        k: 'b2',
      },
      {
        type: 'p',
        content:
          'The network is operated by: LinkedIn Ireland Unlimited Company, Wilton Place, Dublin 2, Ireland.',
        k: 'b3',
      },
      {
        type: 'p',
        content: [
          'Privacy policy of the network:  ',
          {
            text: 'www.linkedin.com/legal/privacy-policy',
            href: 'https://www.linkedin.com/legal/privacy-policy',
            k: 'r0',
          },
        ],
        k: 'b4',
      },
      { type: 'h3', content: '4.2. TikTok', k: 'b5' },
      {
        type: 'p',
        content: [
          'Our website can be accessed at:  ',
          {
            text: 'https://www.tiktok.com/@yosemitecrew',
            href: 'https://www.tiktok.com/@yosemitecrew',
            k: 'r0',
          },
        ],
        k: 'b6',
      },
      {
        type: 'p',
        content:
          'The network is operated by: TikTok Technology Limited, 10 Earlsfort Terrace, Dublin, D02 T380, Ireland.',
        k: 'b7',
      },
      {
        type: 'p',
        content: [
          'Privacy policy of the network:  ',
          {
            text: 'https://www.tiktok.com/legal/page/eea/privacy-policy/de',
            href: 'https://www.tiktok.com/legal/page/eea/privacy-policy/de',
            k: 'r0',
          },
        ],
        k: 'b8',
      },
      { type: 'h3', content: '4.3. Instagram', k: 'b9' },
      {
        type: 'p',
        content: [
          'Our website can be accessed at:  ',
          {
            text: 'https://www.instagram.com/yosemite_crew',
            href: 'https://www.instagram.com/yosemite_crew',
            k: 'r0',
          },
        ],
        k: 'b10',
      },
      {
        type: 'p',
        content:
          'The network is operated by: Meta Platforms Ireland Limited, 4 Grand Canal Square, Dublin 2, Ireland.',
        k: 'b11',
      },
      {
        type: 'p',
        content: [
          'Privacy policy of the network:  ',
          {
            text: 'https://privacycenter.instagram.com/',
            href: 'https://privacycenter.instagram.com/',
            k: 'r0',
          },
        ],
        k: 'b12',
      },
      { type: 'h3', content: '4.4. X.com', k: 'b13' },
      {
        type: 'p',
        content: [
          'Our website can be accessed at:  ',
          { text: 'https://x.com/yosemitecrew', href: 'https://x.com/yosemitecrew', k: 'r0' },
        ],
        k: 'b14',
      },
      {
        type: 'p',
        content:
          'The network is operated by: X Internet Unlimited Company, One Cumberland Place, Fenian Street, Dublin 2, D02 AX07 Ireland.',
        k: 'b15',
      },
      {
        type: 'p',
        content: [
          'Privacy policy of the network:  ',
          { text: 'https://x.com/de/privacy', href: 'https://x.com/de/privacy', k: 'r0' },
        ],
        k: 'b16',
      },
      { type: 'h3', content: '4.5. Discord', k: 'b17' },
      {
        type: 'p',
        content: [
          'Our website can be accessed at:  ',
          { text: 'https://discord.gg/SwM6mX85KD', href: 'https://discord.gg/SwM6mX85KD', k: 'r0' },
        ],
        k: 'b18',
      },
      {
        type: 'p',
        content:
          'The network is operated by: Discord Netherlands BV, Schiphol Boulevard 195, 1118 BG Schiphol, Netherlands.',
        k: 'b19',
      },
      {
        type: 'p',
        content: [
          'Privacy policy of the network:  ',
          { text: 'https://discord.com/privacy', href: 'https://discord.com/privacy', k: 'r0' },
        ],
        k: 'b20',
      },
      { type: 'h3', content: '4.6. GitHub', k: 'b21' },
      {
        type: 'p',
        content: [
          'Our website can be accessed at:  ',
          {
            text: 'https://github.com/YosemiteCrew/Yosemite-Crew',
            href: 'https://github.com/YosemiteCrew/Yosemite-Crew',
            k: 'r0',
          },
        ],
        k: 'b22',
      },
      {
        type: 'p',
        content:
          'The network is operated by: GitHub B.V Prins Bernhardplein 200, Amsterdam 1097JB, Netherlands.',
        k: 'b23',
      },
      {
        type: 'p',
        content: [
          'Privacy policy of the network:  ',
          {
            text: 'https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement',
            href: 'https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement',
            k: 'r0',
          },
        ],
        k: 'b24',
      },
      { type: 'h3', content: '4.7. Joint responsibility', k: 'b25' },
      {
        type: 'p',
        content: [
          { text: 'Purposes:', bold: true, k: 'r0' },
          '  We process personal data as our own controller when you send us inquiries via social media profiles. We process this data to respond to your inquiries.',
        ],
        k: 'b26',
      },
      {
        type: 'p',
        content:
          'In addition, we are jointly responsible with the following networks for the following processing (Art. 26 GDPR). When you visit our profile on LinkedIn and Instagram, TikTok, X.com, Discord, Github the network collects aggregated statistics (“Insights data”) created from certain events logged by their servers when you interact with our profiles and the content associated with them. We receive these aggregated and anonymous statistics from the network about the use of our profile. We are generally unable to associate the data with specific users. To a certain extent, we can determine the criteria according to which the network compiles these statistics for us. We use these statistics to make our profiles more interesting and informative for you.',
        k: 'b27',
      },
      {
        type: 'p',
        content: [
          'For more information about this data processing by LinkedIn, please refer to the joint controller agreement at:  ',
          {
            text: 'https://legal.linkedin.com/pages-joint-controller-addendum',
            href: 'https://legal.linkedin.com/pages-joint-controller-addendum',
            k: 'r0',
          },
        ],
        k: 'b28',
      },
      {
        type: 'p',
        content: [
          'Further information on this data processing by Instagram can be found in the joint controller agreement at:  ',
          {
            text: 'https://www.facebook.com/legal/terms/information_about_page_insights_data',
            href: 'https://www.facebook.com/legal/terms/information_about_page_insights_data',
            k: 'r0',
          },
        ],
        k: 'b29',
      },
      {
        type: 'p',
        content: [
          'Further information on this data processing by TikTok can be found in the joint controller agreement at:  ',
          {
            text: 'https://www.tiktok.com/legal/page/global/tiktok-analytics-joint-controller-addendum/en',
            href: 'https://www.tiktok.com/legal/page/global/tiktok-analytics-joint-controller-addendum/en',
            k: 'r0',
          },
        ],
        k: 'b30',
      },
      {
        type: 'p',
        content: [
          'Further information on this data processing by X.com can be found in the joint controller agreement at:  ',
          {
            text: 'https://gdpr.x.com/en/controller-to-controller-transfers.html',
            href: 'https://gdpr.x.com/en/controller-to-controller-transfers.html',
            k: 'r0',
          },
        ],
        k: 'b31',
      },
      {
        type: 'p',
        content: [
          'Further information on this data processing by Discord can be found in the joint controller agreement at:  ',
          {
            text: 'https://discord.com/terms/local-laws',
            href: 'https://discord.com/terms/local-laws',
            k: 'r0',
          },
        ],
        k: 'b32',
      },
      {
        type: 'p',
        content: [
          'Further information on this data processing by Github can be found in the joint controller agreement at:  ',
          {
            text: 'https://github.com/customer-terms/github-data-protection-agreement',
            href: 'https://github.com/customer-terms/github-data-protection-agreement',
            k: 'r0',
          },
        ],
        k: 'b33',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          '  Processing is carried out on the basis of our legitimate interest (Art. 6 (1) (f) GDPR). The interest lies in the respective purpose.',
        ],
        k: 'b34',
      },
      {
        type: 'p',
        content: [
          { text: 'Storage period:', bold: true, k: 'r0' },
          '  We do not store any personal data ourselves within the scope of joint responsibility. With regard to contact requests outside the network, the above information on establishing contact applies accordingly.',
        ],
        k: 'b35',
      },
    ],
  },
  {
    id: 'recipients',
    title: '5. General information on recipients',
    blocks: [
      {
        type: 'p',
        content: [
          'When we process your data, it may be necessary to transfer or disclose your data to other recipients. In the sections on processing above, we name the specific recipients as far as we are able to do so. If recipients are located in a country outside the EU, we indicate this separately under the individual points listed above. Unless we expressly refer to an adequacy decision, no adequacy decision exists for the respective recipient country. In such cases, we will agree on appropriate safeguards in the form of standard contractual clauses to ensure an adequate level of data protection (unless other appropriate safeguards, such as binding corporate rules, exist). You can access the current versions of the standard contractual clauses at  ',
          {
            text: 'https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj.',
            href: 'https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj',
            k: 'r0',
          },
        ],
        k: 'b0',
      },
      {
        type: 'p',
        content: [
          {
            text: 'In addition to these specific recipients, data may also be transferred to other categories of recipients. These may be internal recipients, i.e., persons within our company, but also external recipients. Possible recipients may include, in particular:',
            bold: true,
            k: 'r0',
          },
        ],
        k: 'b1',
      },
      {
        type: 'ul',
        items: [
          {
            k: 'i0',
            blocks: [
              {
                type: 'text',
                content:
                  'Our employees who are responsible for processing and storing the data and whose employment relationship with us is governed by a confidentiality agreement.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i1',
            blocks: [
              {
                type: 'text',
                content:
                  'Service providers who act as processors bound by our instructions. These are primarily technical service providers whose services we use when we cannot or do not reasonably perform certain services ourselves.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i2',
            blocks: [
              {
                type: 'text',
                content:
                  'Third-party providers who support us in providing our services in accordance with our terms and conditions. For example: payment service providers, marketing service providers, and responsible gaming service providers.',
                k: 'b0',
              },
            ],
          },
          {
            k: 'i3',
            blocks: [
              {
                type: 'text',
                content:
                  'Authorities, in order to comply with our legal and reporting obligations, which may include reporting suspected fraud or criminal activity and cases of responsible gaming to the relevant authorities or authorized third parties.',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b2',
      },
    ],
  },
  {
    id: 'storage',
    title: '6. General information on storage duration',
    blocks: [
      {
        type: 'p',
        content:
          'We generally process your personal data for the storage period described above. However, data is often processed for more than one purpose, meaning that we may continue to process your data for a specific purpose even after the storage period has expired. In this case, the storage period specified for this purpose applies. We will delete your data immediately once the last storage period has expired.',
        k: 'b0',
      },
    ],
  },
  {
    id: 'automated',
    title: '7. Automated decision-making and obligation to provide data',
    blocks: [
      {
        type: 'p',
        content:
          'We do not use automated decision-making that has a legal effect on you or significantly affects you in a similar way.',
        k: 'b0',
      },
      {
        type: 'p',
        content:
          'Please note that you are not legally or contractually obligated to provide us with your data. Nevertheless, you must provide certain information when creating an account or performing other actions. Without this information, we cannot enter into a contractual relationship with you or provide you with the relevant offers.',
        k: 'b1',
      },
    ],
  },
  {
    id: 'rights',
    title: '8. What rights do you have with regard to the personal data you provide to us?',
    blocks: [
      {
        type: 'p',
        content: [
          'You have the following rights, provided that the legal requirements are met. To exercise these rights, you can contact using the following address:  ',
          { text: 'security@yosemitecrew.com', href: 'mailto:security@yosemitecrew.com', k: 'r0' },
          ' .',
        ],
        k: 'b0',
      },
      { type: 'h3', content: 'Art. 15 GDPR – Right of access by the data subject:', k: 'b1' },
      {
        type: 'p',
        content:
          'You have the right to obtain confirmation from us as to whether personal data concerning you are being processed and, if so, which data are being processed and the circumstances surrounding the processing.',
        k: 'b2',
      },
      { type: 'h3', content: 'Art. 16 GDPR – Right to rectification:', k: 'b3' },
      {
        type: 'p',
        content:
          'You have the right to request that we immediately correct any inaccurate personal data concerning you. Taking into account the purposes of the processing, you also have the right to request the completion of incomplete personal data, including by means of a supplementary statement.',
        k: 'b4',
      },
      { type: 'h3', content: 'Art. 17 GDPR – Right to erasure:', k: 'b5' },
      {
        type: 'p',
        content:
          'You have the right to request that we erase personal data concerning you without undue delay.',
        k: 'b6',
      },
      { type: 'h3', content: 'Art. 18 GDPR – Right to restriction of processing:', k: 'b7' },
      { type: 'p', content: 'You have the right to request that we restrict processing.', k: 'b8' },
      { type: 'h3', content: 'Art. 20 GDPR – Right to data portability:', k: 'b9' },
      {
        type: 'p',
        content:
          'In the event of processing based on consent or for the performance of a contract, you have the right to receive the personal data concerning you that you have provided to us in a structured, commonly used and machine-readable format and to transmit this data to another controller without hindrance from us or to have the data transmitted directly to the other controller, where technically feasible.',
        k: 'b10',
      },
      {
        type: 'h3',
        content:
          'Art. 77 GDPR in conjunction with § 19 BDSG – Right to lodge a complaint with a supervisory authority:',
        k: 'b11',
      },
      {
        type: 'p',
        content:
          'You have the right to lodge a complaint with a supervisory authority, in particular in the Member State of your habitual residence, place of work or place of the alleged infringement, if you consider that the processing of personal data relating to you infringes applicable law.',
        k: 'b12',
      },
      {
        type: 'p',
        content: [
          'To exercise any of these rights, use the ',
          { text: 'data request form', href: '/contact-us', k: 'r0' },
          ' or email ',
          { text: 'security@yosemitecrew.com', href: 'mailto:security@yosemitecrew.com', k: 'r1' },
          '.',
        ],
        k: 'b13',
      },
    ],
  },
  {
    id: 'objection',
    title: '9. In particular, right to object and withdrawal of consent',
    blocks: [
      {
        type: 'p',
        content:
          'You have the right to object at any time, on grounds relating to your particular situation, to the processing of personal data concerning you which is necessary for the performance of a task carried out in the public interest or in the exercise of official authority, or which is based on a legitimate interest on our part.',
        k: 'b0',
      },
      {
        type: 'p',
        content:
          'If you object, we will no longer process your personal data unless we can demonstrate compelling legitimate grounds for the processing that override your interests, rights, and freedoms, or the processing is necessary for the establishment, exercise, or defense of legal claims.',
        k: 'b1',
      },
      {
        type: 'p',
        content:
          'If we process your personal data for direct marketing purposes, you have the right to object to the processing at any time. If you object to processing for direct marketing purposes, we will no longer process your personal data for these purposes.',
        k: 'b2',
      },
      {
        type: 'p',
        content:
          'You can object at any time with future effect via one of the contact addresses known to you.',
        k: 'b3',
      },
      {
        type: 'p',
        content: [
          { text: 'Withdrawal of consent:', bold: true, k: 'r0' },
          ' You can revoke your consent at any time with future effect via one of the contact addresses known to you.',
        ],
        k: 'b4',
      },
    ],
  },
  {
    id: 'obligation',
    title: '10. Obligation to provide data',
    blocks: [
      {
        type: 'p',
        content:
          'You are not contractually or legally obliged to provide us with personal data. However, without the data you provide, we are unable to offer you our services.',
        k: 'b0',
      },
    ],
  },
  {
    id: 'contact',
    title: '11. If you have any comments or questions',
    blocks: [
      {
        type: 'p',
        content: [
          'We take all reasonable precautions to protect and secure your data. We welcome your questions and comments regarding data protection. If you have any questions regarding the collection, processing, or use of your personal data, or if you wish to request information, correction, blocking, or deletion of data, or revoke your consent, please contact ',
          { text: 'security@yosemitecrew.com', href: 'mailto:security@yosemitecrew.com', k: 'r0' },
          ' .',
        ],
        k: 'b0',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics (PostHog)',
    blocks: [
      {
        type: 'p',
        content: [
          'To understand how the product is used and improve it, we use ',
          { text: 'PostHog', bold: true, k: 'r0' },
          ' for privacy-friendly product analytics on our hosted service. We keep this to aggregate, product-improvement insights and do not run advertising trackers or sell data.',
        ],
        k: 'b0',
      },
      {
        type: 'p',
        content: [
          { text: 'Legal basis:', bold: true, k: 'r0' },
          ' your consent (Art. 6 para. 1 lit. a) GDPR), which we request through the cookie notice and which you can withdraw at any time with future effect. If you reject non-essential cookies, analytics is not loaded.',
        ],
        k: 'b1',
      },
      {
        type: 'p',
        content: [
          { text: 'Recipient:', bold: true, k: 'r0' },
          ' PostHog, for product analytics (EU hosting), where you have consented.',
        ],
        k: 'b2',
      },
    ],
  },
];
