import type {LegalSection} from './legalContentTypes';
export type {
  LegalSection as TermsSection,
  LegalContentBlock,
  ParagraphBlock,
  OrderedListItem,
  OrderedListBlock,
  TextSegment,
} from './legalContentTypes';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    title: '1. Scope and Applicability',
    blocks: [
      {
        type: 'paragraph',
        segments: [
          {text: '1.1.', bold: true},
          {
            text: ' DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7, 55127 Mainz, Germany (“DuneXploration” or “we/us/our”) provides a Mobile App for Pet Owners that is accessible via app stores for supported mobile devices.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '1.2.', bold: true},
          {
            text: ' These Terms of Use (“Terms” or “Agreement”) guide the legal relationships between DuneXploration and the Pet Owners.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '1.3.', bold: true},
          {
            text: ' DuneXploration rejects any and all terms and conditions of Pet Owners. Only these Terms apply to the respective contractual relationships with DuneXploration.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '1.4.', bold: true},
          {
            text: ' In the event of a conflict between these Terms and an individual agreement between DuneXploration and a Pet Owner, the individual agreement shall prevail, unless explicitly provided otherwise in these Terms.',
          },
        ],
      },
    ],
  },
  {
    id: 'definitions',
    title: '2. Definitions',
    blocks: [
      {
        type: 'paragraph',
        segments: [
          {
            text: 'In addition to terms defined elsewhere in this Agreement, the following terms have the following meanings:',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '2.1.', bold: true},
          {text: ' Account '},
          {
            text: 'means the personal Account provided to the Pet Owner after the User’s registration.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '2.2.', bold: true},
          {text: ' Pet Professionals '},
          {
            text: 'means e.g. veterinarians, breeders, groomers or boarding services who can interact with Pet Owners and offer their services in the Mobile App.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '2.3.', bold: true},
          {text: ' Consumer '},
          {
            text: 'means every natural person who enters into a legal transaction for the purposes that predominantly are outside his trade, business or profession (Sec. 13 BGB German Civil Law Code).',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '2.4.', bold: true},
          {text: ' Intellectual Property '},
          {
            text: 'means all rights of intellectual property, such as copyrights, trademark rights, patents, model rights, trade name rights, database rights and neighbouring rights, as well as domain names and know-how and any related rights.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '2.5.', bold: true},
          {text: ' Mobile App '},
          {
            text: 'means the application that provides Pet Owners access to services of Pet Professionals and certain functions such as booking appointments.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '2.6.', bold: true},
          {text: ' Paid Services '},
          {
            text: 'are services offered by Pet Professionals to Pet Owners on the Mobile App against remuneration.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '2.7.', bold: true},
          {text: ' Pet Owner '},
          {
            text: 'means a person using the Mobile App to manage their pets and book appointments or services at a Pet Professional.',
          },
        ],
      },
    ],
  },
  {
    id: 'conclusion',
    title: '3. Conclusion of the Agreement and Registering an Account',
    blocks: [
      {
        type: 'paragraph',
        segments: [
          {text: '3.1.', bold: true},
          {
            text: ' To use the Mobile App and its functions, the Pet Owner must download the Mobile App to a device and register for an Account. The Mobile App is available to download from the most common app stores. Download and Registering is free of charge for the Pet Owner.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '3.2.', bold: true},
          {
            text: ' Registering is possible by using an email address or a log-in service, such as Google, Facebook or Apple. When the Pet Owner uses a log-in service, separate terms of the provider of the log-in service might apply and personal data will be exchanged between DuneXploration and the log-in service.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '3.3.', bold: true},
          {
            text: ' The Pet Owner has to be at least 18 years old and in full legal capacity to open an Account.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '3.4.', bold: true},
          {
            text: ' When registering, the Pet Owner is required to provide certain basic information, including name, mobile number, email address, date of birth and address. The Pet Owner is obliged to provide the data collected upon conclusion of the contract truthfully and completely. In the event of subsequent changes to the data collected, the Pet Owner must update the relevant information in their Account without delay.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '3.5.', bold: true},
          {
            text: ' By clicking on "Create Account", the Pet Owner requests DuneXploration to create an Account. DuneXploration will send an email with a legally binding offer to open the Account and to confirm the Pet Owner\'s email address. By clicking on the verification link provided in the email, the Pet Owner accepts the offer, concludes the Agreement with DuneXploration and opens the Account.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '3.6.', bold: true},
          {
            text: ' Upon first signing in to the Account, the Pet Owner requests a one-time password by entering their registered email address and clicking on “Send OTP”. DuneXploration will then send an email containing a 4-digit login code. After verifying this code in the Mobile App, the Pet Owner can choose a new personal password.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '3.7.', bold: true},
          {
            text: ' The Pet Owner shall keep all account information, in particular the chosen password confidential and shall not disclose it to third parties. Any misuse or suspected misuse must be reported to DuneXploration immediately.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '3.8.', bold: true},
          {
            text: ' The Pet Owner can access the latest version of these Terms at any time on the Mobile App. The Agreement is concluded in English and the Terms are exclusively available in English.',
          },
        ],
      },
    ],
  },
  {
    id: 'functions',
    title: '4. Functions of the Mobile App',
    blocks: [
      {
        type: 'paragraph',
        segments: [
          {text: '4.1.', bold: true},
          {text: ' General Features'},
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.1.1.', bold: true},
          {
            text: ' The Mobile App provides various functions to support the daily care and health management of pets.',
          },
        ],
      },
      {
        type: 'ordered-list',
        items: [
          {
            marker: '•',
            markerBold: true,
            segments: [
              {
                text: 'Create pet profiles,',
              },
            ],
          },
          {
            marker: '•',
            markerBold: true,
            segments: [
              {
                text: 'Add details of their Pet Professional (veterinarians, breeders, groomers or boarding services),',
              },
            ],
          },
          {
            marker: '•',
            markerBold: true,
            segments: [
              {text: 'Book appointments with the Pet Professionals,'},
            ],
          },
          {
            marker: '•',
            markerBold: true,
            segments: [
              {text: 'Purchase services of the Pet Professionals,'},
            ],
          },
          {
            marker: '•',
            markerBold: true,
            segments: [
              {text: 'Share pet duties with a partner,'},
            ],
          },
          {
            marker: '•',
            markerBold: true,
            segments: [
              {text: 'Add and track expenses,'},
            ],
          },
          {
            marker: '•',
            markerBold: true,
            segments: [
              {text: 'Add medical information about their pet, and'},
            ],
          },
          {
            marker: '•',
            markerBold: true,
            segments: [
              {text: 'Access articles and blog posts on relevant matters.'},
            ],
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: '4.1.3.',
            bold: true,
          },
          {
            text: ' All services rendered by the Pet Professionals (such as booking appointments, providing emergency services or diabetes assessments) rely on a separate contractual relationship with the Pet Professional. DuneXploration is not part of this contractual relationship.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.2.', bold: true},
          {text: ' Contact Vet/ Practice'},
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.2.1.', bold: true},
          {
            text: ' The Mobile App allows Pet Owners to contact Pet Professionals by sending them an (emergency) message. Pet Owners may select the pet, describe the issue and upload images or videos to support the inquiry.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.2.2.', bold: true},
          {
            text: ' DuneXploration does not guarantee immediate response or the availability of any specific Pet Professional.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.3.', bold: true},
          {text: ' Appointment Booking Service'},
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.3.1.', bold: true},
          {
            text: ' The Pet Owner can make an appointment with a registered Pet Professional, provided that the selected time is shown as available. Each appointment is sent to the Pet Professional in real time. The Pet Professional might reschedule the appointment if necessary or delete it from their schedule in accordance with legal requirements. In this case, the Pet Owner will be notified immediately (e.g., by email or push notification).',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: '4.3.2.',
            bold: true,
          },
          {
            text: ' The Pet Owner can also',
          },
        ],
      },
      {
        type: 'ordered-list',
        items: [
          {
            marker: '(i)',
            markerBold: true,
            segments: [
              {
                text: ' manage the appointments (cancel, reschedule),',
              },
            ],
          },
          {
            marker: '(ii)',
            markerBold: true,
            segments: [{text: ' share concerns or documents to prepare for an appointment,'}],
          },
          {
            marker: '(iii)',
            markerBold: true,
            segments: [{text: ' view the history of their appointments,'}],
          },
          {
            marker: '(iv)',
            markerBold: true,
            segments: [{text: ' view prescribed treatments or medications,'}],
          },
          {
            marker: '(v)',
            markerBold: true,
            segments: [
              {
                text: ' communicate with the Pet Professional after the appointment via an in-app chat, and',
              },
            ],
          },
          {
            marker: '(vi)',
            markerBold: true,
            segments: [{text: ' share feedback.'}],
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.3.3.', bold: true},
          {
            text: ' The Pet Owner undertakes to provide all necessary information requested for the booking and performance of the selected service.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.3.4.', bold: true},
          {
            text: " It is the Pet Owner's responsibility to carry out all the checks they deem necessary or appropriate before making an appointment with a Pet Professional.",
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.3.5.', bold: true},
          {
            text: ' Pet Professionals practice their profession independently and in accordance with professional and other legal regulations. DuneXploration only provides the technical platform and will not be part of any contractual relationship between Pet Professionals and Pet Owners. Hence DuneXploration cannot be held responsible in any way for the cancellation or unavailability of the Pet Professionals after the Pet Owner has made an appointment via the online appointment booking service.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.3.6.', bold: true},
          {
            text: ' Making an appointment via the Mobile App constitutes a binding commitment between the Pet Owner and the Pet Professional. The Pet Owner must inform the Pet Professional in advance of any failure to attend an agreed appointment. This information can be provided either via the cancellation options offered by the Mobile App or by any other means of contacting the Pet Professional. Failure to show up may result in fees by the Pet Professional or other consequences over which DuneXploration has no control.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.4.', bold: true},
          {text: ' Medical Records'},
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.4.1.', bold: true},
          {
            text: ' The Mobile App allows Pet Owners to (i) upload and manage medical records (e.g. invoices, insurance slips, lab results) and (ii) receive documents from Pet Professionals (e.g. prescriptions).',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.4.2.', bold: true},
          {
            text: " The Pet Owner remains the sole owner of all documents they upload to the service or that are send to them by the Pet Professionals. They may add, view, rename, download, and delete these documents at any time. A document deleted by the Pet Owner is permanently deleted, both from the Pet Owner's account and from the Pet Professionals’ account on the platform. The Pet Professional may have the right or be legally obliged to retain copies of documents for their own documentation. For more information the Pet Owner has to contact the Pet Professional directly.",
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.4.3.', bold: true},
          {
            text: ' Yosemite Crew is not a backup service and DuneXploration cannot be held liable for loss or deletion of uploaded or created documents. Pet Owners shall keep separate backups of important documents outside the Mobile App.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.4.4.', bold: true},
          {
            text: ' It lies in the Pet Owners’ sole discretion to ensure that they have all necessary rights to share the uploaded documents and that the documents do not infringe rights of any third party in any way.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.4.5.', bold: true},
          {
            text: ' DuneXploration is not responsible for the content or accuracy of the documents that Pet Professionals share with the Pet Owner.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [{text: '4.5.', bold: true}, {text: ' Exercise Plan'}],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.5.1.', bold: true},
          {
            text: ' Pet Owners can create exercise plans for their pets by answering a few questions. Based on the answers provided by the Pet Owner, DuneXploration will generate a recommendation of exercises that might help and support their pet.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.5.2.', bold: true},
          {
            text: ' The Pet Owner must be aware that the exercise plan cannot replace a veterinary professional’s opinion and guidance. Hence, DuneXploration will not guarantee the plan’s effectiveness or that the exercises are suitable for the individual pet. It lies in the Pet Owner’s sole discretion to ensure that the exercises are not harmful to their pet. Especially if the pet has a specific medical condition, the Pet Owner should consult a veterinary professional before performing any exercises.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [{text: '4.6.', bold: true}, {text: ' Pain Journal'}],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.6.1.', bold: true},
          {
            text: ' The Mobile App enables Pet Owners to monitor their pet’s pain level by rating various indicators or using a visual pain scale. Based on the scores, the App calculates a pain score that can be (i) sent to the veterinarian, (ii) saved to the Pain Journal or (iii) be used to create an appointment.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.6.2.', bold: true},
          {
            text: ' The assessments provided are based on the Pet Owner’s input and are intended for informational purposes only. DuneXploration cannot guarantee the correctness or validity of the pain score.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.7.', bold: true},
          {
            text: ' Parasiticide Management — Pet Owners may assess their pet’s flea and tick risk using the Mobile App. Based on the input provided by the Pet Owner, an assessment report is generated, which can be shared with a veterinarian.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.8.', bold: true},
          {
            text: ' Diabetes Management — Pet Owners can document relevant diabetes monitoring parameters and arrange an evaluation with selected veterinarians for an additional fee (Paid Service).',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {text: '4.9.', bold: true},
          {
            text: ' Changes to the functions offered — DuneXploration reserves the right to add, remove or modify functions from the Mobile App in the future. It will notify Pet Owners of changes.',
          },
        ],
      },
    ],
  },
  {
    id: 'addendum',
    title: 'Addendum 1: Right of Withdrawal',
    blocks: [
      {
        type: 'paragraph',
        segments: [
          {
            text: 'Right of Withdrawal',
            underline: true,
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'You have the right to withdraw from this contract within 14 days without giving any reason.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'The withdrawal period is 14 days from the day of the conclusion of the contract.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'In order to exercise your right of withdrawal, you must inform us (DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7, 55127 Mainz, Germany, security@yosemitecrew.com) by means of a clear declaration (e.g. a letter sent by post or e-mail) of your decision to withdraw from this contract. For this purpose, you may use the enclosed sample withdrawal form, which, however, is not mandatory.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'In order to comply with the withdrawal period, it is sufficient that you send the notification of the exercise of the right of withdrawal before the expiry of the withdrawal period.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [{text: 'Consequences of the Withdrawal', bold: true}],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'If you withdraw this contract, we shall reimburse you all payments we have received from you, including delivery costs (with the exception of additional costs resulting from the fact that you have chosen a type of delivery other than the most favorable standard delivery offered by us), without undue delay and no later than within fourteen days from the day on which we received the notification of your revocation of this contract. For this repayment, we will use the same means of payment that you used for the original transaction, unless expressly agreed otherwise with you; in no case will you be charged any fees because of this repayment.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'If you have requested that the services begin before the end of the withdrawal period, you shall pay us a reasonable amount corresponding to the proportion of the services already provided up to the point in time at which you notify us of the exercise of the right of withdrawal with regard to this contract compared to the total scope of the services provided for in the contract.',
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [{text: 'Other Information', bold: true}],
      },
      {
        type: 'paragraph',
        segments: [
          {
            text: 'Your right to revoke the contract exists independently of any warranty claims in the event of material defects. If there is a defect covered by warranty, you are entitled to demand supplementary performance, to withdraw from the contract or to reduce the purchase price within the framework of the statutory provisions.',
          },
        ],
      },
    ],
  },
];
