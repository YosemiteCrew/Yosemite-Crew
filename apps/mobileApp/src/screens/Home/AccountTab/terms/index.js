import React, {useEffect} from 'react';
import {
  SectionList,
  Text,
  Image,
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import GText from '../../../../components/GText/GText';
import styles from './styles';
import Input from '../../../../components/Input';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../utils';
import GButton from '../../../../components/GButton';
import HeaderButton from '../../../../components/HeaderButton';
import {colors} from '../../../../../assets/colors';
import {scaledValue} from '../../../../utils/design.utils';

const TERMS_DATA = [
  {
    title: '1. Scope and Applicability',
    data: [
      {
        key: '1.1',
        text: 'DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7, 55127 Mainz, Germany (“DuneXploration” or “we/us/our”) provides a Mobile App for Pet Owners that is accessible via app stores for supported mobile devices.',
      },
      {
        key: '1.2',
        text: 'These Terms of Use (“Terms” or “Agreement”) guide the legal relationships between DuneXploration and the Pet Owners.',
      },
      {
        key: '1.3',
        text: 'DuneXploration rejects any and all terms and conditions of Pet Owners. Only these Terms apply to the respective contractual relationships with DuneXploration.',
      },
      {
        key: '1.4',
        text: 'In the event of a conflict between these Terms and an individual agreement between DuneXploration and a Pet Owner, the individual agreement shall prevail, unless explicitly provided otherwise in these Terms.',
      },
    ],
  },
  {
    title: '2. Definitions',
    description:
      'In addition to terms defined elsewhere in this Agreement, the following terms have the following meanings:\n',
    data: [
      {
        key: '2.1',
        label: 'Account',
        text: 'means the personal Account provided to the Pet Owner after the User’s registration.',
      },
      {
        key: '2.2',
        label: 'Pet Professionals',
        text: 'means e.g. veterinarians, breeders, groomers or boarding services who can interact with Pet Owners and offer their services in the Mobile App.',
      },
      {
        key: '2.3',
        label: 'Consumer',
        text: 'means every natural person who enters into a legal transaction for the purposes that predominantly are outside his trade, business or profession (Sec. 13 BGB German Civil Law Code).',
      },
      {
        key: '2.4',
        label: 'Intellectual Property',
        text: 'means all rights of intellectual property, such as copyrights, trademark rights, patents, model rights, trade name rights, database rights and neighbouring rights, as well as domain names and know-how and any related rights.',
      },
      {
        key: '2.5',
        label: 'Mobile App',
        text: 'means the application that provides Pet Owners access to services of Pet Professionals and certain functions such as booking appointments.',
      },
      {
        key: '2.6',
        label: 'Paid Services',
        text: 'are services offered by Pet Professionals to Pet Owners on the Mobile App against remuneration.',
      },
      {
        key: '2.7',
        label: 'Pet Owner',
        text: 'means a person using the Mobile App to manage their pets and book appointments or services at a Pet Professional.',
      },
    ],
  },
  {
    title: `3. Conclusion of the Agreement and Registering an Account\n`,
    data: [
      {
        key: '3.1',
        // label: 'To use the Mobile App',
        text: 'To use the Mobile App and its functions, the Pet Owner must download the Mobile App to a device and register for an Account. The Mobile App is available to download from the most common app stores. Download and Registering is free of charge for the Pet Owner.',
      },
      {
        key: '3.2',
        // label: 'To use the Mobile App',
        text: ' Registering is possible by using an email address or a log-in service, such as Google, Facebook or Apple. When the Pet Owner uses a log-in service, separate terms of the provider of the log-in service might apply and personal data will be exchanged between DuneXploration and the log-in service.',
      },
      {
        key: '3.3',
        // label: 'To use the Mobile App',
        text: 'The Pet Owner has to be at least 18 years old and in full legal capacity to open an Account.',
      },
      {
        key: '3.4',
        // label: 'To use the Mobile App',
        text: 'When registering, the Pet Owner is required to provide certain basic information, including name, mobile number, email address, date of birth and address. The Pet Owner is obliged to provide the data collected upon conclusion of the contract truthfully and completely. In the event of subsequent changes to the data collected, the Pet Owner must update the relevant information in their Account without delay.',
      },
      {
        key: '3.5',
        // label: 'To use the Mobile App',
        text: 'By clicking on "Create Account", the Pet Owner requests DuneXploration to create an Account. DuneXploration will send an email with a legally binding offer to open the Account and to confirm the Pet Owners email address. By clicking on the verification link provided in the email, the Pet Owner accepts the offer, concludes the Agreement with DuneXploration and opens the Account',
      },
      {
        key: '3.6',
        // label: 'To use the Mobile App',
        text: ' Upon first signing in to the Account, the Pet Owner requests a one-time password by entering their registered email address and clicking on “Send OTP”. DuneXploration will then send an email containing a 4-digit login code. After verifying this code in the Mobile App, the Pet Owner can choose a new personal password.',
      },
      {
        key: '3.7',
        // label: 'To use the Mobile App',
        text: 'The Pet Owner shall keep all account information, in particular the chosen password confidential and shall not disclose it to third parties.',
      },
      {
        key: '3.8',
        // label: 'To use the Mobile App',
        text: 'The Pet Owner can access the latest version of these Terms at any time on the Mobile App. The Agreement is concluded in English and the Terms are exclusively available in English',
      },
    ],
  },

  {
    title: '4. Functions of the Mobile App',

    data: [
      {
        key: '4.1',
        label: `General Features \n`,
        items: [
          {
            key: '4.1.1',
            text: `The Mobile App provides various functions to support the daily care and health management of pets.\n`,
          },
          {
            key: '4.1.2',
            text: `In the Mobile App, the Pet Owner can (among other things):`,
            bullets: [
              'Create pet profiles.',
              'Add details of his Pet Professional (veterinarians, breeders, groomers or boarding services).',
              'Book appointments with the Pet Professionals.',
              'Purchase services of the Pet Professionals.',
              'Share pet duties with a partner.',
              'Add and track expenses.',
              'Add medical information about his pet, and',
              `Access articles and blog posts on relevant matters.\n`,
            ],
          },
          {
            key: '4.1.3',
            text: 'All services rendered by the Pet Professionals (such as booking appointments, providing emergency services or diabetes assessments) rely on a separate contractual relationship with the Pet Professional. DuneXploration is not part of this contractual relationship.',
          },
        ],
      },
      {
        key: '4.2',
        label: `Contact Vet/ Practice \n`,
        items: [
          {
            key: '4.2.1',
            text: `The Mobile App allows Pet Owners to contact Pet Professionals by sending them an (emergency) message. Pet Owners may select the pet, describe the issue and upload images or videos to support the inquiry.\n`,
          },
          {
            key: '4.2.2',
            text: 'DuneXploration does not guarantee immediate response or the availability of any specific Pet Professional.',
          },
        ],
      },
      {
        key: '4.3',
        label: `Appointment Booking Service\n`,
        items: [
          {
            key: '4.3.1',
            text: `The Pet Owner can make an appointment with a registered Pet Professional, provided that the selected time is shown as available. Each appointment is sent to the Pet Professional in real time. The Pet Professional might reschedule the appointment if necessary or delete it from their schedule in accordance with legal requirements. In this case, the Pet Owner will be notified immediately (e.g., by email or push notification).\n`,
          },
          {
            key: '4.3.2',
            text: `The Pet Owner can also`,
            bullets: [
              ' manage the appointments (cancel, reschedule)',

              'share concerns or documents to prepare for an appointment',

              'view the history of their appointments',
              'view prescribed treatments or medications',
              ' communicate with the Pet Professional after the appointment via an in-app chat and',

              `share feedback \n`,
            ],
          },
          {
            key: '4.3.3',
            text: 'The Pet Owner undertakes to provide all necessary information requested for the booking and performance of the selected service.',
          },
          {
            key: '4.3.4',
            text: 'It is the Pet Owners responsibility to carry out all the checks they deem necessary or appropriate before making an appointment with a Pet Profession.',
          },
          {
            key: '4.3.5',
            text: 'Pet Professionals practice their profession independently and in accordance with professional and other legal regulations. DuneXploration only provides the technical platform and will not be part of any contractual relationship between Pet Professionals and Pet Owners. Hence DuneXploration cannot be held responsible in any way for the cancellation or unavailability of the Pet Professionals after the Pet Owner has made an appointment via the online appointment booking service.',
          },
          {
            key: '4.3.6',
            text: 'Making an appointment via the Mobile App constitutes a binding commitment between the Pet Owner and the Pet Professional. The Pet Owner must inform the Pet Professional in advance of any failure to attend an agreed appointment. This information can be provided either via the cancellation options offered by the Mobile App or by any other means of contacting the Pet Professional. Failure to show up may result in fees by the Pet Professional or other consequences over which DuneXploration has no control.',
          },
        ],
      },
      {
        key: '4.4',
        label: ' Medical Records',
        items: [
          {
            key: '4.4.1',

            text: 'The Mobile App allows Pet Owners to (i) upload and manage medical records (e.g. invoices, insurance slips, lab results) and (ii) receive documents from Pet Professionals (e.g. prescriptions).',
          },
          {
            key: '4.4.2',
            text: 'The Pet Owner is responsible for the accuracy and completeness of the information provided in the medical records. DuneXploration does not verify the content of these records and is not liable for any inaccuracies or omissions.',
          },
          {
            key: '4.4.3',
            text: 'Yosemite Crew is not a backup service and DuneXploration cannot be held liable for loss or deletion of uploaded or created documents. Pet Owners shall keep separate backups of important documents outside the Mobile App.',
          },
          {
            key: '4.4.4',
            text: 'It lies in the Pet Owners’ sole discretion to ensure that they have all necessary rights to share the uploaded documents and that the documents do not infringe rights of any third party in any way.',
          },
          {
            key: '4.4.5',
            text: 'DuneXploration is not responsible for the content or accuracy of the documents that Pet Professionals share with the Pet Owner.',
          },
        ],
      },
      {
        key: '4.5',
        label: ' Exercise Plan',
        items: [
          {
            key: '4.5.1',

            text: 'Pet Owners can create exercise plans for their pets by answering a few questions. Based on the answers provided by the Pet Owner, DuneXploration will generate a recommendation of exercises that might help and support their pet.',
          },
          {
            key: '4.5.2',
            text: 'The Pet Owner must be aware that the exercise plan cannot replace a veterinary professional’s opinion and guidance. Hence, DuneXploration will not guarantee the plan’s effectiveness or that the exercises are suitable for the individual pet. It lies in the Pet Owner’s sole discretion to ensure that the exercises are not harmful to their pet. Especially if the pet has a specific medical condition, the Pet Owner should consult a veterinary professional before performing any exercises.',
          },
        ],
      },
      {
        key: '4.6',
        label: 'Pain Journal',
        description:
          'Pet Owners may assess their pet’s flea and tick risk using the Mobile App. Based on the input provided by the Pet Owner, an assessment report is generated, which can be shared with a veterinarian.',
        items: [
          {
            key: '4.6.1',

            text: 'The Mobile App enables Pet Owners to monitor their pet’s pain level by rating various indicators or using a visual pain scale. Based on the scores, the App calculates a pain score that can be (i) sent to the veterinarian, (ii) saved to the Pain Journal or (iii) be used to create an appointment. ',
          },
          {
            key: '4.6.2',

            text: 'The assessments provided are based on the Pet Owner’s input and are intended for informational purposes only. DuneXploration cannot guarantee the correctness or validity of the pain score.\n',
          },
        ],
      },
      {
        key: '4.7',
        label: 'Parasiticide Management',
        description:
          'Pet Owners may assess their pet’s flea and tick risk using the Mobile App. Based on the input provided by the Pet Owner, an assessment report is generated, which can be shared with a veterinarian.',
        // items: [
        //   {
        //     key: '4.6.1',

        //     text: 'The Mobile App enables Pet Owners to monitor their pet’s pain level by rating various indicators or using a visual pain scale. Based on the scores, the App calculates a pain score that can be (i) sent to the veterinarian, (ii) saved to the Pain Journal or (iii) be used to create an appointment. ',
        //   },
        //   {
        //     key: '4.6.2',

        //     text: 'The assessments provided are based on the Pet Owner’s input and are intended for informational purposes only. DuneXploration cannot guarantee the correctness or validity of the pain score.\n',
        //   },
        // ],
      },
      {
        key: '4.8',
        label: 'Diabetes Management',
        description: `Pet Owners can document relevant diabetes monitoring parameters and arrange an evaluation with selected veterinarians for an additional fee (Paid Service)`,
        // items: [
        //   {
        //     key: '4.6.1',

        //     text: 'The Mobile App enables Pet Owners to monitor their pet’s pain level by rating various indicators or using a visual pain scale. Based on the scores, the App calculates a pain score that can be (i) sent to the veterinarian, (ii) saved to the Pain Journal or (iii) be used to create an appointment. ',
        //   },
        //   {
        //     key: '4.6.2',

        //     text: 'The assessments provided are based on the Pet Owner’s input and are intended for informational purposes only. DuneXploration cannot guarantee the correctness or validity of the pain score.\n',
        //   },
        // ],
      },
      {
        key: '4.9',
        label: 'Changes to the functions offered',
        description:
          'DuneXploration reserves the right to add, remove or modify functions from the Mobile App in the future. It will notify Pet Owners of changes.',
        // items: [
        //   {
        //     key: '4.6.1',

        //     text: 'The Mobile App enables Pet Owners to monitor their pet’s pain level by rating various indicators or using a visual pain scale. Based on the scores, the App calculates a pain score that can be (i) sent to the veterinarian, (ii) saved to the Pain Journal or (iii) be used to create an appointment. ',
        //   },
        //   {
        //     key: '4.6.2',

        //     text: 'The assessments provided are based on the Pet Owner’s input and are intended for informational purposes only. DuneXploration cannot guarantee the correctness or validity of the pain score.\n',
        //   },
        // ],
      },
    ],
  },
  {
    title: '5.Paid Services ',
    description:
      'Pet Owners may assess their pet’s flea and tick risk using the Mobile App. Based on the input provided by the Pet Owner, an assessment report is generated, which can be shared with a veterinarian.',
    data: [
      {
        key: '5.1',
        label: 'Booking of a Paid Service',
        description:
          'Pet Owners may assess their pet’s flea and tick risk using the Mobile App. Based on the input provided by the Pet Owner, an assessment report is generated, which can be shared with a veterinarian.',
        items: [
          {
            key: '5.1.1',
            text: 'The presentation of the Paid Service in the Mobile App does not constitute a legally binding offer by the Pet Professional. Only by selecting the desired Paid Service, the payment method and by clicking “Pay now”, the Pet Owner submits a legally binding offer to conclude a contract with the selected Pet Professional. The Pet Owner will then immediately receive confirmation or rejection of the offer. If the offer is confirmed and thereby accepted, the contract is concluded.',
          },
          {
            key: '5.1.2',
            text: 'The Paid Service might be subject to separate terms of the Pet Professional.',
            // bullets: [
            //   'Create pet profiles.',
            //   'Add details of his Pet Professional (veterinarians, breeders, groomers or boarding services).',
            //   'Book appointments with the Pet Professionals.',
            //   'Purchase services of the Pet Professionals.',
            //   'Share pet duties with a partner.',
            //   'Add and track expenses.',
            //   'Add medical information about his pet, and',
            //   'Access articles and blog posts on relevant matters.',
            // ],
          },
          {
            key: '5.1.3',
            text: ' Legally the Paid Services are classified as service offerings under German law and therefore no statutory warranty applies. If in exceptional cases the underlying contract can be classified as a contract for work services and the Pet Professional resides in Germany, the Pet Owner might have warranty rights according to Sec. 634 German Civil Law Code.',
          },
        ],
      },
    ],
  },
  {
    title: `6.Fees \n`,
    data: [
      {
        key: '6.1',
        // label: 'To use the Mobile App',
        text: 'Sign-up and Using the Mobile App is free of charge.',
      },
      {
        key: '6.2',
        // label: 'To use the Mobile App',
        text: 'Where Paid Services are offered the Pet Owner will be informed in advance of any costs. All prices include applicable VAT and are displayed transparently before the offer is submitted.',
      },
      {
        key: '6.3',
        // label: 'To use the Mobile App',
        text: 'The Pet Owner will be informed about the available payment options and can select a payment method before making a booking.',
      },
      {
        key: '6.4',
        // label: 'To use the Mobile App',
        text: 'The payment is generally due immediately after the conclusion of contract. If the payment is not facilitated immediately, the Pet Owner has to make the payment within the period specified on the invoice or fee notice. The payment process may be subject to separate terms depending on the chosen payment option.  ',
      },
      {
        key: '6.5',
        // label: 'To use the Mobile App',
        text: 'Prices may be adjusted at any time, effective for the future. Existing contracts are not affected. ',
      },
    ],
  },
  {
    title: '7.Right of Withdrawal Policy',
    description:
      'If the Pet Owner acts as Consumer, the Pet Owner has a fourteen-day right of withdrawal. Regarding this right of withdrawal, please refer to the Addendum \n',
    data: [
      // {
      // },
    ],
  },
  {
    title: '8.Reviews and Moderation',
    description:
      'After a Pet Owner has used the services of a Pet Professional the Pet Owner can rate the Pet Professional on a scale from zero to five stars and also write a review of the Pet Professional. The following rules apply to these reviews:\n',
    data: [
      {
        key: '8.1',
        label: ' Illegal Content',
        items: [
          {
            key: '8.1.1',
            text: 'Pet owners may only submit truthful ratings and reviews that reflect their own experience. The reviews must be written in appropriate and respectful language. Illegal content is therefore prohibited, including anything that violates laws, other legal provisions, these Terms, or the rights of natural or legal persons. ',
          },
          {
            key: '8.1.2.',
            text: 'Specifically the following violations are therefore prohibited: insults, hate speech, defamation and slander, and other false statements, violations of the right to privacy and intimacy, threats, and, of course, violations of copyright or other property.',
          },
          {
            key: '8.1.3',
            text: 'Advertising content for third-party products and services is also prohibited. ',
          },
        ],
      },
      {
        key: '8.2',
        label: ' Usage Rights',
        items: [
          {
            key: '8.2.1',
            text: 'When Pet Owners post reviews, they grant DuneXploration a transferable, simple, perpetual and unrestricted right of use to the content to the extent necessary for the operation of the service. In particular, Pet Owners grant DuneXploration the right to make the review technically available and to make the necessary copies for this purpose (storage on servers, etc.)',
          },
          {
            key: '8.2.2',
            text: ' In addition, the Pet Owner grants DuneXploration the right to make the content publicly accessible, to transmit it, and to reproduce it in other ways within the scope of DuneXploration’s function as the operator of the platform. The granting of rights is irrevocable and does not end with the termination of the agreement with the Pet Owner. Reviews will therefore remain accessible on the platform even if the Pet Owner terminates their account. ',
          },
        ],
      },
      {
        key: '8.3',
        label: 'Verification, Checks and Moderation of Reviews',
        items: [
          {
            key: '8.3.1',
            text: 'DuneXploration does not verify, check or moderate reviews. However, it reserves the right to conduct such checks, particularly in cases of suspected violations.',
          },
          {
            key: '8.3.2',
            text: 'DuneXploration does not use any automatic systems, filters, or similar tools automatically scan, edit, block, remove, or take other measures regarding reviews. ',
          },
          {
            key: '8.3.3',
            text: `DuneXploration provides a reporting form that can be used to report inappropriate content.`,
          },
        ],
      },
      {
        key: '8.4',
        label: ' Consequences of Violations',
        items: [
          {
            key: '8.4.1',

            text: 'DuneXploration shall edit or delete reviews that violate provisions from this section at its own discretion.',
          },
          {
            key: '8.4.2',
            text: 'In the event of a serious violation or repeated minor violations, DuneXploration may also delete the Account and/or issue a ban and permanently block users.',
          },
          {
            key: '8.4.3',
            text: 'DuneXploration will inform all persons affected by the measures with a justification for the decision.',
          },
          {
            key: '8.4.4',
            text: 'DuneXploration will always act carefully, objectively, and proportionately when checking reviews and implementing measures, thereby taking into account the rights and legitimate interests of all parties involved.',
          },
        ],
      },
      {
        key: '8.5',
        label: ' Possibilities to Complaint',
        items: [
          {
            key: '8.5.1',

            text: 'If a Pet Owner has the opinion that reviews violate either these Terms or applicable laws, they can use the reporting mechanisms provided in the Mobile App. DuneXploration will then review the information in question and either block it or inform the Pet Owner that no action is being taken and explain why.',
          },
          {
            key: '8.5.2',
            text: 'This section is without prejudice to the rights of EU Pet Owners to take their case to certified out-of-court complaint bodies.',
          },
        ],
      },
      {
        key: '8.6',
        label: 'Pain Journal\n',
        text: 'DuneXploration is legally obliged to inform law enforcement authorities if it becomes aware of any information included in a review that gives rise to a suspicion that a criminal offense has been committed, is being committed, or may be committed that poses a threat to the life or safety of a person or persons',
        // items: [

        // ],
      },
      {
        key: '8.7',
        label: ' Possibilities to Complaint',
        items: [
          {
            key: '8.7.1',

            text: 'Pet Owners are liable for the reviews they publish. ',
          },
          {
            key: '8.7.2',
            text: ' Pet Owners undertake to indemnify and hold DuneXploration harmless from any liability and costs, including potential and actual costs of legal proceedings, should DuneXploration be held liable by third parties because the respective Pet Owner has culpably violated the Terms of Use, laws, or the rights of third parties, or has otherwise acted unlawfully',
          },
        ],
      },
    ],
  },

  {
    title: `9.Pet Owner Obligations`,
    data: [
      {
        key: '9.1',
        // label: 'To use the Mobile App',
        text: 'The terms of this Agreement commence upon the Pet Owner’s registration.',
      },
      {
        key: '9.2',
        // label: 'To use the Mobile App',
        text: 'The content available on the Mobile App can be protected by Intellectual Property Rights or other protective rights. The compilation of the content as such may also be protected as a database or database work within the meaning of Sections 4 (2) and 87a (1) of the German Copyright Act (UrhG). Pet Owners may only use this content in accordance with the Agreement. No rights beyond this use are granted.',
      },
    ],
  },
  {
    title: `10.Term and Termination`,
    data: [
      {
        key: '10.1',
        // label: 'To use the Mobile App',
        text: 'The terms of this Agreement commence upon the Pet Owner’s registration.',
      },
      {
        key: '10.2',
        // label: 'To use the Mobile App',
        text: ' The Pet Owner can delete their Account via the settings menu on the Mobile App.',
      },
      {
        key: '10.3',
        // label: 'To use the Mobile App',
        text: 'In the event of a violation of the provisions of the contract by the Pet Owner, DuneXploration may take appropriate measures to prevent such breaches. If the Pet Owner violates contractual obligations despite a warning from DuneXploration and if DuneXploration cannot reasonably be expected to continue the contractual relationship, taking into account all circumstances of the individual case and weighing the interests of both parties, DuneXploration has the right to terminate the Agreement without notice for good cause.',
      },
    ],
  },
  {
    title: `11.Data Protection`,
    data: [
      {
        key: '11.1',
        // label: 'To use the Mobile App',
        text: `DuneXploration collects, processes, and uses the Pet Owner's personal data. Information on data processing and data protection can be found in the Privacy Policy.`,
      },
      {
        key: '11.2',
        // label: 'To use the Mobile App',
        text: ' For some processing of personal data (such as the processing for the fulfilment of the treatment contract, DuneXploration acts as the Data Processor for the Pet Professional who acts as the Controller. Please refer to the Pet Professional’s privacy policy for more information.',
      },
    ],
  },
  {
    title: `12.Availability and Maintenance`,
    data: [
      {
        key: '12.1',
        // label: 'To use the Mobile App',
        text: `DuneXploration shall implement appropriate measures to ensure the availability and error free functionality of the Mobile App. However, the Pet Owner acknowledges that for technical reasons and due to the dependence on external influences, DuneXploration cannot guarantee the uninterrupted availability of the Platform.`,
      },
      {
        key: '11.2',
        // label: 'To use the Mobile App',
        text: 'DuneXploration will occasionally carry out maintenance work to ensure the functionality or expansion of the Mobile App. These tasks may result in a temporary impairment of the usability of the Mobile App.',
      },
    ],
  },
  {
    title: `13.Liability and Indemnification`,
    data: [
      {
        key: '13.1',
        // label: 'To use the Mobile App',
        text: `DuneXploration shall be liable in accordance with the statutory provisions. `,
      },
      {
        key: '13.2',
        // label: 'To use the Mobile App',
        text: 'The Pet Owner is responsible for ensuring the routine backup of their data, in particular the content uploaded onto the Mobile App. If the Pet Owner suffers damages that result from the loss of data, DuneXploration shall in each case only be liable for such damages that could not have been avoided by carrying out data backups of all relevant data in regular intervals.. These tasks may result in a temporary impairment of the usability of the Mobile App.',
      },
      {
        key: '13.3',
        // label: 'To use the Mobile App',
        text: 'The Pet Owner agrees to indemnify, defend and hold DuneXploration, its officers, directors, agents, affiliates, distribution partners, licensors and suppliers harmless from and against any and all claims, actions, proceedings, costs, liabilities, losses and expenses (including, but not limited to, reasonable attorneys’ fees) (collectively, “Claims”) suffered or incurred by such indemnified parties resulting from or arising out of any actual or alleged breach of the Pet Owner’s obligations, warranties and guarantees under these Terms or violation of any third party’s rights, provided that the breach or violation in question was or would have been a culpable breach or violation. DuneXploration shall inform the Pet Owner without delay of any such Claim, and will provide the Pet Owner with any reasonably available information on the Claim to facilitate the Pet Owner’s cooperation in defending against the Claim. The Pet Owner shall cooperate as fully as reasonably required in the defense of any Claim. DuneXploration reserves the right, at its own expense, to assume the exclusive defense and control of any matter subject to indemnification by the Pet Owner.',
      },
    ],
  },
  {
    title: `14.Changes to the Terms`,
    data: [
      {
        key: '14.1',
        // label: 'To use the Mobile App',
        text: `DuneXploration has the right to introduce additional functions to the Mobile App and add corresponding rules to the Terms. DuneXploration shall announce these changes at least four weeks before they enter into force to the Pet Owner by email. If the Pet Owner does not object in text form (e.g. letter, fax, e-mail) within a period of two weeks, beginning with the day following the announcement of the changes, DuneXploration assumes that the Pet Owner agrees to the changes. `,
      },
      {
        key: '14.2',
        // label: 'To use the Mobile App',
        text: 'DuneXploration shall inform the Pet Owner in the notice of his right to object, its requirements and consequences. If the Pet Owner objects to the changes, the contractual relationship shall be continued under the most recent version of the Terms before the change. In such case, DuneXploration reserves the right to terminate the contractual relationship with effect to the next possible date.',
      },
      {
        key: '14.3',
        // label: 'To use the Mobile App',
        text: 'Otherwise, a change of the terms of use is possible at any time with the consent of the user.',
      },
    ],
  },
  {
    title: `15.Availability and Maintenance`,
    data: [
      {
        key: '15.1',
        // label: 'To use the Mobile App',
        text: `This Agreement is governed by, and shall be interpreted in accordance with the laws of the Federal Republic of Germany, excluding the provisions of the United Nations Convention on Contracts for the International Sale of Goods and any conflict of law provisions that would require the application of the material law of another country`,
      },
      {
        key: '15.2',
        // label: 'To use the Mobile App',
        text: 'The Parties herby irrevocably submit to the exclusive jurisdiction of the courts of Mainz, Germany, for all disputes or claims arising out of or in connection with this Agreement made hereunder.',
      },
      {
        key: '15.3',
        // label: 'To use the Mobile App',
        text: 'If any provision of this Agreement is invalid or unenforceable in whole or in part, this shall not affect the validity and enforceability of any other provision of this Agreement. The invalid or unenforceable provision shall be deemed replaced by a valid and enforceable provision that comes as close as possible to the economic purpose that both parties had in mind with the invalid or unenforceable provision.',
      },
    ],
  },
];

const Terms = ({navigation}) => {
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

  const {t} = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{
          marginTop: scaledValue(25),
          flex: 1,
          paddingHorizontal: scaledValue(20),
        }}>
        <GText
          GrMedium
          style={styles.title}
          text="Terms of Use for the Yosemite Crew Mobile Applica tion"
        />
        <SectionList
          sections={TERMS_DATA}
          keyExtractor={(item, index) => item.key + index}
          renderSectionHeader={({section}) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.heading}>{section.title}</Text>
              {section.description && (
                <Text style={styles.description}>{section.description}</Text>
              )}
            </View>
          )}
          renderItem={({item}) => {
            if (item.label && item.items) {
              // Subsections with multiple items
              return (
                <View style={styles.itemContainer}>
                  <Text style={styles.subSectionHeading}>
                    {item.key}. {item.label}
                  </Text>
                  {item.items.map((sub, idx) => (
                    <View key={idx} style={styles.subItem}>
                      <Text style={styles.item}>
                        <Text style={styles.pointNumber}>{sub.key}. </Text>
                        <Text style={styles.pointText}>{sub.text}</Text>
                      </Text>
                      {sub.bullets && (
                        <View style={styles.bulletList}>
                          {sub.bullets.map((bullet, i) => (
                            <View key={i} style={styles.bulletItem}>
                              <Text style={styles.bulletDot}>{'\u2022'}</Text>
                              <Text style={styles.bulletText}>{bullet}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              );
            } else if (item.label && item.description) {
              // Items like 4.7 with only a description
              return (
                <View style={styles.itemContainer}>
                  <Text style={styles.subSectionHeading}>
                    {item.key}. {item.label}
                  </Text>
                  <Text style={styles.description}>{item.description}</Text>
                </View>
              );
            } else {
              // Regular items with key, label, and text
              return (
                <View style={styles.itemContainer}>
                  <Text style={styles.item}>
                    <Text style={styles.pointNumber}>{item.key}. </Text>
                    <Text style={styles.pointLabel}>{item.label}</Text>
                    <Text style={styles.pointText}> {item.text}</Text>
                  </Text>
                </View>
              );
            }
          }}
        />
        <GText
          SatoshiBold
          style={styles.addendumText}
          text="Addendum 1: Right of Withdrawal"
        />
        <GText
          SatoshiBold
          style={styles.withdrawalText}
          text="Right of Withdrawal"
        />
        <GText
          SatoshiRegular
          style={styles.rightOfWithdrawalPara}
          text={`You have the right to withdraw from this contract within 14 days without giving any reason.\n\nThe withdrawal period is 14 days from the day of the conclusion of the contract.\n\nIn order to exercise your right of withdrawal, you must inform us (DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7, 55127 Mainz, Germany, security@yosemitecrew.com) by means of a clear declaration (e.g. a letter sent by post or e-mail) of your decision to withdraw from this contract. For this purpose, you may use the enclosed sample withdrawal form, which, however, is not mandatory.\n\nIn order to comply with the withdrawal period, it is sufficient that you send the notification of the exercise of the right of withdrawal before the expiry of the withdrawal period.\n\n`}
        />
        <GText
          SatoshiBold
          style={styles.withdrawalText}
          text="Consequences of the Withdrawal"
        />
        <GText
          SatoshiRegular
          style={styles.rightOfWithdrawalPara}
          text={`If you withdraw this contract, we shall reimburse you all payments we have received from you, including delivery costs (with the exception of additional costs resulting from the fact that you have chosen a type of delivery other than the most favorable standard delivery offered by us), without undue delay and no later than within fourteen days from the day on which we received the notification of your revocation of this contract. For this repayment, we will use the same means of payment that you used for the original transaction, unless expressly agreed otherwise with you; in no case will you be charged any fees because of this repayment.\n\nIf you have requested that the services begin before the end of the withdrawal period, you shall pay us a reasonable amount corresponding to the proportion of the services already provided up to the point in time at which you notify us of the exercise of the right of withdrawal with regard to this contract compared to the total scope of the services provided for in the contract.\n\n`}
        />
        <GText
          SatoshiBold
          style={styles.withdrawalText}
          text="Other Information "
        />
        <GText
          SatoshiRegular
          style={styles.rightOfWithdrawalPara}
          text={`Your right to revoke the contract exists independently of any warranty claims in the event of material defects. If there is a defect covered by warranty, you are entitled to demand supplementary performance, to withdraw from the contract or to reduce the purchase price within the framework of the statutory provisions`}
        />
        <GText
          SatoshiBold
          style={styles.withdrawalFormHeader}
          text="WITHDRAWAL FORM:"
        />
        <GText
          SatoshiRegular
          style={styles.withdrawalformSubHeader}
          text="Fill the form for Withdrawal"
        />
        <Input label="User Full Name" style={styles.input} />
        <Input label="Email Address" style={styles.input} />
        <Input label="User Address" style={styles.input} />
        <Input label="Signature" style={styles.desBox} />
        <View style={styles.checkButtonView}>
          <Image source={Images.uncheckButton} style={styles.uncheckButton} />
          <GText
            SatoshiRegular
            style={styles.checkButtonText}
            text={`I/We hereby withdraw the contract concluded \nby me/us (*) for the purchase of the following\ngoods (*)/the provision of the following service (*)`}
          />
        </View>
        <GButton title="Submit Form" />
        <Text style={styles.formSubmissionDetails}>
          Form will be submitted to{' '}
          <Text style={styles.address}>
            DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7, 55127
            Mainz, Germany, email address:
          </Text>
          security@yosemitecrew.com
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Terms;
