import type {LegalSection} from './legalContentTypes';
import {p, seg, b, u, ol, oli} from './legalContentHelpers';
import {
  createControllerSection,
  createRecipientsList,
  createLegitimateInterestBasis,
  createLogStoragePeriod,
  createMobileRecipientsList,
  createContractBasis,
  createActiveAccountStorage,
  createContactSection,
  createDataSubjectRightsSection,
  createObjectionSection,
  createObligationProvideData,
} from './sharedLegalSections';

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  // Intro (no heading): center-align this paragraph
  {
    id: 'intro',
    title: '',
    align: 'center',
    blocks: [
      p(
        seg(
          'The protection and security of your personal information is important to us. This privacy policy describes how we collect, process, and store personal data through our open-source practice management software (hereinafter referred to as “PMS” or “the Software”). Our Software is available as a web application and as a mobile application. Unless stated otherwise, the information provided applies equally to both versions. This policy helps you to understand what information we collect, why we collect it, how we use it, and how long we store it.',
        )
      ),
    ],
  },

  createControllerSection(),

  {
    id: 'roles',
    title: '2. Our Role Regarding Your Personal Data',
    blocks: [
      p(
        seg(
          'Under the General Data Protection Regulation (GDPR), the controller determines the purposes and means of processing personal data. A processor processes personal data on behalf of the controller and only in accordance with their instructions.'
        )
      ),
      // Converted from 3.a/3.b/3.c to bullet points
      ol(
        oli('•', ' Depending on the processing activity, DuneXploration may act as a controller or processor.'),
        oli('•', ' DuneXploration is the controller when it determines how and why your data is processed, for example when you create a user account.'),
        oli('•', ' The pet service providers (e.g. veterinary clinics, breeders, groomers, hospitals) act as controllers when they manage their interactions with you (e.g. appointments, invoices, prescriptions) and Yosemite Crew acts as their processor.')
      ),
      p(
        seg(
          'Regardless of whether DuneXploration is the controller or processor, DuneXploration takes appropriate measures to ensure the protection and confidentiality of the personal data that DuneXploration processes in accordance with the provisions of the GDPR and the legislation in Germany.'
        )
      ),
    ],
  },

  {
    id: 'processing-apps',
    title: '3. Processing Activities in Applications',
    blocks: [
      p(
        seg(
          'When you use our application, we process personal data. You are not legally required to provide this data, but without it, many features may not be available.\n\nThe following sections explain what data we process, for what purposes, for how long, and on what legal basis. You will also learn to whom we pass on your data. At the end of the privacy policy, you will also find information about our storage periods, general recipients, and algorithmic decision-making.'
        )
      ),
    ],
  },

  {
    id: 'web-app',
    title: '3.1. Web Application',
    blocks: [p(seg('Our web application is offered to business owners and web developers.'))],
  },

  {
    id: 'web-hosting',
    title: '3.1.1. Server Provision and Hosting',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          'The web application can be self-hosted or hosted in the cloud. If you choose our cloud, we collect and temporarily store certain data to ensure the operation, availability, stability and security of the application.'
        )
      ),
      p(b('Categories of data: '), seg('IP address, time and date of access, browser type and version, operating system.')),
      p(b('Recipients:')),
      createRecipientsList(),
      createLegitimateInterestBasis(),
      createLogStoragePeriod(),
    ],
  },

  {
    id: 'web-signup',
    title: '3.1.2. Signing up and setting up a profile',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          "To register and onboard veterinary businesses, create accounts, and establish secure access for managing their practice's information and activities, thus allowing them to provide services through the platform."
        )
      ),
      p(
        b('Categories of data: '),
        seg(
          'In particular, work email, business name, business type (veterinary business, breeding facility, pet sitter, groomer shop), registration number, address, specialised department, provided services, professional background (specialisation, qualification, medical license number), appointment duration (consultation mode, consultation fee, username).'
        )
      ),
      p(b('Recipients:')),
      ol(
        oli('•', ' Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.'),
        oli('•', ' Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.'),
        oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.')
      ),
      p(
        b('Legal basis: '),
        seg('Establishment of the user relationship, Art. 6 para. 1 lit. b) GDPR. By providing voluntary profile information, you consent to the processing of this data, Art. 6 para. 1 lit. a) GDPR.')
      ),
      p(
        b('Storage period: '),
        seg(
          'The data will generally be processed for as long as you maintain your account with us. After termination of the account, your data will be deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.'
        )
      ),
    ],
  },

  {
    id: 'web-general-use',
    title: '3.1.3. General Use of the Application',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          'To allow businesses to use the application and all its core functions (such as creating appointments, adding prescriptions, generating bills, creating appointments), we process the information you enter, and data generated during use.'
        )
      ),
      p(b('Categories of data: '), seg('In particular, name, e-mail address, phone number, doctor’s name, prescription notes, billing details, payment information.')),
      p(b('Recipients:')),
      createRecipientsList(),
      createContractBasis(),
      createActiveAccountStorage(),
    ],
  },

  {
    id: 'web-communications',
    title: '3.1.4. Contacting Clients and Communications',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          'The application allows communication with clients and within teams. This can include sending messages, images and videos related to the pet’s condition, treatment, or general care questions.'
        )
      ),
      p(b('Categories of data: '), seg('Messages, attachments (photos, videos), pet-related context (e.g. symptoms, recent treatments), metadata (timestamps, sender/ recipient).')),
      p(b('Recipients:')),
      createRecipientsList(),
      p(b('Recipients:'), seg(' Selected clients.')),
      createContractBasis(),
      p(b('Storage period: '), seg('We store the data until the conversation or account is deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.')),
    ],
  },

  {
    id: 'web-payment',
    title: '3.1.5. Payment',
    blocks: [
      p(
        seg(
          'Business owners and developers can implement their preferred payment options and payment services directly in the web application. The payment is directly performed over these payment providers. DuneXploration does not process any personal data in connection with the payment.'
        )
      ),
    ],
  },


  {
    id: 'mobile-hosting',
    title: '3.2. Mobile Application',
    blocks: [
      p(b('3.2.1. Server Provision and Hosting')),
      p(
        b('Purpose: '),
        seg(
          'The application is hosted on servers to be made technically available for users. For this purpose, we collect and temporarily store certain data to ensure the operation, availability, stability and security of the software.'
        )
      ),
      p(b('Categories of data: '), seg('IP address, time and date of access, browser type and version, operating system.')),
      p(b('Recipients:')),
      ol(oli('•', ' Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.')),
      createLegitimateInterestBasis(),
      createLogStoragePeriod(),
    ],
  },

  {
    id: 'mobile-signup',
    title: '3.2.2. Signing up and setting up a profile',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          'To onboard new users (Pet owner/Companion Owner, breeders, groomers, and vet doctors) to the mobile application, enabling account creation, authentication, and access to platform features.'
        )
      ),
      p(b('Categories of data: '), seg('In particular, name, e-mail address, phone number, address, type of user.')),
      p(b('Recipients:')),
      ol(
        oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.'),
        oli('•', ' Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.'),
        oli('•', ' Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.'),
        oli('•', ' Your identity provider, if you use the log-in of a third party service (we support Meta, Google or Apple).')
      ),
      p(b('Legal basis: '), seg('Establishment of the user relationship, Art. 6 para. 1 lit. b) GDPR.')),
      p(
        b('Storage period: '),
        seg(
          'The data will generally be processed for as long as you maintain your account with us. After termination of the account, your data will be deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.'
        )
      ),
    ],
  },

  {
    id: 'mobile-general-use',
    title: '3.2.3. General Use of the Application',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          'To allow users to use the application and all its core functions (such as creating pet profiles, managing daily care tasks, recording notes of health data, adding vaccination record, creating exercise plans etc), we process the information you enter and data generated during use.'
        )
      ),
      p(b('Categories of data: '), seg('In particular, name, e-mail address, phone number, type and content of enquiry, message.')),
      p(b('Recipients:')),
      createMobileRecipientsList(),
      createContractBasis(),
      createActiveAccountStorage(),
    ],
  },

  {
    id: 'mobile-booking',
    title: '3.2.4. Booking Appointments',
    blocks: [
      p(b('Purpose: '), seg('To enable Pet owner/Companion Owner to book appointments with veterinarians through the Yosemite Crew mobile application.')),
      p(
        b('Categories of data: '),
        seg(
          'Name, e-mail address, telephone number, booking details and, if applicable, desired appointment reminders or additional comments on your booking. The data marked as mandatory fields must be provided in order to make a booking.'
        )
      ),
      p(b('Recipients:')),
      ol(
        oli('•', ' Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.'),
        oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.'),
        oli('•', ' Selected veterinarians.')
      ),
      createContractBasis(),
      p(
        b('Storage period: '),
        seg('The data collected as part of the booking will be deleted after the expiry of the applicable statutory retention obligations (6 years according to HGB, 10 years according to AO).')
      ),
    ],
  },

  {
    id: 'mobile-communications',
    title: '3.2.5. Contacting Veterinarians and Communications',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          'To enable meaningful communication between Pet owner/Companion Owner and Pet professionals/Pet businesses the user can contact veterinarians directly through the application. This can include sending messages, images and videos related to the pet’s condition, treatment, or general care questions. If you contact the veterinarian, your data will be processed to the extent necessary for the veterinarian to answer your inquiry and for any follow-up measures.'
        )
      ),
      p(b('Categories of data: '), seg('Messages, attachments (photos, videos), pet-related context (e.g. symptoms, recent treatments), metadata (timestamps, sender/ recipient).')),
      p(b('Recipients:')),
      ol(
        oli('•', ' Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.'),
        oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.'),
        oli('•', ' Selected veterinarians.')
      ),
      createContractBasis(),
      p(b('Storage period: '), seg('We store the data until the conversation or account is deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.')),
    ],
  },

  {
    id: 'mobile-reviews',
    title: '3.2.6. Review and Ratings',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          'Users can provide feedback on services received from pet service providers to help other users to make their decision and enhance user friendliness.'
        )
      ),
      p(b('Categories of data: '), seg('Rating (in the form of stars), review text, name, timestamp.')),
      p(b('Recipients:')),
      ol(
        oli('•', ' Any user of the PMS — including the pet service provider selected by the user — can view the review.'),
        oli('•', ' Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.'),
        oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.')
      ),
      p(b('Legal basis: '), seg('Voluntary consent to publish review (Art. 6 para 1 lit. a GDPR).')),
      p(b('Storage period: '), seg('We store the data until the review is manually removed by the user or deleted due to inactivity or policy violations.')),
    ],
  },

  {
    id: 'mobile-payment',
    title: '3.2.7. Payment',
    blocks: [
      p(
        seg(
          'Users can pay assessment fees directly or receive invoices for treatments via the app. When payment is made through the app, the transaction is directly performed by the pet service providers own payment services. We will not process any payment data in connection with the payment process.'
        )
      ),
    ],
  },

  {
    id: 'mobile-health',
    title: '3.2.8. Pet Medical Records and Health Features',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          "To enable users to record, track and share their pet's medical and health information, such as medical conditions, medications, vaccination status and observations (e.g. water intake or pain levels), users can add information to their profile. This allows for better monitoring and communication with veterinary care providers."
        )
      ),
      p(b('Categories of data: '), seg("Pet's medical records (vaccinations, prescriptions, diagnoses), daily health logs, notes on behaviour or pain, exercise schedules, reminders, task lists.")),
      p(b('Recipients:')),
      ol(
        oli('•', ' Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.'),
        oli('•', ' MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Ireland.'),
        oli('•', ' Pet service provider selected by the user.')
      ),
      p(b('Legal basis: '), seg('The legitimate interest in pursuing the aforementioned purposes (Art. 6 para. 1 lit. f. GDPR).')),
      p(b('Storage period: '), seg('As long as the pet profile exists and data is not manually deleted. Full deletion occurs with account removal or upon user request.')),
    ],
  },

  {
    id: 'mobile-contact-us',
    title: '3.2.9. Contacting Us',
    blocks: [
      p(
        b('Purpose: '),
        seg(
          'Users can contact us through the application by sending us a message. Users can submit a general enquiry, feature request or a data subject access request. When you contact us, your data will be processed to the extent necessary to answer your enquiry and for any follow-up measures.'
        )
      ),
      p(b('Categories of data: '), seg('Inventory data (e.g., names, addresses), contact details, content data, metadata (timestamps, sender/ recipient).')),
      p(b('Recipients:')),
      createMobileRecipientsList(),
      p(
        b('Legal basis: '),
        seg('Contract fulfillment and pre-contractual inquiries (Art. 6 para. 1 lit. b. GDPR); legitimate interests (Art. 6 para. 1 lit. f. GDPR) in the processing of communication.')
      ),
      p(b('Storage period: '), seg('The data will generally be processed for as long as it is necessary to process the inquiry.')),
    ],
  },

  {
    id: 'social-media',
    title: '4. Presence on social media',
    blocks: [
      p(
        seg(
          'We have profiles on social networks. Our social media accounts complement our PMS and offer you the opportunity to interact with us. As soon as you access our social media profiles on social networks, the terms and conditions and data processing guidelines of the respective operators apply. The data collected about you when you use the services is processed by the networks and may also be transferred to countries outside the European Union where there is no adequate level of protection for the processing of personal data. We have no influence on data processing in social networks, as we are users of the network just like you. Information on this and on what data is processed by the social networks and for what purposes the data is used can be found in the privacy policy of the respective network listed below. We use the following social networks:'
        )
      ),
    ],
  },

  {
    id: 'social-linkedin',
    title: '4.1. LinkedIn',
    blocks: [
      p(seg('Our website can be accessed at: '), u('https://de.linkedin.com/company/yosemitecrew')),
      p(seg('The network is operated by: LinkedIn Ireland Unlimited Company, Wilton Place, Dublin 2, Ireland.')),
      p(seg('Privacy policy of the network: '), u('www.linkedin.com/legal/privacy-policy')),
    ],
  },

  {
    id: 'social-tiktok',
    title: '4.2. Tik-Tok',
    blocks: [
      p(seg('Our website can be accessed at: '), u('https://www.tiktok.com/@yosemitecrew')),
      p(seg('The network is operated by: TikTok Technology Limited, 10 Earlsfort Terrace, Dublin, D02 T380, Ireland.')),
      p(seg('Privacy policy of the network: '), u('https://www.tiktok.com/legal/page/eea/privacy-policy/de')),
    ],
  },

  {
    id: 'social-instagram',
    title: '4.3. Instagram',
    blocks: [
      p(seg('Our website can be accessed at: '), u('https://www.instagram.com/yosemite_crew')),
      p(seg('The network is operated by: Meta Platforms Ireland Limited, 4 Grand Canal Square, Dublin 2, Ireland.')),
      p(seg('Privacy policy of the network: '), u('https://privacycenter.instagram.com/')),
    ],
  },

  {
    id: 'social-x',
    title: '4.4. X.com',
    blocks: [
      p(seg('Our website can be accessed at: '), u('https://x.com/yosemitecrew')),
      p(seg('The network is operated by: X Internet Unlimited Company, One Cumberland Place, Fenian Street, Dublin 2, D02 AX07 Ireland.')),
      p(seg('Privacy policy of the network: '), u('https://x.com/de/privacy')),
    ],
  },

  {
    id: 'social-discord',
    title: '4.5. Discord',
    blocks: [
      p(seg('Our website can be accessed at: '), u('https://discord.gg/YVzMa9j7BK')),
      p(seg('The network is operated by: Discord Netherlands BV,  Schiphol Boulevard 195, 1118 BG Schiphol, Netherlands.')),
      p(seg('Privacy policy of the network: '), u('https://discord.com/privacy')),
    ],
  },

  {
    id: 'social-github',
    title: '4.6. GitHub',
    blocks: [
      p(seg('Our website can be accessed at: '), u('https://github.com/YosemiteCrew/Yosemite-Crew')),
      p(seg('The network is operated by: GitHub B.V Prins Bernhardplein 200, Amsterdam 1097JB, Netherlands.')),
      p(seg('Privacy policy of the network: '), u('https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement')),
    ],
  },

  {
    id: 'social-joint',
    title: '4.7. Joint responsibility',
    blocks: [
      p(b('Purposes: '), seg('We process personal data as our own controller when you send us inquiries via social media profiles. We process this data to respond to your inquiries.')),
      p(
        seg(
          'In addition, we are jointly responsible with the following networks for the following processing (Art. 26 GDPR). When you visit our profile on LinkedIn and Instagram, Tik-Tok, X.com, Discord, Github the network collects aggregated statistics (“Insights data”) created from certain events logged by their servers when you interact with our profiles and the content associated with them. We receive these aggregated and anonymous statistics from the network about the use of our profile. We are generally unable to associate the data with specific users. To a certain extent, we can determine the criteria according to which the network compiles these statistics for us. We use these statistics to make our profiles more interesting and informative for you.'
        )
      ),
      p(seg('For more information about this data processing by LinkedIn, please refer to the joint controller agreement at:\n'), u('https://legal.linkedin.com/pages-joint-controller-addendum')),
      p(seg('Further information on this data processing by Instagram can be found in the joint controller agreement at:\n'), u('https://www.facebook.com/legal/terms/information_about_page_insights_data')),
      p(seg('Further information on this data processing by TikTok can be found in the joint controller agreement at:\n'), u('https://www.tiktok.com/legal/page/global/tiktok-analytics-joint-controller-addendum/en')),
      p(seg('Further information on this data processing by X.com can be found in the joint controller agreement at:\n'), u('https://gdpr.x.com/en/controller-to-controller-transfers.html')),
      p(seg('Further information on this data processing by Discord can be found in the joint controller agreement at:\n'), u('https://discord.com/terms/local-laws')),
      p(seg('Further information on this data processing by Github can be found in the joint controller agreement at:\n'), u('https://github.com/customer-terms/github-data-protection-agreement')),
      p(b('Legal basis: '), seg('Processing is carried out on the basis of our legitimate interest (Art. 6 (1) (f) GDPR). The interest lies in the respective purpose.')),
      p(b('Storage period: '), seg('We do not store any personal data ourselves within the scope of joint responsibility. With regard to contact requests outside the network, the above information on establishing contact applies accordingly.')),
    ],
  },

  {
    id: 'recipients-general',
    title: '5. General information on recipients',
    blocks: [
      p(
        seg(
          'When we process your data, it may be necessary to transfer or disclose your data to other recipients. In the sections on processing above, we name the specific recipients as far as we are able to do so. If recipients are located in a country outside the EU, we indicate this separately under the individual points listed above. Unless we expressly refer to an adequacy decision, no adequacy decision exists for the respective recipient country. In such cases, we will agree on appropriate safeguards in the form of standard contractual clauses to ensure an adequate level of data protection (unless other appropriate safeguards, such as binding corporate rules, exist). You can access the current versions of the standard contractual clauses at '
        ),
        u('https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj')
      ),
      p(
        seg(
          'In addition to these specific recipients, data may also be transferred to other categories of recipients. These may be internal recipients, i.e., persons within our company, but also external recipients. Possible recipients may include, in particular:\n• Our employees who are responsible for processing and storing the data and whose employment relationship with us is governed by a confidentiality agreement.\n• Service providers who act as processors bound by our instructions. These are primarily technical service providers whose services we use when we cannot or do not reasonably perform certain services ourselves.\n• Third-party providers who support us in providing our services in accordance with our terms and conditions. For example: payment service providers, marketing service providers, and responsible gaming service providers.\n• Authorities, in order to comply with our legal and reporting obligations, which may include reporting suspected fraud or criminal activity and cases of responsible gaming to the relevant authorities or authorized third parties.'
        )
      ),
    ],
  },

  {
    id: 'storage-duration',
    title: '6. General information on storage duration',
    blocks: [
      p(
        seg(
          'We generally process your personal data for the storage period described above. However, data is often processed for more than one purpose, meaning that we may continue to process your data for a specific purpose even after the storage period has expired. In this case, the storage period specified for this purpose applies. We will delete your data immediately once the last storage period has expired.'
        )
      ),
    ],
  },

  {
    id: 'automated-decision',
    title: '7. Automated decision-making and obligation to provide data',
    blocks: [
      p(
        seg(
          'We do not use automated decision-making that has a legal effect on you or significantly affects you in a similar way.\n\nPlease note that you are not legally or contractually obligated to provide us with your data. Nevertheless, you must provide certain information when creating an account or performing other actions. Without this information, we cannot enter into a contractual relationship with you or provide you with the relevant offers.'
        )
      ),
    ],
  },

  createDataSubjectRightsSection(),

  createObjectionSection(),

  createObligationProvideData(),

  createContactSection('11. If you have any comments or questions', 'contact-questions'),

    {
    id: 'updated-june-2025',
    title: '',
    blocks: [ p(b('Updated : June 2025')),
 ]
  },

];

export type {LegalSection as PrivacySection} from './legalContentTypes';
