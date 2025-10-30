import type {LegalSection} from './legalContentTypes';
export type {
  LegalSection as TermsSection,
  LegalContentBlock,
  ParagraphBlock,
  OrderedListItem,
  OrderedListBlock,
  TextSegment,
} from './legalContentTypes';

import {seg, b, p, oli, ol} from './legalContentHelpers';
import {
  createContactSection,
  COMPANY_NAME,
  COMPANY_FULL_ADDRESS,
  SECURITY_EMAIL,
} from './sharedLegalSections';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    title: '1. Scope and Applicability',
    blocks: [
      p(
        b('1.1.'),
        seg(' '),
        seg(`${COMPANY_NAME}, ${COMPANY_FULL_ADDRESS} ("DuneXploration" or "we/us/our") provides a Mobile App for Pet Owners/Companion Owners that is accessible via app stores for supported mobile devices.`)
      ),
      p(
        b('1.2.'),
        seg(
          ' These Terms of Use (“Terms” or “Agreement”) guide the legal relationships between DuneXploration and the Pet Owners/Companion Owners.',
        ),
      ),
      p(
        b('1.3.'),
        seg(
          ' DuneXploration rejects any and all terms and conditions of Pet Owners/Companion Owners. Only these Terms apply to the respective contractual relationships with DuneXploration.',
        ),
      ),
      p(
        b('1.4.'),
        seg(
          ' In the event of a conflict between these Terms and an individual agreement between DuneXploration and a Pet Owner/Companion Owner, the individual agreement shall prevail, unless explicitly provided otherwise in these Terms.',
        ),
      ),
    ],
  },
  {
    id: 'definitions',
    title: '2. Definitions',
    blocks: [
      p(
        seg(
          'In addition to terms defined elsewhere in this Agreement, the following terms have the following meanings:',
        ),
      ),
      p(
        b('2.1.'),
        b(' Account '),
        seg(
          'means the personal Account provided to the Pet Owner/Companion Owner after the User’s registration.',
        ),
      ),
      p(
        b('2.2.'),
        b(' Pet Professionals/Pet Businesses '),
        seg(
          'means e.g. veterinarians, breeders, groomers or boarding services who can interact with Pet Owners/Companion Owners and offer their services in the Mobile App.',
        ),
      ),
      p(
        b('2.3.'),
        b(' Consumer '),
        seg(
          'means every natural person who enters into a legal transaction for the purposes that predominantly are outside his trade, business or profession (Sec. 13 BGB German Civil Law Code).',
        ),
      ),
      p(
        b('2.4.'),
        b(' Intellectual Property '),
        seg(
          'means all rights of intellectual property, such as copyrights, trademark rights, patents, model rights, trade name rights, database rights and neighbouring rights, as well as domain names and know-how and any related rights.',
        ),
      ),
      p(
        b('2.5.'),
        b(' Mobile App '),
        seg(
          'means the application that provides Pet Owners/Companion Owners access to services of Pet Professionals/Pet Businesses and certain functions such as booking appointments.',
        ),
      ),
      p(
        b('2.6.'),
        b(' Paid Services '),
        seg(
          'are services offered by Pet Professionals/Pet Businesses to Pet Owners/Companion Owners on the Mobile App against remuneration.',
        ),
      ),
      p(
        b('2.7.'),
        b(' Pet Owner/Companion Owner '),
        seg(
          'means a person using the Mobile App to manage their pets and book appointments or services at a Pet Professional.',
        ),
      ),
    ],
  },
  {
    id: 'conclusion',
    title: '3. Conclusion of the Agreement and Registering an Account',
    blocks: [
      p(
        b('3.1.'),
        seg(
          ' To use the Mobile App and its functions, the Pet Owner/Companion Owner must download the Mobile App to a device and register for an Account. The Mobile App is available to download from the most common app stores. Download and Registering is free of charge for the Pet Owner/Companion Owner.',
        ),
      ),
      p(
        b('3.2.'),
        seg(
          ' Registering is possible by using an email address or a log-in service, such as Google, Facebook or Apple. When the Pet Owner/Companion Owner uses a log-in service, separate terms of the provider of the log-in service might apply and personal data will be exchanged between DuneXploration and the log-in service.',
        ),
      ),
      p(
        b('3.3.'),
        seg(
          ' The Pet Owner/Companion Owner has to be at least 18 years old and in full legal capacity to open an Account.',
        ),
      ),
      p(
        b('3.4.'),
        seg(
          ' When registering, the Pet Owner/Companion Owner is required to provide certain basic information, including name, mobile number, email address, date of birth and address. The Pet Owner/Companion Owner is obliged to provide the data collected upon conclusion of the contract truthfully and completely. In the event of subsequent changes to the data collected, the Pet Owner/Companion Owner must update the relevant information in their Account without delay.',
        ),
      ),
      p(
        b('3.5.'),
        seg(
          ' By clicking on "Create Account", the Pet Owner/Companion Owner requests DuneXploration to create an Account. DuneXploration will send an email with a legally binding offer to open the Account and to confirm the Pet Owner/Companion Owner\'s email address. By clicking on the verification link provided in the email, the Pet Owner/Companion Owner accepts the offer, concludes the Agreement with DuneXploration and opens the Account.',
        ),
      ),
      p(
        b('3.6.'),
        seg(
          ' Upon first signing in to the Account, the Pet Owner/Companion Owner requests a one-time password by entering their registered email address and clicking on “Send OTP”. DuneXploration will then send an email containing a 4-digit login code. After verifying this code in the Mobile App, the Pet Owner/Companion Owner can choose a new personal password.',
        ),
      ),
      p(
        b('3.7.'),
        seg(
          ' The Pet Owner/Companion Owner shall keep all account information, in particular the chosen password confidential and shall not disclose it to third parties. Any misuse or suspected misuse must be reported to DuneXploration immediately.',
        ),
      ),
      p(
        b('3.8.'),
        seg(
          ' The Pet Owner/Companion Owner can access the latest version of these Terms at any time on the Mobile App. The Agreement is concluded in English and the Terms are exclusively available in English.',
        ),
      ),
    ],
  },
  {
    id: 'functions',
    title: '4. Functions of the Mobile App',
    blocks: [
      p(b('4.1.'), b(' General Features')),
      p(
        b('4.1.1.'),
        seg(
          ' The Mobile App provides various functions to support the daily care and health management of pets.',
        ),
      ),
      p(
        b('4.1.2.'),
        seg(' In the Mobile App, the Pet Owner/Companion Owner can (among other things)'),
      ),
      ol(
        oli('•', 'Create pet profiles,'),
        oli(
          '•',
          'Add details of their Pet Professionals/Pet Businesses (veterinarians, breeders, groomers or boarding services),',
        ),
        oli('•', 'Book appointments with the Pet Professionals/Pet Businesses,'),
        oli('•', 'Purchase services of the Pet Professionals/Pet Businesses,'),
        oli('•', 'Share pet duties with a partner,'),
        oli('•', 'Add and track expenses,'),
        oli('•', 'Add medical information about their pet, and'),
        oli('•', 'Access articles and blog posts on relevant matters.'),
      ),
      p(
        b('4.1.3.'),
        seg(
          ' All services rendered by the Pet Professionals/Pet Businesses (such as booking appointments, providing emergency services or diabetes assessments) rely on a separate contractual relationship with the Pet Professionals/Pet Businesses. DuneXploration is not part of this contractual relationship.',
        ),
      ),
      p(b('4.2.'), seg(' Contact Vet/ Practice')),
      p(
        b('4.2.1.'),
        seg(
          ' The Mobile App allows Pet Owners/Companion Owners to contact Pet Professionals/Pet Businesses by sending them an (emergency) message. Pet Owners/Companion Owners may select the pet, describe the issue and upload images or videos to support the inquiry.',
        ),
      ),
      p(
        b('4.2.2.'),
        seg(
          ' DuneXploration does not guarantee immediate response or the availability of any specific Pet Professionals/Pet Businesses.',
        ),
      ),
      p(b('4.3.'), seg(' Appointment Booking Service')),
      p(
        b('4.3.1.'),
        seg(
          ' The Pet Owner/Companion Owner can make an appointment with a registered Pet Professionals/Pet Businesses, provided that the selected time is shown as available. Each appointment is sent to the Pet Professionals/Pet Businesses in real time. The Pet Professionals/Pet Businesses might reschedule the appointment if necessary or delete it from their schedule in accordance with legal requirements. In this case, the Pet Owner/Companion Owner will be notified immediately (e.g., by email or push notification).',
        ),
      ),
      p(b('4.3.2.'), seg(' The Pet Owner/Companion Owner can also')),
      ol(
        oli('(i)', ' manage the appointments (cancel, reschedule),'),
        oli(
          '(ii)',
          ' share concerns or documents to prepare for an appointment,',
        ),
        oli('(iii)', ' view the history of their appointments,'),
        oli('(iv)', ' view prescribed treatments or medications,'),
        oli(
          '(v)',
          ' communicate with the Pet Professionals/Pet Businesses after the appointment via an in-app chat, and',
        ),
        oli('(vi)', ' share feedback.'),
      ),
      p(
        b('4.3.3.'),
        seg(
          ' The Pet Owner/Companion Owner undertakes to provide all necessary information requested for the booking and performance of the selected service.',
        ),
      ),
      p(
        b('4.3.4.'),
        seg(
          " It is the Pet Owner/Companion Owner's responsibility to carry out all the checks they deem necessary or appropriate before making an appointment with a Pet Professionals/Pet Businesses.",
        ),
      ),
      p(
        b('4.3.5.'),
        seg(
          ' Pet Professionals/Pet Businesses practice their profession independently and in accordance with professional and other legal regulations. DuneXploration only provides the technical platform and will not be part of any contractual relationship between Pet Professionals/Pet Businesses and Pet Owners/Companion Owners. Hence DuneXploration cannot be held responsible in any way for the cancellation or unavailability of the Pet Professionals/Pet Businesses after the Pet Owner/Companion Owner has made an appointment via the online appointment booking service.',
        ),
      ),
      p(
        b('4.3.6.'),
        seg(
          ' Making an appointment via the Mobile App constitutes a binding commitment between the Pet Owner/Companion Owner and the Pet Professionals/Pet Businesses. The Pet Owner/Companion Owner must inform the Pet Professionals/Pet Businesses in advance of any failure to attend an agreed appointment. This information can be provided either via the cancellation options offered by the Mobile App or by any other means of contacting the Pet Professionals/Pet Businesses. Failure to show up may result in fees by the Pet Professionals/Pet Businesses or other consequences over which DuneXploration has no control.',
        ),
      ),
      p(b('4.4.'), seg(' Medical Records')),
      p(
        b('4.4.1.'),
        seg(
          ' The Mobile App allows Pet Owners/Companion Owners to (i) upload and manage medical records (e.g. invoices, insurance slips, lab results) and (ii) receive documents from Pet Professionals/Pet Businesses (e.g. prescriptions).',
        ),
      ),
      p(
        b('4.4.2.'),
        seg(
          " The Pet Owner/Companion Owner remains the sole owner of all documents they upload to the service or that are send to them by the Pet Professionals/Pet Businesses. They may add, view, rename, download, and delete these documents at any time. A document deleted by the Pet Owner/Companion Owner is permanently deleted, both from the Pet Owner/Companion Owner's account and from the Pet Professionals/Pet Businesses’ account on the platform. The Pet Professionals/Pet Businesses may have the right or be legally obliged to retain copies of documents for their own documentation. For more information the Pet Owner/Companion Owner has to contact the Pet Professionals/Pet Businesses directly.",
        ),
      ),
      p(
        b('4.4.3.'),
        seg(
          ' Yosemite Crew is not a backup service and DuneXploration cannot be held liable for loss or deletion of uploaded or created documents. Pet Owners/Companion Owners shall keep separate backups of important documents outside the Mobile App.',
        ),
      ),
      p(
        b('4.4.4.'),
        seg(
          ' It lies in the Pet Owners/Companion Owners sole discretion to ensure that they have all necessary rights to share the uploaded documents and that the documents do not infringe rights of any third party in any way.',
        ),
      ),
      p(
        b('4.4.5.'),
        seg(
          ' DuneXploration is not responsible for the content or accuracy of the documents that Pet Professionals/Pet Businesses share with the Pet Owner/Companion Owner.',
        ),
      ),
      p(b('4.5.'), seg(' Exercise Plan')),
      p(
        b('4.5.1.'),
        seg(
          ' Pet Owners/Companion Owners can create exercise plans for their pets by answering a few questions. Based on the answers provided by the Pet Owner/Companion Owner, DuneXploration will generate a recommendation of exercises that might help and support their pet.',
        ),
      ),
      p(
        b('4.5.2.'),
        seg(
          ' The Pet Owner/Companion Owner must be aware that the exercise plan cannot replace a veterinary professional’s opinion and guidance. Hence, DuneXploration will not guarantee the plan’s effectiveness or that the exercises are suitable for the individual pet. It lies in the Pet Owner/Companion Owner’s sole discretion to ensure that the exercises are not harmful to their pet. Especially if the pet has a specific medical condition, the Pet Owner/Companion Owner should consult a veterinary professional before performing any exercises.',
        ),
      ),
      p(b('4.6.'), seg(' Pain Journal')),
      p(
        b('4.6.1.'),
        seg(
          ' The Mobile App enables Pet Owners/Companion Owners to monitor their pet’s pain level by rating various indicators or using a visual pain scale. Based on the scores, the App calculates a pain score that can be (i) sent to the veterinarian, (ii) saved to the Pain Journal or (iii) be used to create an appointment.',
        ),
      ),
      p(
        b('4.6.2.'),
        seg(
          ' The assessments provided are based on the Pet Owner/Companion Owner’s input and are intended for informational purposes only. DuneXploration cannot guarantee the correctness or validity of the pain score.',
        ),
      ),
      p(
        b('4.7.'),
        seg(
          ' Parasiticide Management — Pet Owners/Companion Owners may assess their pet’s flea and tick risk using the Mobile App. Based on the input provided by the Pet Owner/Companion Owner, an assessment report is generated, which can be shared with a veterinarian.',
        ),
      ),
      p(
        b('4.8.'),
        seg(
          ' Diabetes Management — Pet Owners/Companion Owners can document relevant diabetes monitoring parameters and arrange an evaluation with selected veterinarians for an additional fee (Paid Service).',
        ),
      ),
      p(
        b('4.9.'),
        seg(
          ' Changes to the functions offered — DuneXploration reserves the right to add, remove or modify functions from the Mobile App in the future. It will notify Pet Owners/Companion Owners of changes.',
        ),
      ),
    ],
  },
 {
    id: 'paid-services',
    title: '5. Paid Services',
    blocks: [
      p(
        seg(
          'Pet Owners/Companion Owners may book Paid Services via the Mobile App with Pet Professionals/Pet Businesses. The respective contract is concluded between the Pet Owner/Companion Owner and the selected Pet Professionals/Pet Businesses. DuneXploration merely facilitates the conclusion of the agreement on behalf of the Pet Professionals/Pet Businesses and is not a party to this contractual relationship.',
        ),
      ),
      p(b('5.1.'), seg(' Booking of a Paid Service.')),
      p(
        b('5.1.1.'),
        seg(
          ' The presentation of the Paid Service in the Mobile App does not constitute a legally binding offer by the Pet Professionals/Pet Businesses. Only by selecting the desired Paid Service, the payment method and by clicking “Pay now”, the Pet Owner/Companion Owner submits a legally binding offer to conclude a contract with the selected Pet Professionals/Pet Businesses. The Pet Owner/Companion Owner will then immediately receive confirmation or rejection of the offer. If the offer is confirmed and thereby accepted, the contract is concluded.',
        ),
      ),
      p(
        b('5.1.2.'),
        seg(
          ' The Paid Service might be subject to separate terms of the Pet Professionals/Pet Businesses.',
        ),
      ),
      p(
        b('5.1.3.'),
        seg(
          ' Legally the Paid Services are classified as service offerings under German law and therefore no statutory warranty applies. If in exceptional cases the underlying contract can be classified as a contract for work services and the Pet Professionals/Pet Businesses resides in Germany, the Pet Owner/Companion Owner might have warranty rights according to Sec. 634 German Civil Law Code.',
        ),
      ),
    ],
  },
  {
    id: 'fees',
    title: '6. Fees',
    blocks: [
      p(b('6.1.'), seg(' Sign-up and Using the Mobile App is free of charge.')),
      p(
        b('6.2.'),
        seg(
          ' Where Paid Services are offered the Pet Owner/Companion Owner will be informed in advance of any costs. All prices include applicable VAT and are displayed transparently before the offer is submitted.',
        ),
      ),
      p(
        b('6.3.'),
        seg(
          ' The Pet Owner/Companion Owner will be informed about the available payment options and can select a payment method before making a booking.',
        ),
      ),
      p(
        b('6.4.'),
        seg(
          ' The payment is generally due immediately after the conclusion of contract. If the payment is not facilitated immediately, the Pet Owner/Companion Owner has to make the payment within the period specified on the invoice or fee notice. The payment process may be subject to separate terms depending on the chosen payment option.',
        ),
      ),
      p(
        b('6.5.'),
        seg(
          ' Prices may be adjusted at any time, effective for the future. Existing contracts are not affected.',
        ),
      ),
    ],
  },
  {
    id: 'withdrawal-policy',
    title: '7. Right of Withdrawal Policy',
    blocks: [
      p(
        seg(
          'If the Pet Owner/Companion Owner acts as Consumer, the Pet Owner/Companion Owner has a fourteen-day right of withdrawal. Regarding this right of withdrawal, please refer to the ',
        ),
        b('Addendum 1'),
        seg('.'),
      ),
    ],
  },
  {
    id: 'reviews-moderation',
    title: '8. Reviews and Moderation',
    blocks: [
      p(
        seg(
          'After a Pet Owner/Companion Owner has used the services of a Pet Professionals/Pet Businesses the Pet Owner/Companion Owner can rate the Pet Professionals/Pet Businesses on a scale from zero to five stars and also write a review of the Pet Professionals/Pet Businesses. The following rules apply to these reviews:',
        ),
      ),
      p(b('8.1.'), b(' Illegal Content:')),
      p(
        b('8.1.1.'),
        seg(
          ' Pet Owners/Companion Owners may only submit truthful ratings and reviews that reflect their own experience. The reviews must be written in appropriate and respectful language. Illegal content is therefore prohibited, including anything that violates laws, other legal provisions, these Terms, or the rights of natural or legal persons.',
        ),
      ),
      p(
        b('8.1.2.'),
        seg(
          ' Specifically the following violations are therefore prohibited: insults, hate speech, defamation and slander, and other false statements, violations of the right to privacy and intimacy, threats, and, of course, violations of copyright or other property.',
        ),
      ),
      p(
        b('8.1.3.'),
        seg(' Advertising content for third-party products and services is also prohibited.'),
      ),
      p(b('8.2.'), b(' Usage Rights')),
      p(
        b('8.2.1.'),
        seg(
          ' When Pet Owners/Companion Owners post reviews, they grant DuneXploration a transferable, simple, perpetual and unrestricted right of use to the content to the extent necessary for the operation of the service. In particular, Pet Owners/Companion Owners grant DuneXploration the right to make the review technically available and to make the necessary copies for this purpose (storage on servers, etc.)',
        ),
      ),
      p(
        b('8.2.2.'),
        seg(
          ' In addition, the Pet Owner/Companion Owner grants DuneXploration the right to make the content publicly accessible, to transmit it, and to reproduce it in other ways within the scope of DuneXploration’s function as the operator of the platform. The granting of rights is irrevocable and does not end with the termination of the agreement with the Pet Owner/Companion Owner. Reviews will therefore remain accessible on the platform even if the Pet Owner/Companion Owner terminates their account.',
        ),
      ),
      p(b('8.3.'), b(' Verification, Checks and Moderation of Reviews')),
      p(
        b('8.3.1.'),
        seg(
          ' DuneXploration does not verify, check or moderate reviews. However, it reserves the right to conduct such checks, particularly in cases of suspected violations.',
        ),
      ),
      p(
        b('8.3.2.'),
        seg(
          ' DuneXploration does not use any automatic systems, filters, or similar tools automatically scan, edit, block, remove, or take other measures regarding reviews.',
        ),
      ),
      p(
        b('8.3.3.'),
        seg(
          ' DuneXploration provides a reporting form that can be used to report inappropriate content.',
        ),
      ),
      p(b('8.4.'), b(' Consequences of Violations')),
      p(
        b('8.4.1.'),
        seg(
          ' DuneXploration shall edit or delete reviews that violate provisions from this section at its own discretion.',
        ),
      ),
      p(
        b('8.4.2.'),
        seg(
          ' In the event of a serious violation or repeated minor violations, DuneXploration may also delete the Account and/or issue a ban and permanently block users.',
        ),
      ),
      p(
        b('8.4.3.'),
        seg(
          ' DuneXploration will inform all persons affected by the measures with a justification for the decision.',
        ),
      ),
      p(
        b('8.4.4.'),
        seg(
          ' DuneXploration will always act carefully, objectively, and proportionately when checking reviews and implementing measures, thereby taking into account the rights and legitimate interests of all parties involved.',
        ),
      ),
      p(b('8.5.'), b(' Possibilities to Complaint')),
      p(
        b('8.5.1.'),
        seg(
          ' If a Pet Owner/Companion Owner has the opinion that reviews violate either these Terms or applicable laws, they can use the reporting mechanisms provided in the Mobile App. DuneXploration will then review the information in question and either block it or inform the Pet Owner/Companion Owner that no action is being taken and explain why.',
        ),
      ),
      p(
        b('8.5.2.'),
        seg(
          ' This section is without prejudice to the rights of EU Pet Owners/Companion Owners to take their case to certified out-of-court complaint bodies.',
        ),
      ),
      p(
        b('8.6.'),
        b(' Reporting of Criminal Offenses'),
        seg(
          ' DuneXploration is legally obliged to inform law enforcement authorities if it becomes aware of any information included in a review that gives rise to a suspicion that a criminal offense has been committed, is being committed, or may be committed that poses a threat to the life or safety of a person or persons.',
        ),
      ),
      p(b('8.7.'), b(' Liability and Indemnification for reviews')),
      p(
        b('8.7.1.'),
        seg(' Pet Owners/Companion Owners are liable for the reviews they publish.'),
      ),
      p(
        b('8.7.2.'),
        seg(
          ' Pet Owners/Companion Owners undertake to indemnify and hold DuneXploration harmless from any liability and costs, including potential and actual costs of legal proceedings, should DuneXploration be held liable by third parties because the respective Pet Owner/Companion Owner has culpably violated the Terms of Use, laws, or the rights of third parties, or has otherwise acted unlawfully.',
        ),
      ),
    ],
  },
  {
    id: 'owner-obligations',
    title: '9. Pet Owner/Companion Owner Obligations',
    blocks: [
      p(
        b('9.1.'),
        seg(
          ' The Pet Owner/Companion Owner is obliged to refrain from any actions that go beyond the intended use of the Mobile App. In particular, the Pet Owner/Companion Owner is obliged to refrain from using the Mobile App in any way that could jeopardize the secure operation of the systems of DuneXploration or third parties.',
        ),
      ),
      p(
        b('9.2.'),
        seg(
          ' The content available on the Mobile App can be protected by Intellectual Property Rights or other protective rights. The compilation of the content as such may also be protected as a database or database work within the meaning of Sections 4 (2) and 87a (1) of the German Copyright Act (UrhG). Pet Owners/Companion Owners may only use this content in accordance with the Agreement. No rights beyond this use are granted.',
        ),
      ),
    ],
  },
  {
    id: 'term-termination',
    title: '10. Term and Termination',
    blocks: [
      p(
        b('10.1.'),
        seg(
          ' The terms of this Agreement commence upon the Pet Owner/Companion Owner’s registration.',
        ),
      ),
      p(
        b('10.2.'),
        seg(
          ' The Pet Owner/Companion Owner can delete their Account via the settings menu on the Mobile App.',
        ),
      ),
      p(
        b('10.3.'),
        seg(
          ' In the event of a violation of the provisions of the contract by the Pet Owner/Companion Owner, DuneXploration may take appropriate measures to prevent such breaches. If the Pet Owner/Companion Owner violates contractual obligations despite a warning from DuneXploration and if DuneXploration cannot reasonably be expected to continue the contractual relationship, taking into account all circumstances of the individual case and weighing the interests of both parties, DuneXploration has the right to terminate the Agreement without notice for good cause.',
        ),
      ),
    ],
  },
  {
    id: 'data-protection',
    title: '11. Data Protection',
    blocks: [
      p(
        b('11.1.'),
        seg(
          ' DuneXploration collects, processes, and uses the Pet Owner/Companion Owner\'s personal data. Information on data processing and data protection can be found in the Privacy Policy.',
        ),
      ),
      p(
        b('11.2.'),
        seg(
          ' For some processing of personal data (such as the processing for the fulfilment of the treatment contract, DuneXploration acts as the Data Processor for the Pet Professionals/Pet Businesses who acts as the Controller. Please refer to the Pet Professionals/Pet Businesses’s privacy policy for more information.',
        ),
      ),
    ],
  },

  createContactSection('16. If you have any comments or questions', 'contact-questions'),
  {
    id: 'availability',
    title: '12. Availability and Maintenance',
    blocks: [
      p(
        b('12.1.'),
        seg(
          ' DuneXploration shall implement appropriate measures to ensure the availability and error free functionality of the Mobile App. However, the Pet Owner/Companion Owner acknowledges that for technical reasons and due to the dependence on external influences, DuneXploration cannot guarantee the uninterrupted availability of the Platform.',
        ),
      ),
      p(
        b('12.2.'),
        seg(
          ' DuneXploration will occasionally carry out maintenance work to ensure the functionality or expansion of the Mobile App. These tasks may result in a temporary impairment of the usability of the Mobile App.',
        ),
      ),
    ],
  },
  {
    id: 'liability',
    title: '13. Liability and Indemnification',
    blocks: [
      p(
        b('13.1.'),
        seg(' DuneXploration shall be liable in accordance with the statutory provisions.'),
      ),
      p(
        b('13.2.'),
        seg(
          ' The Pet Owner/Companion Owner is responsible for ensuring the routine backup of their data, in particular the content uploaded onto the Mobile App. If the Pet Owner/Companion Owner suffers damages that result from the loss of data, DuneXploration shall in each case only be liable for such damages that could not have been avoided by carrying out data backups of all relevant data in regular intervals.',
        ),
      ),
      p(
        b('13.3.'),
        seg(
          ' The Pet Owner/Companion Owner agrees to indemnify, defend and hold DuneXploration, its officers, directors, agents, affiliates, distribution partners, licensors and suppliers harmless from and against any and all claims, actions, proceedings, costs, liabilities, losses and expenses (including, but not limited to, reasonable attorneys’ fees) (collectively, “Claims”) suffered or incurred by such indemnified parties resulting from or arising out of any actual or alleged breach of the Pet Owner/Companion Owner’s obligations, warranties and guarantees under these Terms or violation of any third party’s rights, provided that the breach or violation in question was or would have been a culpable breach or violation. DuneXploration shall inform the Pet Owner/Companion Owner without delay of any such Claim, and will provide the Pet Owner/Companion Owner with any reasonably available information on the Claim to facilitate the Pet Owner/Companion Owner’s cooperation in defending against the Claim. The Pet Owner/Companion Owner shall cooperate as fully as reasonably required in the defense of any Claim. DuneXploration reserves the right, at its own expense, to assume the exclusive defense and control of any matter subject to indemnification by the Pet Owner/Companion Owner.',
        ),
      ),
    ],
  },
  {
    id: 'changes-to-terms',
    title: '14. Changes to the Terms',
    blocks: [
      p(
        b('14.1.'),
        seg(
          ' DuneXploration has the right to introduce additional functions to the Mobile App and add corresponding rules to the Terms. DuneXploration shall announce these changes at least four weeks before they enter into force to the Pet Owner/Companion Owner by email. If the Pet Owner/Companion Owner does not object in text form (e.g. letter, fax, e-mail) within a period of two weeks, beginning with the day following the announcement of the changes, DuneXploration assumes that the Pet Owner/Companion Owner agrees to the changes.',
        ),
      ),
      p(
        b('14.2.'),
        seg(
          ' DuneXploration shall inform the Pet Owner/Companion Owner in the notice of his right to object, its requirements and consequences. If the Pet Owner/Companion Owner objects to the changes, the contractual relationship shall be continued under the most recent version of the Terms before the change. In such case, DuneXploration reserves the right to terminate the contractual relationship with effect to the next possible date.',
        ),
      ),
      p(
        b('14.3.'),
        seg(
          ' Otherwise, a change of the terms of use is possible at any time with the consent of the user.',
        ),
      ),
    ],
  },
  {
    id: 'miscellaneous',
    title: '15. Miscellaneous',
    blocks: [
      p(
        b('15.1.'),
        seg(
          ' This Agreement is governed by, and shall be interpreted in accordance with the laws of the Federal Republic of Germany, excluding the provisions of the United Nations Convention on Contracts for the International Sale of Goods and any conflict of law provisions that would require the application of the material law of another country.',
        ),
      ),
      p(
        b('15.2.'),
        seg(
          ' The Parties herby irrevocably submit to the exclusive jurisdiction of the courts of Mainz, Germany, for all disputes or claims arising out of or in connection with this Agreement made hereunder.',
        ),
      ),
      p(
        b('15.3.'),
        seg(
          ' If any provision of this Agreement is invalid or unenforceable in whole or in part, this shall not affect the validity and enforceability of any other provision of this Agreement. The invalid or unenforceable provision shall be deemed replaced by a valid and enforceable provision that comes as close as possible to the economic purpose that both parties had in mind with the invalid or unenforceable provision.',
        ),
      ),
    ],
  },
  {
    id: 'addendum', // This is the old Addendum 1, now Section 16
    title: 'Addendum 1: Right of Withdrawal',
    blocks: [
      p(b('Right of Withdrawal')),
      p(
        seg(
          'You have the right to withdraw from this contract within 14 days without giving any reason.',
        ),
      ),
      p(
        seg(
          'The withdrawal period is 14 days from the day of the conclusion of the contract.',
        ),
      ),
      p(
        seg(
          `In order to exercise your right of withdrawal, you must inform us (${COMPANY_NAME}, ${COMPANY_FULL_ADDRESS}, ${SECURITY_EMAIL}) by means of a clear declaration (e.g. a letter sent by post or e-mail) of your decision to withdraw from this contract. For this purpose, you may use the enclosed sample withdrawal form, which, however, is not mandatory.`
        ),
      ),
      p(
        seg(
          'In order to comply with the withdrawal period, it is sufficient that you send the notification of the exercise of the right of withdrawal before the expiry of the withdrawal period.',
        ),
      ),
      p(b('Consequences of the Withdrawal')),
      p(
        seg(
          'If you withdraw this contract, we shall reimburse you all payments we have received from you, including delivery costs (with the exception of additional costs resulting from the fact that you have chosen a type of delivery other than the most favorable standard delivery offered by us), without undue delay and no later than within fourteen days from the day on which we received the notification of your revocation of this contract. For this repayment, we will use the same means of payment that you used for the original transaction, unless expressly agreed otherwise with you; in no case will you be charged any fees because of this repayment.',
        ),
      ),
      p(
        seg(
          'If you have requested that the services begin before the end of the withdrawal period, you shall pay us a reasonable amount corresponding to the proportion of the services already provided up to the point in time at which you notify us of the exercise of the right of withdrawal with regard to this contract compared to the total scope of the services provided for in the contract.',
        ),
      ),
      p(b('Other Information')),
      p(
        seg(
          'Your right to revoke the contract exists independently of any warranty claims in the event of material defects. If there is a defect covered by warranty, you are entitled to demand supplementary performance, to withdraw from the contract or to reduce the purchase price within the framework of the statutory provisions.',
        ),
      ),
    ],
  },
];
