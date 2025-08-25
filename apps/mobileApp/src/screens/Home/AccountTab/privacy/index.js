import React, {lazy, useEffect} from 'react';
import {
  SectionList,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import GText from '../../../../components/GText/GText';
import styles from './styles';
import HeaderButton from '../../../../components/HeaderButton';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import {scaledValue} from '../../../../utils/design.utils';

const TERMS_DATA = [
  {
    title: '1. Controller and Data Protection Officer',
    description: `The Controller is:\nDuneXploration UG((haftungsbeschränkt))\nAm Finther Weg 7\n55127 Mainz \nsecurity@yosemitecrew.com\n\nOur Data Protection Officer can be contacted at:\nEmail: security@yosemitecrew.com`,
    data: [],
  },
  {
    title: '2.Our Role Regarding Your Personal Data',
    description: `Under the General Data Protection Regulation (GDPR), the controller determines the purposes and means of processing personal data. A processor processes personal data on behalf of the controller and only in accordance with their instructions.\n\nDepending on the processing activity, DuneXploration  may act as a controller or processor:\n  • DuneXploration  is the controller when it determines how and why your data is processed, for example when you create a user account.\n  • The pet service providers (e.g. veterinary clinics, breeders, groomers, hospitals) act as controllers when they manage their interactions with you (e.g. appointments, invoices, prescriptions) and Yosemite Crew acts as their processor. \n\nRegardless of whether DuneXploration  is the controller or processor, DuneXploration  takes appropriate measures to ensure the protection and confidentiality of the personal data that DuneXploration  processes in accordance with the provisions of the GDPR and the legislation in Germany.`,
    data: [],
  },
  {
    title: '3.Processing Activities in Applications',
    description: `When you use our application, we process personal data. You are not legally required to provide this data, but without it, many features may not be available.\n\nThe following sections explain what data we process, for what purposes, for how long, and on what legal basis. You will also learn to whom we pass on your data. At the end of the privacy policy, you will also find information about our storage periods, general recipients, and algorithmic decision-making.`,
    data: [
      {
        key: '3.1',
        label: 'Web Application',
        labelDescription:
          'Our web application is offered to business owners and web developers',

        items: [
          {
            key: '3.1.1',
            itemsLabel: 'Server Provision and Hosting',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `The web application can be self-hosted or hosted in the cloud. If you choose our cloud, we collect and temporarily store certain data to ensure the operation, availability, stability and security of the application.`,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `IP address, time and date of access, browser type and version, operating system. `,
              },
              {
                paraHeadings: 'Recipient',
                ParaDes: `\n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland.\n•  Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: ` The legitimate interest in ensuring the technical functionality and security of our software (Art. 6 para. 1 lit. f) GDPR).`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: ` Log data is deleted after 7 days`,
              },
            ],
          },
          {
            key: '3.1.2',
            itemsLabel: 'Signing up and setting up a profile',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `To register and onboard veterinary businesses, create accounts, and establish secure access for managing their practice's information and activities, thus allowing them to provide services through the platform`,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `In particular, work email, business name, business type (veterinary business, breeding facility, pet sitter, groomer shop), registration number, address, specialised department, provided services, professional background (specialisation, qualification, medical license number), appointment duration (consultation mode, consultation fee, username).`,
              },
              {
                paraHeadings: 'Recipients',
                ParaDes: `\n•  Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.\n•  Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.\n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: ` Establishment of the user relationship, Art. 6 para. 1 lit. b) GDPR. By providing voluntary profile information, you consent to the processing of this data, Art. 6 para. 1 lit. a) GDPR`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: ` The data will generally be processed for as long as you maintain your account with us. After termination of the account, your data will be deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.`,
              },
            ],
          },
          {
            key: '3.1.3',
            itemsLabel: 'General Use of the Application',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `To allow businesses to use the application and all its core functions (such as creating appointments, adding prescriptions, generating bills, creating appointments), we process the information you enter, and data generated during use.`,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `In particular, name, e-mail address, phone number, doctor’s name, prescription notes, billing details, payment information. `,
              },
              {
                paraHeadings: 'Recipients',
                ParaDes: `\n•  Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.\n•  Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.\n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland.`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: `  The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: ` We store the data as long as the user account is active. Data may be deleted upon account deletion unless legal retention applies.`,
              },
            ],
          },
          {
            key: '3.1.4',
            itemsLabel: '3.1.4. Contacting Clients und Communications',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `The application allows communication with clients and within teams. This can include sending messages, images and videos related to the pet’s condition, treatment, or general care questions. `,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `Messages, attachments (photos, videos), pet-related context (e.g. symptoms, recent treatments), metadata (timestamps, sender/ recipient). `,
              },
              {
                paraHeadings: 'Recipients',
                ParaDes: `\n•  Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.\n•  Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland./n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland.\n•  Selected clients.`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: `  The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: ` We store the data until the conversation or account is deleted unless the deletion of individual data or documents is prevented by statutory retention obligations`,
              },
            ],
          },
          {
            key: '3.1.5',
            itemsLabel: 'Payment',
            itemsLabelDescription:
              'Business owners and developers can implement their preferred payment options and payment services directly in the web application. The payment is directly performed over these payment providers. DuneXploration does not process any personal data in connection with the payment.',
          },
        ],
      },
      {
        key: '3.2',
        label: 'Mobile Application ',
        labelDescription:
          'The web application is accessible via the following link: https://app.yosemitecrew.com',

        items: [
          {
            key: '3.2.1',
            itemsLabel: 'Server Provision and Hosting',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `The application is hosted on servers to be made technically available for users. For this purpose, we collect and temporarily store certain data to ensure the operation, availability, stability and security of the software. `,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `IP address, time and date of access, browser type and version, operating system. `,
              },
              {
                paraHeadings: 'Recipient',
                ParaDes: `Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: ` The legitimate interest in ensuring the technical functionality and security of our software (Art. 6 para. 1 lit. f) GDPR)`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: `Log data is deleted after 7 days.`,
              },
            ],
          },
          {
            key: '3.2.2',
            itemsLabel: 'Signing up and setting up a profile',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `To onboard new users (pet owners, breeders, groomers, and vet doctors) to the mobile application, enabling account creation, authentication, and access to platform features. `,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: ` In particular, name, e-mail address, phone number, address, type of user. `,
              },
              {
                paraHeadings: 'Recipients',
                ParaDes: ` \n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland.\n•  Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland, \n•  Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg, and\n•  Your identity provider, if you use the log-in of a third party service (we support Meta, Google or Apple). `,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: `Establishment of the user relationship, Art. 6 para. 1 lit. b) GDPR. `,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: ` Storage period: The data will generally be processed for as long as you maintain your account with us. After termination of the account, your data will be deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.`,
              },
            ],
          },
          {
            key: '3.2.3',
            itemsLabel: 'General Use of the Application',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `In particular, name, e-mail address, phone number, type and content of enquiry, message. `,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `In particular, name, e-mail address, phone number, doctor’s name, prescription notes, billing details, payment information. `,
              },
              {
                paraHeadings: 'Recipients',
                ParaDes: `\n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland,\n•  Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland,\n•  Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: `  The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: `We store the data as long as the user account is active. Data may be deleted upon account deletion unless legal retention applies.`,
              },
            ],
          },
          {
            key: '3.2.4',
            itemsLabel: 'Booking Appointments',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `To enable pet owners to book appointments with veterinarians through the Yosemite Crew mobile application. `,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `Name, e-mail address, telephone number, booking details and, if applicable, desired appointment reminders or additional comments on your booking. The data marked as mandatory fields must be provided in order to make a booking. `,
              },
              {
                paraHeadings: 'Recipient',
                ParaDes: `\n•  Google Ireland Limited, Gordon House, Barrow Street, Dublin 4,\n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland.\n•  Selected veterinarians. 
`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: `  The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: `The data collected as part of the booking will be deleted after the expiry of the applicable statutory retention obligations (6 years according to HGB, 10 years according to AO).`,
              },
            ],
          },
          {
            key: '3.2.5',
            itemsLabel: 'Contacting Veterinarians und Communications',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `To enable meaningful communication between pet owners and veterinary professionals the user can contact veterinarians directly through the application. This can include sending messages, images and videos related to the pet’s condition, treatment, or general care questions. If you contact the veterinarian, your data will be processed to the extent necessary for the veterinarian to answer your inquiry and for any follow-up measures.`,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `Messages, attachments (photos, videos), pet-related context (e.g. symptoms, recent treatments), metadata (timestamps, sender/ recipient).`,
              },
              {
                paraHeadings: 'Recipient',
                ParaDes: `\n•  Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.\n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland.\n•  Selected veterinarians`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: ` The processing is necessary for the performance of the user contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: `We store the data until the conversation or account is deleted unless the deletion of individual data or documents is prevented by statutory retention obligations.`,
              },
            ],
          },
          {
            key: '3.2.6',
            itemsLabel: 'Review and Ratings',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `Users can provide feedback on services received from pet service providers to help other users to make their decision and enhance user friendliness`,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `Rating (in the form of starts), review text, name, timestamp. `,
              },
              {
                paraHeadings: 'Recipients',
                ParaDes: `\n•  Any user of the PMS - including the pet service provider selected by the user - can view the review.\n•  Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.\n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland.`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: ` Voluntary consent to publish review (Art. 6 para 1 lit. a GDPR).`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: `We store the data until the review is manually removed by the user or deleted due to inactivity or policy violations.  `,
              },
            ],
          },
          {
            key: '3.2.7',
            itemsLabel: 'Payment',
            itemsLabelDescription:
              'Users can pay assessment fees directly or receive invoices for treatments via the app. When payment is made through the app, the transaction is directly performed by the pet service providers own payment services. We will not process any payment data in connection with the payment process.',
          },
          {
            key: '3.2.8',
            itemsLabel: 'Pet Medical Records and Health Features',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `To enable users to record, track and share their pet's medical and health information, such as medical conditions, medications, vaccination status and observations (e.g. water intake or pain levels), users can add information to their profile. This allows for better monitoring and communication with veterinary care providers.`,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `Pet's medical records (vaccinations, prescriptions, diagnoses), daily health logs, notes on behaviour or pain, exercise schedules, reminders, task lists. `,
              },
              {
                paraHeadings: 'Recipient',
                ParaDes: `\nAmazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.\n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland.\n•  Pet service provider selected by the user. `,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: `The legitimate interest in pursuing the aforementioned purposes (Art. 6 para. 1 lit. f. GDPR).`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: `As long as the pet profile exists and data is not manually deleted. Full deletion occurs with account removal or upon user request. `,
              },
            ],
          },
          {
            key: '3.2.9',
            itemsLabel: 'Contacting Us',
            paragraphs: [
              {
                paraHeadings: 'Purpose',
                ParaDes: `Users can contact us through the application by sending us a message. Users can submit a general enquiry, feature request or a data subject access request. When you contact us at, your data will be processed to the extent necessary to answer your enquiry and for any follow-up measures.`,
              },
              {
                paraHeadings: 'Categories of data',
                ParaDes: `Inventory data (e.g., names, addresses), contact details, content data, metadata (timestamps, sender/ recipient). `,
              },
              {
                paraHeadings: 'Recipient',
                ParaDes: `\n•  Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.\n•  Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxemburg.\n•  MongoDB Inc., 3 Shelbourne Building, Crampton Avenue Ballsbridge, Dublin 4, Irland`,
              },
              {
                paraHeadings: 'Legal basis',
                ParaDes: ` Contract fulfillment and pre-contractual inquiries (Art. 6 para. 1 lit. b. GDPR); legitimate interests (Art. 6 para. 1 lit. f. GDPR) in the processing of communication.`,
              },
              {
                paraHeadings: 'Storage period',
                ParaDes: `The data will generally be processed for as long as it is necessary to process the inquiry. `,
              },
            ],
          },
        ],
      },

      ,
    ],
  },

  {
    title: '4. Presence on social media',
    description: `We have profiles on social networks. Our social media accounts complement our PMS and offer you the opportunity to interact with us. As soon as you access our social media profiles on social networks, the terms and conditions and data processing guidelines of the respective operators apply. The data collected about you when you use the services is processed by the networks and may also be transferred to countries outside the European Union where there is no adequate level of protection for the processing of personal data. We have no influence on data processing in social networks, as we are users of the network just like you.  Information on this and on what data is processed by the social networks and for what purposes the data is used can be found in the privacy policy of the respective network listed below. We use the following social networks:`,
    data: [
      {
        key: '4.1',
        itemsLabel: 'LinkedIn',
        paragraphs: [
          {
            // paraHeadings: 'Website',
            ParaDes: `Our website can be accessed at: https://de.linkedin.com/company/yosemitecrew \n\nThe network is operated by:  LinkedIn Ireland Unlimited Company, Wilton Place, Dublin 2, Irland.\n\nPrivacy policy of the network: www.linkedin.com/legal/privacy-policy  `,
          },
        ],
      },
      {
        key: '4.2',
        itemsLabel: 'TikTok',
        paragraphs: [
          {
            // paraHeadings: 'Website',
            ParaDes: `Our website can be accessed at: https://www.tiktok.com/@yosemitecrew \n\nThe network is operated by:  TikTok Technology Limited, 10 Earlsfort Terrace, Dublin, D02 T380, Ireland.\n\nPrivacy policy of the network: https://www.tiktok.com/legal/page/eea/privacy-policy/de `,
          },
        ],
      },
      {
        key: '4.3',
        itemsLabel: 'Instagram',
        paragraphs: [
          {
            ParaDes: `Our website can be accessed at: https://www.instagram.com/yosemite_crew \n\nThe network is operated by:  Meta Platforms Ireland Limited, 4 Grand Canal Square, Dublin 2, Ireland.\n\nPrivacy policy of the network: https://privacycenter.instagram.com/`,
          },
        ],
      },
      {
        key: '4.4',
        itemsLabel: 'X.com',
        paragraphs: [
          {
            ParaDes: `Our website can be accessed at: http://x.com/yosemitecrew .\n\nThe network is operated by: X Internet Unlimited Company, One Cumberland Place, Fenian Street, Dublin 2, D02 AX07 Ireland.\n\n Privacy policy of the network: https://x.com/de/privacy `,
          },
        ],
      },
      {
        key: '4.5',
        itemsLabel: 'Discord',
        paragraphs: [
          {
            ParaDes: `Our website can be accessed at: https://discord.gg/YVzMa9j7BK .\n\nThe network is operated by:  Discord Netherlands BV,   Schiphol Boulevard 195, 1118 BG Schiphol, Netherlands.\n\nPrivacy policy of the network: https://discord.com/privacy `,
          },
        ],
      },
      {
        key: '4.6',
        itemsLabel: 'GitHub',
        paragraphs: [
          {
            ParaDes: `Our website can be accessed at: https://github.com/YosemiteCrew/Yosemite-Crew The network is operated by:  GitHub B.V Prins Bernhardplein 200, Amsterdam 1097JB, Netherlands. Privacy policy of the network: https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement `,
          },
        ],
      },
      {
        key: '4.7',
        itemsLabel: 'Joint responsibility',
        paragraphs: [
          {
            ParaDes: `Purposes: We process personal data as our own controller when you send us inquiries via social media profiles. We process this data to respond to your inquiries.\n\nIn addition, we are jointly responsible with the following networks for the following processing (Art. 26 GDPR).\nWhen you visit our profile on LinkedIn and Instagram,Tik-Tok, X.com, Discord, Github the network collects aggregated statistics (“Insights data”) created from certain events logged by their servers when you interact with our profiles and the content associated with them. We receive these aggregated and anonymous statistics from the network about the use of our profile. We are generally unable to associate the data with specific users. To a certain extent, we can determine the criteria according to which the network compiles these statistics for us. We use these statistics to make our profiles more interesting and informative for you. \n\nFor more information about this data processing by LinkedIn, please refer to the joint controller agreement at:\nhttps://legal.linkedin.com/pages-joint-controller-addendum.\n\nFurther information on this data processing by Instagram can be found in the joint controller agreement at: https://www.facebook.com/legal/terms/information_about_page_insights_data\n\nFurther information on this data processing by TikTok can be found in the joint controller agreement at: https://www.tiktok.com/legal/page/global/tiktok-analytics-joint-controller-addendum/en \n\nFurther information on this data processing by X.com can be found in the joint controller agreement at: https://gdpr.x.com/en/controller-to-controller-transfers.html\n\n
Further information on this data processing by Discord can be found in the joint controller agreement at: https://discord.com/terms/local-laws\n\nFurther information on this data processing by Github can be found in the joint controller agreement at: https://github.com/customer-terms/github-data-protection-agreement\n\nLegal basis: Processing is carried out on the basis of our legitimate interest (Art. 6 (1) (f) GDPR). The interest lies in the respective purpose.\n\nStorage period: We do not store any personal data ourselves within the scope of joint responsibility. With regard to contact requests outside the network, the above information on establishing contact applies accordingly.`,
          },
        ],
      },
    ],
  },

  {
    title: '5.General information on recipients',
    description: `When we process your data, it may be necessary to transfer or disclose your data to other recipients. In the sections on processing above, we name the specific recipients as far as we are able to do so. If recipients are located in a country outside the EU, we indicate this separately under the individual points listed above. Unless we expressly refer to an adequacy decision, no adequacy decision exists for the respective recipient country. In such cases, we will agree on appropriate safeguards in the form of standard contractual clauses to ensure an adequate level of data protection (unless other appropriate safeguards, such as binding corporate rules, exist). You can access the current versions of the standard contractual clauses at https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj.\n\nIn addition to these specific recipients, data may also be transferred to other categories of recipients. These may be internal recipients, i.e., persons within our company, but also external recipients. Possible recipients may include, in particular:\n•  Our employees who are responsible for processing and storing the data and whose employment relationship with us is governed by a confidentiality agreement.\n•  Service providers who act as processors bound by our instructions. These are primarily technical service providers whose services we use when we cannot or do not reasonably perform certain services ourselves.\n•  Third-party providers who support us in providing our services in accordance with our terms and conditions. For example: payment service providers, marketing service providers, and responsible gaming service providers.\n•  Authorities, in order to comply with our legal and reporting obligations, which may include reporting suspected fraud or criminal activity and cases of responsible gaming to the relevant authorities or authorized third parties.`,
    data: [
      //
    ],
  },
  {
    title: ' 6. General information on storage duration',
    description: `We generally process your personal data for the storage period described above. However, data is often processed for more than one purpose, meaning that we may continue to process your data for a specific purpose even after the storage period has expired. In this case, the storage period specified for this purpose applies. We will delete your data immediately once the last storage period has expired.`,
    data: [
      //
    ],
  },
  {
    title: ' 7. Automated decision-making and obligation to provide data',
    description: `We do not use automated decision-making that has a legal effect on you or significantly affects you in a similar way.

Please note that you are not legally or contractually obligated to provide us with your data. Nevertheless, you must provide certain information when creating an account or performing other actions. Without this information, we cannot enter into a contractual relationship with you or provide you with the relevant offers.`,
    data: [
      //
    ],
  },
  {
    title:
      ' 8. What rights do you have with regard to the personal data you provide to us?',
    description: `You have the following rights, provided that the legal requirements are met. To exercise these rights, you can contact using the following address:\nsecurity@yosemitecrew.com.`,
    data: [
      //
    ],
  },
  {
    title: 'Art. 15 GDPR – Right of access by the data subject:',
    description: `You have the right to request that we immediately correct any inaccurate personal data concerning you. Taking into account the purposes of the processing, you also have the right to request the completion of incomplete personal data, including by means of a supplementary statement.`,
    data: [
      //
    ],
  },
  {
    title: 'Art. 16 GDPR – Right to rectification:',
    description: `You have the right to obtain confirmation from us as to whether personal data concerning you are being processed and, if so, which data are being processed and the circumstances surrounding the processing.`,
    data: [
      //
    ],
  },
  {
    title: 'Art. 17 GDPR – Right to erasure:',
    description: `You have the right to request that we erase personal data concerning you without undue delay.`,
    data: [
      //
    ],
  },
  {
    title: 'Art. 18 GDPR – Right to restriction of processing:',
    description: `You have the right to obtain confirmation from us as to whether personal data concerning you are being processed and, if so, which data are being processed and the circumstances surrounding the processing.`,
    data: [
      //
    ],
  },
  {
    title: 'Art. 20 GDPR – Right to data portability:',
    description: `You have the right to lodge a complaint with a supervisory authority, in particular in the Member State of your habitual residence, place of work or place of the alleged infringement, if you consider that the processing of personal data relating to you infringes applicable law.`,
    data: [
      //
    ],
  },
  {
    title:
      'Art. 77 GDPR in conjunction with § 19 BDSG – Right to lodge a complaint with a supervisory authority:',
    description: `You have the right to obtain confirmation from us as to whether personal data concerning you are being processed and, if so, which data are being processed and the circumstances surrounding the processing.`,
    data: [
      //
    ],
  },
  {
    title: ' 9. In particular, right to object and withdrawal of consent',
    description: `You have the right to object at any time, on grounds relating to your particular situation, to the processing of personal data concerning you which is necessary for the performance of a task carried out in the public interest or in the exercise of official authority, or which is based on a legitimate interest on our part.\n\nIf you object, we will no longer process your personal data unless we can demonstrate compelling legitimate grounds for the processing that override your interests, rights, and freedoms, or the processing is necessary for the establishment, exercise, or defense of legal claims.\n\nIf we process your personal data for direct marketing purposes, you have the right to object to the processing at any time. If you object to processing for direct marketing purposes, we will no longer process your personal data for these purposes.\n\nYou can object at any time with future effect via one of the contact addresses known to you.\n\nWithdrawal of consent: You can revoke your consent at any time with future effect via one of the contact addresses known to you.`,
    data: [
      //
    ],
  },
  {
    title: ' 10. Obligation to provide data',
    description: `You are not contractually or legally obliged to provide us with personal data. However, without the data you provide, we are unable to offer you our services.`,
    data: [
      //
    ],
  },
  {
    title: ' 11. If you have any comments or questions ',
    description: `We take all reasonable precautions to protect and secure your data. We welcome your questions and comments regarding data protection. If you have any questions regarding the collection, processing, or use of your personal data, or if you wish to request information, correction, blocking, or deletion of data, or revoke your consent, please contact \nsecurity@yosemitecrew.com.`,
    data: [
      //
    ],
  },
];

const Privacy = ({navigation}) => {
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          style={{marginLeft: scaledValue(20)}}
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, []);
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{
          flex: 1,
          paddingHorizontal: scaledValue(20),
          marginTop: scaledValue(10),
        }}>
        <GText GrMedium text="Privacy Policy" style={styles.header} />
        <GText
          GrRegular
          style={styles.headerText}
          text="The protection and security of your personal information is important to us. This privacy policy describes how we collect, process, and store personal data through our open-source practice management software (hereinafter referred to as “PMS” or “the Software”). Our Software is available as a web application and as a mobile application. Unless stated otherwise, the information provided applies equally to both versions. This policy helps you to understand what information we collect, why we collect it, how we use it, and how long we store it."
        />

        <SectionList
          sections={TERMS_DATA}
          keyExtractor={(item, index) => item?.key + index}
          renderSectionHeader={({section}) => (
            <View style={styles.sectionHeader}>
              <GText SatoshiBold text={section.title} style={styles.heading} />
              {section.description && (
                <GText text={section.description} style={styles.description} />
              )}
            </View>
          )}
          renderItem={({item}) => {
            // CASE 1: Section with label + items (like Section 3)
            if (item?.label && item?.items) {
              return (
                <View style={styles.itemContainer}>
                  <GText
                    SatoshiBold
                    text={`${item?.key}. ${item?.label ?? ''}`}
                    style={styles.subSectionHeading}
                  />
                  {item?.text && (
                    <GText
                      SatoshiRegular
                      text={item.text}
                      style={styles.pointText}
                    />
                  )}
                  {item.labelDescription && (
                    <GText
                      SatoshiRegular
                      text={item.labelDescription}
                      style={styles.labelDescription}
                    />
                  )}
                  {item.items.map((sub, idx) => (
                    <View key={idx} style={styles.subItem}>
                      <GText
                        SatoshiBold
                        text={`${sub.key}. ${sub.itemsLabel ?? ''} ${
                          sub.text ?? ''
                        }`}
                        style={styles.item}
                      />
                      {sub.paragraphs?.map((para, pIdx) => (
                        <View key={pIdx} style={styles.paragraphItem}>
                          {para.paraHeadings && para.ParaDes ? (
                            <Text style={styles.paraText}>
                              <Text style={styles.paraHeading}>
                                {para.paraHeadings}:{' '}
                              </Text>
                              {para.ParaDes}
                            </Text>
                          ) : (
                            <>
                              {para.paraHeadings && (
                                <GText
                                  SatoshiBold
                                  text={`${para.paraHeadings}:`}
                                  style={styles.paraHeading}
                                />
                              )}
                              {para.ParaDes && (
                                <GText
                                  SatoshiRegular
                                  text={para.ParaDes}
                                  style={styles.paraText}
                                />
                              )}
                            </>
                          )}
                        </View>
                      ))}

                      {sub.bullets && (
                        <View style={styles.bulletList}>
                          {sub.bullets.map((bullet, i) => (
                            <View key={i} style={styles.bulletItem}>
                              <GText text={'\u2022'} style={styles.bulletDot} />
                              <GText text={bullet} style={styles.bulletText} />
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              );
            }

            // ✅ CASE 2: Section with just items (like Section 4 — Social Media)
            if (item?.itemsLabel && item?.paragraphs) {
              return (
                <View style={styles.subItem}>
                  <GText
                    SatoshiBold
                    text={`${item?.key}. ${item?.itemsLabel ?? ''}`}
                    style={styles.item}
                  />
                  {item.paragraphs?.map((para, pIdx) => (
                    <View key={pIdx} style={styles.paragraphItem}>
                      {para.paraHeadings && (
                        <GText
                          SatoshiBold
                          text={para.paraHeadings}
                          style={styles.paraHeading}
                        />
                      )}
                      {para.ParaDes && (
                        <GText
                          SatoshiRegular
                          text={para.ParaDes}
                          style={styles.paraText}
                        />
                      )}
                    </View>
                  ))}
                  {item.bullets && (
                    <View style={styles.bulletList}>
                      {item.bullets.map((bullet, i) => (
                        <View key={i} style={styles.bulletItem}>
                          <GText text={'\u2022'} style={styles.bulletDot} />
                          <GText text={bullet} style={styles.bulletText} />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            }

            return (
              <View style={styles.itemContainer}>
                <GText
                  text={`${item?.key}. ${item?.label ?? ''} ${
                    item?.text ?? ''
                  }`}
                  style={styles.item}
                />
              </View>
            );
          }}
        />

        <GText
          style={styles.updationText}
          SatoshiBold
          text="Updated: June 2025"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Privacy;
