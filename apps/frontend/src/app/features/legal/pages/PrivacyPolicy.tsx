'use client';

import Link from 'next/link';
import { LegalDoc, DocSection, type TocEntry } from '@/app/features/marketing/site';

const TOC: readonly TocEntry[] = [
  { id: 'trademark', label: 'Trademark notice' },
  { id: 'controller', label: '1. Controller and Data Protection Officer' },
  { id: 'roles', label: '2. Our role regarding your personal data' },
  { id: 'processing', label: '3. Processing activities in applications' },
  { id: 'social-media', label: '4. Presence on social media' },
  { id: 'recipients', label: '5. General information on recipients' },
  { id: 'storage', label: '6. General information on storage duration' },
  { id: 'automated', label: '7. Automated decision-making and obligation to provide data' },
  {
    id: 'rights',
    label: '8. What rights do you have with regard to the personal data you provide to us?',
  },
  { id: 'objection', label: '9. In particular, right to object and withdrawal of consent' },
  { id: 'obligation', label: '10. Obligation to provide data' },
  { id: 'contact', label: '11. If you have any comments or questions' },
  { id: 'analytics', label: 'Analytics (PostHog)' },
];

const PrivacyPolicy = () => (
  <LegalDoc
    eyebrow="Legal"
    title="Privacy policy"
    subtitle="The protection and security of your personal data matters to us. This describes how our open-source practice management software collects, processes and stores personal data, as a web app and a mobile app."
    meta="Updated March 2026 · Controller: DuneXploration UG (haftungsbeschränkt), Mainz"
    toc={TOC}
  >
    <p>
      The protection and security of your personal information is important to us. This privacy
      policy describes how we collect, process, and store personal data through our open-source
      practice management software (hereinafter referred to as &quot;PIMS&quot;, &quot;PMS&quot; or
      &quot;the Software&quot;). Our Software is available as a web application and as a mobile
      application. Unless stated otherwise, the information provided applies equally to both
      versions. This policy helps you to understand what information we collect, why we collect it,
      how we use it, and how long we store it.
    </p>

    <DocSection id="trademark" title="Trademark notice">
      <p>
        This repository may reference or include integrations, plugins, names, logos, or trademarks
        of third-party companies (including but not limited to IDEXX, MSD Veterinary Manual, and
        other partners). Such trademarks and logos are the property of their respective owners and
        are used solely for identification or interoperability purposes. Nothing in this repository
        grants any right or license to use any third-party trademarks, logos, or branding except as
        permitted by the respective owners.
      </p>
    </DocSection>

    <DocSection id="controller" title="1. Controller and Data Protection Officer">
      <p>
        The Controller is: <br /> DuneXploration UG (haftungsbeschränkt) <br /> Am Finther Weg 7{' '}
        <br /> 55127 Mainz <br />{' '}
        <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a>
      </p>
      <p>
        Our data protection officer can be contacted at: <br /> Email:{' '}
        <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a>
      </p>
    </DocSection>

    <DocSection id="roles" title="2. Our role regarding your personal data">
      <p>
        Under the General Data Protection Regulation (GDPR), the controller determines the purposes
        and means of processing personal data. A processor processes personal data on behalf of the
        controller and only in accordance with their instructions.
      </p>
      <p>
        Depending on the processing activity, DuneXploration may act as a controller or processor:
      </p>
      <ul>
        <li>
          DuneXploration is the controller when it determines how and why your data is processed,
          for example when you create a user account
        </li>
        <li>
          The <strong>pet service providers</strong> (e.g. veterinary clinics, breeders, groomers,
          hospitals) act as controllers when they manage their interactions with you (e.g.
          appointments, invoices, prescriptions) and DuneXploration acts as their processor.
        </li>
      </ul>
      <p>
        Regardless of whether DuneXploration is the controller or processor, DuneXploration takes
        appropriate measures to ensure the protection and confidentiality of the personal data that
        DuneXploration processes in accordance with the provisions of the GDPR and the legislation
        in Germany.
      </p>
    </DocSection>

    <DocSection id="processing" title="3. Processing activities in applications">
      <p>
        When you use our application, we process personal data. You are not legally required to
        provide this data, but without it, many features may not be available.
      </p>
      <p>
        The following sections explain what data we process, for what purposes, for how long, and on
        what legal basis. You will also learn to whom we pass on your data. At the end of the
        privacy policy, you will also find information about our storage periods, general
        recipients, and algorithmic decision-making.
      </p>
      <h3>3.1. Web Application</h3>
      <p> Our web application is offered to business owners and web developers </p>
      <h4>3.1.1. Server Provision and Hosting</h4>
      <p>
        <strong>Purpose:</strong> The web application can be self-hosted or hosted in the cloud. If
        you choose our cloud, we collect and temporarily store certain data to ensure the operation,
        availability, stability and security of the application.
      </p>
      <p>
        <strong>Categories of data: </strong> IP address, time and date of access, browser type and
        version, operating system.
      </p>
      <p>
        <strong>Legal basis: </strong> The legitimate interest in ensuring the technical
        functionality and security of our software (Art. 6 para. 1 lit. f) GDPR.
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com).
        </li>
        <li>Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.</li>
      </ul>
      <p>
        <strong>Storage period: </strong> Log data is deleted after 7 days.
      </p>
      <h4>3.1.2. Signing up and setting up a profile</h4>
      <p>
        <strong>Purpose:</strong> To register and onboard veterinary businesses, create accounts,
        and establish secure access for managing their practice&lsquo;s information and activities,
        thus allowing them to provide services through the platform.
      </p>
      <p>
        <strong>Categories of data: </strong> In particular, work email, business name, business
        type (veterinary business, breeding facility, pet sitter, groomer shop), registration
        number, address, specialised department, provided services, professional background
        (specialisation, qualification, medical license number), appointment duration (consultation
        mode, consultation fee, username)
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.</li>
        <li>Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.</li>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com).
        </li>
      </ul>
      <p>
        <strong>Legal basis: </strong> Establishment of the user relationship, Art. 6 para. 1 lit.
        b) GDPR. By providing voluntary profile information, you consent to the processing of this
        data, Art. 6 para. 1 lit. a) GDPR.
      </p>
      <p>
        <strong>Storage period: </strong> The data will generally be processed for as long as you
        maintain your account with us. After termination of the account, your data will be deleted
        unless the deletion of individual data or documents is prevented by statutory retention
        obligations.
      </p>
      <h4>3.1.3. General Use of the Application</h4>
      <p>
        <strong>Purpose:</strong> To allow businesses to use the application and all its core
        functions (such as creating appointments, adding prescriptions, generating bills, creating
        appointments), we process the information you enter, and data generated during use.
      </p>
      <p>
        <strong>Categories of data: </strong> In particular, name, e-mail address, phone number,
        doctor’s name, prescription notes, billing details, payment information.
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.</li>
        <li>Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.</li>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com).
        </li>
      </ul>
      <p>
        <strong>Legal basis: </strong> The processing is necessary for the performance of the user
        contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in
        pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).
      </p>
      <p>
        <strong>Storage period: </strong> We store the data as long as the user account is active.
        Data may be deleted upon account deletion unless legal retention applies.
      </p>
      <h4>3.1.4. Contacting Clients and Communications</h4>
      <p>
        <strong>Purpose:</strong> The application allows communication with clients and within
        teams. This can include sending messages, images and videos related to the pet’s condition,
        treatment, or general care questions.
      </p>
      <p>
        <strong>Categories of data: </strong> Messages, attachments (photos, videos), pet-related
        context (e.g. symptoms, recent treatments), metadata (timestamps, sender/recipient).
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.</li>
        <li>Google Cloud EMEA Ltd., 70 Sir John Rogerson’s Quay, Dublin 2, Ireland.</li>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com).
        </li>
      </ul>
      <p>
        <strong>Legal basis: </strong> The processing is necessary for the performance of the user
        contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in
        pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).
      </p>
      <p>
        <strong>Storage period: </strong> We store the data until the conversation or account is
        deleted unless the deletion of individual data or documents is prevented by statutory
        retention obligations
      </p>
      <h4>3.1.5. Payment</h4>
      <p>
        Business owners and developers can implement their preferred payment options and payment
        services directly in the web application. The payment is directly performed over these
        payment providers. DuneXploration does not process any personal data in connection with the
        payment.
      </p>
      <h3>3.2. Mobile Application</h3>
      <h4>3.2.1. Server Provision and Hosting</h4>
      <p>
        <strong>Purpose:</strong> The application is hosted on servers to be made technically
        available for users. For this purpose, we collect and temporarily store certain data to
        ensure the operation, availability, stability and security of the software.
      </p>
      <p>
        <strong>Categories of data: </strong> IP address, time and date of access, browser type and
        version, operating system.
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland</li>
      </ul>
      <p>
        <strong>Legal basis: </strong> The legitimate interest in ensuring the technical
        functionality and security of our software (Art. 6 para. 1 lit. f) GDPR).
      </p>
      <p>
        <strong>Storage period: </strong> Log data is deleted after 7 days.
      </p>
      <h4>3.2.2. Signing up and setting up a profile</h4>
      <p>
        <strong>Purpose:</strong> To onboard new users (pet owners, breeders, groomers, and vet
        doctors) to the mobile application, enabling account creation, authentication, and access to
        platform features.
      </p>
      <p>
        <strong>Categories of data: </strong> In particular, name, e-mail address, phone number,
        address, type of user.
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com).
        </li>
        <li>Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland,</li>
        <li>Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg, and</li>
        <li>
          Your identity provider, if you use the log-in of a third party service (we support Meta,
          Google or Apple).
        </li>
      </ul>
      <p>
        <strong>Legal basis: </strong> Establishment of the user relationship, Art. 6 para. 1 lit.
        b) GDPR.
      </p>
      <p>
        <strong>Storage period: </strong> The data will generally be processed for as long as you
        maintain your account with us. After termination of the account, your data will be deleted
        unless the deletion of individual data or documents is prevented by statutory retention
        obligations.
      </p>
      <h4>3.2.3. General Use of the Application</h4>
      <p>
        <strong>Purpose:</strong> To allow users to use the application and all its core functions
        (such as creating pet profiles, managing daily care tasks, recording notes of health data,
        adding vaccination record, creating exercise plans etc), we process the information you
        enter and data generated during use.
      </p>
      <p>
        <strong>Categories of data: </strong> In particular, name, e-mail address, phone number,
        type and content of enquiry, message.
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com),
        </li>
        <li>Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland,</li>
        <li>Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg, and</li>
      </ul>
      <p>
        <strong>Legal basis: </strong> The processing is necessary for the performance of the user
        contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in
        pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).
      </p>
      <p>
        <strong>Storage period: </strong> We store the data as long as the user account is active.
        Data may be deleted upon account deletion unless legal retention applies.
      </p>
      <h4>3.2.4. Booking Appointments</h4>
      <p>
        <strong>Purpose:</strong> To enable pet owners to book appointments with veterinarians
        through the Yosemite Crew mobile application.
      </p>
      <p>
        <strong>Categories of data: </strong> Name, e-mail address, telephone number, booking
        details and, if applicable, desired appointment reminders or additional comments on your
        booking. The data marked as mandatory fields must be provided in order to make a booking.
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com),
        </li>
        <li>Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland,</li>
        <li>Selected veterinarians.</li>
      </ul>
      <p>
        <strong>Legal basis: </strong> The processing is necessary for the performance of the user
        contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in
        pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).
      </p>
      <p>
        <strong>Storage period: </strong> The data collected as part of the booking will be deleted
        after the expiry of the applicable statutory retention obligations (6 years according to
        HGB, 10 years according to AO).
      </p>
      <h4>3.2.5. Contacting Veterinarians and Communications</h4>
      <p>
        <strong>Purpose:</strong> To enable meaningful communication between pet owners and
        veterinary professionals the user can contact veterinarians directly through the
        application. This can include sending messages, images and videos related to the pet’s
        condition, treatment, or general care questions. If you contact the veterinarian, your data
        will be processed to the extent necessary for the veterinarian to answer your inquiry and
        for any follow-up measures.
      </p>
      <p>
        <strong>Categories of data: </strong> Messages, attachments (photos, videos), pet-related
        context (e.g. symptoms, recent treatments), metadata (timestamps, sender/recipient).
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com),
        </li>
        <li>Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland,</li>
        <li>Selected veterinarians.</li>
      </ul>
      <p>
        <strong>Legal basis: </strong> The processing is necessary for the performance of the user
        contract (Art. 6 para. 1 lit. b) GDPR). In addition, we have a legitimate interest in
        pursuing the above-mentioned purposes (Art. 6 para. 1 lit. f) GDPR).
      </p>
      <p>
        <strong>Storage period: </strong> We store the data until the conversation or account is
        deleted unless the deletion of individual data or documents is prevented by statutory
        retention obligations.
      </p>
      <h4>3.2.6. Review and Ratings</h4>
      <p>
        <strong>Purpose:</strong> Users can provide feedback on services received from pet service
        providers to help other users to make their decision and enhance user friendliness.
      </p>
      <p>
        <strong>Categories of data: </strong> Rating (in the form of stars), review text, name,
        timestamp.
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>
          Any user of the PIMS - including the pet service provider selected by the user - can view
          the review.
        </li>
        <li>Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.</li>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com).
        </li>
      </ul>
      <p>
        <strong>Legal basis: </strong> Voluntary consent to publish review (Art. 6 para 1 lit. a
        GDPR).
      </p>
      <p>
        <strong>Storage period: </strong> We store the data until the review is manually removed by
        the user or deleted due to inactivity or policy violations.
      </p>
      <h4>3.2.7. Payment</h4>
      <p>
        Users can pay assessment fees directly or receive invoices for treatments via the app. When
        payment is made through the app, the transaction is directly performed by the pet service
        providers own payment services. We will not process any payment data in connection with the
        payment process.
      </p>
      <h4>3.2.8. Pet Medical Records and Health Features</h4>
      <p>
        <strong>Purpose:</strong> To enable users to record, track and share their pet&apos;s
        medical and health information, such as medical conditions, medications, vaccination status
        and observations (e.g. water intake or pain levels), users can add information to their
        profile. This allows for better monitoring and communication with veterinary care providers.
      </p>
      <p>
        <strong>Categories of data: </strong> Pet&apos;s medical records (vaccinations,
        prescriptions, diagnoses), daily health logs, notes on behaviour or pain, exercise
        schedules, reminders, task lists.
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.</li>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com).
        </li>
        <li>Pet service provider selected by the user.</li>
      </ul>
      <p>
        <strong>Legal basis: </strong> The legitimate interest in pursuing the aforementioned
        purposes (Art. 6 para. 1 lit. f. GDPR).
      </p>
      <p>
        <strong>Storage period: </strong> As long as the pet profile exists and data is not manually
        deleted. Full deletion occurs with account removal or upon user request.
      </p>
      <h4>3.2.9. Contacting Us</h4>
      <p>
        <strong>Purpose:</strong> Users can contact us through the application by sending us a
        message. Users can submit a general enquiry, feature request or a data subject access
        request. When you contact us at, your data will be processed to the extent necessary to
        answer your enquiry and for any follow-up measures.
      </p>
      <p>
        <strong>Categories of data: </strong>Inventory data (e.g., names, addresses), contact
        details, content data, metadata (timestamps, sender/recipient).
      </p>
      <p>
        <strong>Recipient:</strong>
      </p>
      <ul>
        <li>Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.</li>
        <li>Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg.</li>
        <li>
          Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (Privacy
          contact: privacy@supabase.com).
        </li>
      </ul>
      <p>
        <strong>Legal basis: </strong> Contract fulfillment and pre-contractual inquiries (Art. 6
        para. 1 lit. b. GDPR); legitimate interests (Art. 6 para. 1 lit. f. GDPR) in the processing
        of communication.
      </p>
      <p>
        <strong>Storage period: </strong> The data will generally be processed for as long as it is
        necessary to process the inquiry.
      </p>
    </DocSection>

    <DocSection id="social-media" title="4. Presence on social media">
      <p>
        We have profiles on social networks. Our social media accounts complement our PIMS and offer
        you the opportunity to interact with us. As soon as you access our social media profiles on
        social networks, the terms and conditions and data processing guidelines of the respective
        operators apply. The data collected about you when you use the services is processed by the
        networks and may also be transferred to countries outside the European Union where there is
        no adequate level of protection for the processing of personal data. We have no influence on
        data processing in social networks, as we are users of the network just like you.
        Information on this and on what data is processed by the social networks and for what
        purposes the data is used can be found in the privacy policy of the respective network
        listed below. We use the following social networks:
      </p>
      <h3>4.1. LinkedIn</h3>
      <p>
        Our website can be accessed at:{' '}
        <a href="https://de.linkedin.com/company/yosemitecrew">
          {' '}
          https://de.linkedin.com/company/yosemitecrew{' '}
        </a>
      </p>
      <p>
        The network is operated by: LinkedIn Ireland Unlimited Company, Wilton Place, Dublin 2,
        Ireland.
      </p>
      <p>
        Privacy policy of the network:{' '}
        <a href="https://www.linkedin.com/legal/privacy-policy">
          {' '}
          www.linkedin.com/legal/privacy-policy{' '}
        </a>
      </p>
      <h3>4.2. TikTok</h3>
      <p>
        Our website can be accessed at:{' '}
        <a href="https://www.tiktok.com/@yosemitecrew"> https://www.tiktok.com/@yosemitecrew </a>
      </p>
      <p>
        The network is operated by: TikTok Technology Limited, 10 Earlsfort Terrace, Dublin, D02
        T380, Ireland.
      </p>
      <p>
        Privacy policy of the network:{' '}
        <a href="https://www.tiktok.com/legal/page/eea/privacy-policy/de">
          {' '}
          https://www.tiktok.com/legal/page/eea/privacy-policy/de{' '}
        </a>
      </p>
      <h3>4.3. Instagram</h3>
      <p>
        Our website can be accessed at:{' '}
        <a href="https://www.instagram.com/yosemite_crew">
          {' '}
          https://www.instagram.com/yosemite_crew{' '}
        </a>
      </p>
      <p>
        The network is operated by: Meta Platforms Ireland Limited, 4 Grand Canal Square, Dublin 2,
        Ireland.
      </p>
      <p>
        Privacy policy of the network:{' '}
        <a href="https://privacycenter.instagram.com/"> https://privacycenter.instagram.com/ </a>
      </p>
      <h3>4.4. X.com</h3>
      <p>
        Our website can be accessed at:{' '}
        <a href="https://x.com/yosemitecrew"> https://x.com/yosemitecrew</a>
      </p>
      <p>
        The network is operated by: X Internet Unlimited Company, One Cumberland Place, Fenian
        Street, Dublin 2, D02 AX07 Ireland.
      </p>
      <p>
        Privacy policy of the network:{' '}
        <a href="https://x.com/de/privacy"> https://x.com/de/privacy</a>
      </p>
      <h3>4.5. Discord</h3>
      <p>
        Our website can be accessed at:{' '}
        <a href="https://discord.gg/YVzMa9j7BK"> https://discord.gg/YVzMa9j7BK </a>
      </p>
      <p>
        The network is operated by: Discord Netherlands BV, Schiphol Boulevard 195, 1118 BG
        Schiphol, Netherlands.
      </p>
      <p>
        Privacy policy of the network:{' '}
        <a href="https://discord.com/privacy"> https://discord.com/privacy</a>
      </p>
      <h3>4.6. GitHub</h3>
      <p>
        Our website can be accessed at:{' '}
        <a href="https://github.com/YosemiteCrew/Yosemite-Crew">
          {' '}
          https://github.com/YosemiteCrew/Yosemite-Crew{' '}
        </a>
      </p>
      <p>
        The network is operated by: GitHub B.V Prins Bernhardplein 200, Amsterdam 1097JB,
        Netherlands.
      </p>
      <p>
        Privacy policy of the network:{' '}
        <a href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement">
          {' '}
          https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement{' '}
        </a>
      </p>
      <h3>4.7. Joint responsibility</h3>
      <p>
        <strong>Purposes: </strong> We process personal data as our own controller when you send us
        inquiries via social media profiles. We process this data to respond to your inquiries.
      </p>
      <p>
        In addition, we are jointly responsible with the following networks for the following
        processing (Art. 26 GDPR). When you visit our profile on LinkedIn and Instagram, TikTok,
        X.com, Discord, Github the network collects aggregated statistics (“Insights data”) created
        from certain events logged by their servers when you interact with our profiles and the
        content associated with them. We receive these aggregated and anonymous statistics from the
        network about the use of our profile. We are generally unable to associate the data with
        specific users. To a certain extent, we can determine the criteria according to which the
        network compiles these statistics for us. We use these statistics to make our profiles more
        interesting and informative for you.
      </p>
      <p>
        For more information about this data processing by LinkedIn, please refer to the joint
        controller agreement at:{' '}
        <a href="https://legal.linkedin.com/pages-joint-controller-addendum">
          {' '}
          https://legal.linkedin.com/pages-joint-controller-addendum{' '}
        </a>
      </p>
      <p>
        Further information on this data processing by Instagram can be found in the joint
        controller agreement at:{' '}
        <a href="https://www.facebook.com/legal/terms/information_about_page_insights_data">
          {' '}
          https://www.facebook.com/legal/terms/information_about_page_insights_data{' '}
        </a>
      </p>
      <p>
        Further information on this data processing by TikTok can be found in the joint controller
        agreement at:{' '}
        <a href="https://www.tiktok.com/legal/page/global/tiktok-analytics-joint-controller-addendum/en">
          {' '}
          https://www.tiktok.com/legal/page/global/tiktok-analytics-joint-controller-addendum/en{' '}
        </a>
      </p>
      <p>
        {' '}
        Further information on this data processing by X.com can be found in the joint controller
        agreement at:{' '}
        <a href="https://gdpr.x.com/en/controller-to-controller-transfers.html">
          {' '}
          https://gdpr.x.com/en/controller-to-controller-transfers.html{' '}
        </a>{' '}
      </p>
      <p>
        {' '}
        Further information on this data processing by Discord can be found in the joint controller
        agreement at:{' '}
        <a href="https://discord.com/terms/local-laws">
          {' '}
          https://discord.com/terms/local-laws{' '}
        </a>{' '}
      </p>
      <p>
        {' '}
        Further information on this data processing by Github can be found in the joint controller
        agreement at:{' '}
        <a href="https://github.com/customer-terms/github-data-protection-agreement">
          {' '}
          https://github.com/customer-terms/github-data-protection-agreement{' '}
        </a>{' '}
      </p>
      <p>
        <strong>Legal basis: </strong> Processing is carried out on the basis of our legitimate
        interest (Art. 6 (1) (f) GDPR). The interest lies in the respective purpose.
      </p>
      <p>
        <strong>Storage period: </strong> We do not store any personal data ourselves within the
        scope of joint responsibility. With regard to contact requests outside the network, the
        above information on establishing contact applies accordingly.
      </p>
    </DocSection>

    <DocSection id="recipients" title="5. General information on recipients">
      <p>
        When we process your data, it may be necessary to transfer or disclose your data to other
        recipients. In the sections on processing above, we name the specific recipients as far as
        we are able to do so. If recipients are located in a country outside the EU, we indicate
        this separately under the individual points listed above. Unless we expressly refer to an
        adequacy decision, no adequacy decision exists for the respective recipient country. In such
        cases, we will agree on appropriate safeguards in the form of standard contractual clauses
        to ensure an adequate level of data protection (unless other appropriate safeguards, such as
        binding corporate rules, exist). You can access the current versions of the standard
        contractual clauses at{' '}
        <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj">
          {' '}
          https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj.{' '}
        </a>
      </p>
      <p>
        <strong>
          {' '}
          In addition to these specific recipients, data may also be transferred to other categories
          of recipients. These may be internal recipients, i.e., persons within our company, but
          also external recipients. Possible recipients may include, in particular:{' '}
        </strong>
      </p>
      <ul>
        <li>
          Our employees who are responsible for processing and storing the data and whose employment
          relationship with us is governed by a confidentiality agreement.
        </li>
        <li>
          Service providers who act as processors bound by our instructions. These are primarily
          technical service providers whose services we use when we cannot or do not reasonably
          perform certain services ourselves.
        </li>
        <li>
          Third-party providers who support us in providing our services in accordance with our
          terms and conditions. For example: payment service providers, marketing service providers,
          and responsible gaming service providers.
        </li>
        <li>
          Authorities, in order to comply with our legal and reporting obligations, which may
          include reporting suspected fraud or criminal activity and cases of responsible gaming to
          the relevant authorities or authorized third parties.
        </li>
      </ul>
    </DocSection>

    <DocSection id="storage" title="6. General information on storage duration">
      <p>
        We generally process your personal data for the storage period described above. However,
        data is often processed for more than one purpose, meaning that we may continue to process
        your data for a specific purpose even after the storage period has expired. In this case,
        the storage period specified for this purpose applies. We will delete your data immediately
        once the last storage period has expired.
      </p>
    </DocSection>

    <DocSection id="automated" title="7. Automated decision-making and obligation to provide data">
      <p>
        We do not use automated decision-making that has a legal effect on you or significantly
        affects you in a similar way.
      </p>
      <p>
        Please note that you are not legally or contractually obligated to provide us with your
        data. Nevertheless, you must provide certain information when creating an account or
        performing other actions. Without this information, we cannot enter into a contractual
        relationship with you or provide you with the relevant offers.
      </p>
    </DocSection>

    <DocSection
      id="rights"
      title="8. What rights do you have with regard to the personal data you provide to us?"
    >
      <p>
        You have the following rights, provided that the legal requirements are met. To exercise
        these rights, you can contact using the following address:{' '}
        <a href="mailto:security@yosemitecrew.com"> security@yosemitecrew.com</a>.
      </p>
      <h3>Art. 15 GDPR – Right of access by the data subject:</h3>
      <p>
        You have the right to obtain confirmation from us as to whether personal data concerning you
        are being processed and, if so, which data are being processed and the circumstances
        surrounding the processing.
      </p>
      <h3>Art. 16 GDPR – Right to rectification:</h3>
      <p>
        You have the right to request that we immediately correct any inaccurate personal data
        concerning you. Taking into account the purposes of the processing, you also have the right
        to request the completion of incomplete personal data, including by means of a supplementary
        statement.
      </p>
      <h3>Art. 17 GDPR – Right to erasure:</h3>
      <p>
        {' '}
        You have the right to request that we erase personal data concerning you without undue
        delay.{' '}
      </p>
      <h3>Art. 18 GDPR – Right to restriction of processing:</h3>
      <p>You have the right to request that we restrict processing.</p>
      <h3>Art. 20 GDPR – Right to data portability:</h3>
      <p>
        In the event of processing based on consent or for the performance of a contract, you have
        the right to receive the personal data concerning you that you have provided to us in a
        structured, commonly used and machine-readable format and to transmit this data to another
        controller without hindrance from us or to have the data transmitted directly to the other
        controller, where technically feasible.
      </p>
      <h3>
        Art. 77 GDPR in conjunction with § 19 BDSG – Right to lodge a complaint with a supervisory
        authority:
      </h3>
      <p>
        You have the right to lodge a complaint with a supervisory authority, in particular in the
        Member State of your habitual residence, place of work or place of the alleged infringement,
        if you consider that the processing of personal data relating to you infringes applicable
        law.
      </p>
      <p>
        To exercise any of these rights, use the <Link href="/contact-us">data request form</Link>{' '}
        or email <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a>.
      </p>
    </DocSection>

    <DocSection id="objection" title="9. In particular, right to object and withdrawal of consent">
      <p>
        You have the right to object at any time, on grounds relating to your particular situation,
        to the processing of personal data concerning you which is necessary for the performance of
        a task carried out in the public interest or in the exercise of official authority, or which
        is based on a legitimate interest on our part.
      </p>
      <p>
        If you object, we will no longer process your personal data unless we can demonstrate
        compelling legitimate grounds for the processing that override your interests, rights, and
        freedoms, or the processing is necessary for the establishment, exercise, or defense of
        legal claims.
      </p>
      <p>
        If we process your personal data for direct marketing purposes, you have the right to object
        to the processing at any time. If you object to processing for direct marketing purposes, we
        will no longer process your personal data for these purposes.
      </p>
      <p>
        You can object at any time with future effect via one of the contact addresses known to you.
      </p>
      <p>
        <strong>Withdrawal of consent:</strong> You can revoke your consent at any time with future
        effect via one of the contact addresses known to you.
      </p>
    </DocSection>

    <DocSection id="obligation" title="10. Obligation to provide data">
      <p>
        You are not contractually or legally obliged to provide us with personal data. However,
        without the data you provide, we are unable to offer you our services.
      </p>
    </DocSection>

    <DocSection id="contact" title="11. If you have any comments or questions">
      <p>
        We take all reasonable precautions to protect and secure your data. We welcome your
        questions and comments regarding data protection. If you have any questions regarding the
        collection, processing, or use of your personal data, or if you wish to request information,
        correction, blocking, or deletion of data, or revoke your consent, please contact{' '}
        <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a>.
      </p>
    </DocSection>

    <DocSection id="analytics" title="Analytics (PostHog)">
      <p>
        To understand how the product is used and improve it, we use <strong>PostHog</strong> for
        privacy-friendly product analytics on our hosted service. We keep this to aggregate,
        product-improvement insights and do not run advertising trackers or sell data.
      </p>
      <p>
        <strong>Legal basis:</strong> your consent (Art. 6 para. 1 lit. a) GDPR), which we request
        through the cookie notice and which you can withdraw at any time with future effect. If you
        reject non-essential cookies, analytics is not loaded.
      </p>
      <p>
        <strong>Recipient:</strong> PostHog, for product analytics (EU hosting), where you have
        consented.
      </p>
    </DocSection>
  </LegalDoc>
);

export default PrivacyPolicy;
