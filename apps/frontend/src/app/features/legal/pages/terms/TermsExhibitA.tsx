'use client';

import { DocSection } from '@/app/features/marketing/site';

const SupportContactTableHead = () => (
  <thead className="sr-only">
    <tr>
      <th scope="col">Support channel</th>
      <th scope="col">Details</th>
    </tr>
  </thead>
);

/* 1. DEFINITIONS 1.1. Emergency Downtime */
const TermsExhibitAPart1 = () => (
  <>
    <h3>1. Definitions</h3>
    <p>
      <strong>1.1. Emergency Downtime</strong> means such time as the SaaS Service is offline due to
      a short-term emergency condition, provided that: (a) the incident lasts less than three (3)
      hours; and (b) there have been no prior Emergency Downtime incidents within 90 days before the
      incident.
    </p>
    <p>
      <strong>1.2. Excused Downtime</strong> means any downtime that is Maintenance Downtime or
      Emergency Downtime or that is caused by the failure of any third party vendors, the Internet
      in general, or any event beyond the reasonable control of the party, including force of
      nature, war, riot, civil action, terrorism, labor dispute, malicious acts or denial of service
      by a third party, or failure of telecommunication systems or utilities (“Force Majeure
      Event”).
    </p>
    <p>
      <strong>1.3. Error</strong> means a failure of the SaaS Service to conform to the
      specifications set forth in the Documentation, resulting in the inability to use, or material
      restriction in the use of the SaaS Service.
    </p>
    <p>
      <strong>1.4. Maintenance Downtime</strong> means such time as the SaaS Service is offline for
      maintenance or backup purposes, provided that the incident is scheduled with Customer at least
      24 hours in advance.
    </p>
    <p>
      <strong>1.5. Monthly Availability Percentage</strong> means the percentage of time over the
      course of each calendar month during the Subscription Term, excluding Excused Downtime, that
      the SaaS Service is available for use by Customer.
    </p>
    <p>
      <strong>1.6. Start Time</strong> means the time at which DuneXploration first becomes aware of
      an Error.
    </p>
    <p>
      <strong>1.7. Update</strong> is a SaaS Service release that DuneXploration makes generally
      available to all DuneXploration customers, along with any corresponding changes to
      Documentation. An Update may be an error correction or bug fix; or it may be enhancement, new
      feature, or new functionality.
    </p>
    <h3>2. Support Services</h3>
    <p>
      DuneXploration will provide Support Services to Customer through an online form ({' '}
      <a href="mailto:support@yosemitecrew.com"> support@yosemitecrew.com </a> ) and a discord chat
      ({' '}
      <a href="https://discord.gg/YVzMq97Bk" target="_blank" rel="noreferrer">
        {' '}
        https://discord.gg/YVzMq97Bk{' '}
      </a>{' '}
      ) or through other customer support center contacts, set forth below (the{' '}
      <strong>“Customer Support Center”</strong>). Customer will receive Updates, other software
      modifications or additions, procedures, or routine or configuration changes that may solve,
      bypass or eliminate the practical adverse effect of the Error. Customer will designate a
      certain number of employees or agents that will interface with the Customer Support Center,
      and submit Errors, requests or support tickets (the{' '}
      <strong>“Technical Support Contacts”</strong>). Customer is permitted to name as many
      Technical Contacts as allowed pursuant to the purchased Support Service Subscription.
      Customer’s non-named Technical Contacts may contact the Customer Support Center only in case
      of an emergency or on an exception basis, and DuneXploration will respond to such Error
      submission and cooperate with the non-named Technical Contact, subject to later verification
      and involvement of a named Technical Support Contact. Additional named Technical Support
      Contacts may be permitted upon mutual agreement of the parties.
    </p>
    <h3>3. Support Services subscriptions</h3>
    <p>
      Customer will have access to the Customer Support Center, Monday through Friday, 9 a.m. to 5
      p.m. (DuneXploration’s local time). Submitted Errors will be classNameified by severity as set
      forth in the table below. Customer may assign two (2) Technical Support Contacts, which may
      contact the Customer Support Center through any of the Customer Support Center Contacts, as
      set forth below.
    </p>
    <h3>4. SaaS Service availability</h3>
    <p>
      DuneXploration will use its commercially reasonable efforts to ensure a Monthly Availability
      Percentage of the SaaS Service is equal to or greater than 99.99% excluding any Excused
      Downtime.
    </p>
    <h3>5. Service Level Credits</h3>
    <p>
      <strong>5.1.</strong> If DuneXploration does not meet the Uptime levels specified below,
      Customer will be entitled, upon written request, to a service level credit (“Service Level
      Credit”) to be calculated as follows:
    </p>
    <ul>
      <li>
        If Uptime Percentage is at least 99.995% of the month’s minutes, no Service Level Credits
        are provided; or
      </li>
      <li>
        If Uptime Percentage is 99.75% to 99.94% (inclusive) of the month’s minutes, Customer will
        be eligible for a credit of 5% of a monthly average fee derived from one-twelfth (1/12th) of
        the then-current annual fee paid to DuneXploration; or
      </li>
      <li>
        If Uptime Percentage is 99.50% to 99.74% (inclusive) of the month’s minutes, Customer will
        be eligible for a credit of 7.5% of a monthly average fee derived from one-twelfth (1/12th)
        of the then-current annual fee paid to DuneXploration; or
      </li>
      <li>
        If Uptime Percentage is less than 99.50% of the month’s minutes, Customer will be eligible
        for a credit of 10.0% of a monthly average fee derived from one-twelfth (1/12th) of the
        then-current annual fee paid to DuneXploration.
      </li>
    </ul>
    <p>
      <strong>5.2.</strong> Customer shall only be eligible to request Service Level Credits if it
      notifies DuneXploration in writing within thirty (30) days from the end of the month for which
      Service Level Credits are due. All claims will be verified against DuneXploration’s system
      records. In the event after such notification DuneXploration determines that Service Level
      Credits are not due, or that different Service Level Credits are due, DuneXploration shall
      notify Customer in writing on that finding. Service Level Credits will be applied to the next
      invoice following Customer’s request and DuneXploration’s confirmation of available credits.
      Service Level Credits shall be Customer’s sole and exclusive remedy in the event of any
      failure to meet the Service Levels. DuneXploration will only provide records of system
      availability in response to good faith Customer claims.
    </p>
    <h3>6. Customer Support Center contact</h3>
    <table>
      <caption className="sr-only">
        Customer support center contact channels and response options
      </caption>
      <SupportContactTableHead />
      <tbody>
        <tr>
          <th scope="row">Phone Support</th>
          <td>English</td>
        </tr>
        <tr>
          <th scope="row">Support Phone</th>
          <td>None</td>
        </tr>
        <tr>
          <th scope="row">Support Mail</th>
          <td>
            <a href="mailto:support@yosemitecrew.com"> support@yosemitecrew.com </a>
          </td>
        </tr>
        <tr>
          <th scope="row">Support Chat</th>
          <td>
            <a href="https://discord.gg/YVzMq97Bk" target="_blank" rel="noreferrer">
              {' '}
              https://discord.gg/YVzMq97Bk{' '}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  </>
);

/* 7. ERROR RESPONSE SERVICE LEVELS Customer shall submit each ticket wit */
const TermsExhibitAPart2 = () => (
  <>
    <h3>7. Error response service levels</h3>
    <p>
      Customer shall submit each ticket with a severity level designation based on the definitions
      in the table below. Severity response times do not vary, whether Customer contacts the
      Customer Support Center via phone or email. DuneXploration shall respond to such ticket in
      accordance with the severity designation and validate Customer’s severity level designation or
      notify Customer of a proposed change in the severity level designation with justification for
      the change. DuneXploration will provide continuous efforts to resolve Severity 1 issues until
      a workaround or resolution can be provided or until the incident can be downgraded to a lower
      severity. DuneXploration will use reasonable efforts to meet the target response times for the
      Errors stated in the table below.
    </p>
    <table>
      <caption className="sr-only">Error response service levels and target response times</caption>
      <thead>
        <tr>
          <th scope="col">Severity Level</th>
          <th scope="col">Description</th>
          <th scope="col">Response Time</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Severity 1 (Critical)</td>
          <td>
            Any Error in the SaaS Service causing the SaaS Service to be unusable, resulting in a
            critical impact on the operation of the SaaS Service and there is no workaround
            DuneXploration will promptly: (i) assign a specialist to correct the Error; (ii) provide
            ongoing communication on the status of an Update; and (iii) begin to provide a temporary
            workaround or fix.
          </td>
          <td>Within 2 hours.</td>
        </tr>
        <tr>
          <td>Severity 2 (Serious)</td>
          <td>
            An Error in a SaaS Service where the SaaS Service will operate but its operation is
            severely restricted. No workaround is available, and performance may be degraded, or
            functions are limited. DuneXploration will promptly: (i) assign a specialist to correct
            the Error; and (ii) provide additional escalated Support Services as determined
            necessary by DuneXploration.
          </td>
          <td>Within 4 hours.</td>
        </tr>
        <tr>
          <td>Severity 3 (Moderate)</td>
          <td>
            An Error in the SaaS Service where the SaaS Service will operate with limitations that
            are not critical to the overall operation, such as a workaround forces a user and/or a
            systems operator to use a time-consuming procedure to operate the system; or removes a
            non-essential feature. DuneXploration will triage the request and may include a
            resolution in the next Update.
          </td>
          <td>Within 8 hours.</td>
        </tr>
        <tr>
          <td>Severity 4 (Low)</td>
          <td>
            An Error in the SaaS Service where the SaaS Service can be used with only slight
            inconvenience. All SaaS Service feature requests fall into this severity level.
            DuneXploration will triage the request and may include a resolution in the next Update.
          </td>
          <td>Next business day.</td>
        </tr>
      </tbody>
    </table>
  </>
);

export const TermsExhibitA = () => (
  <>
    <DocSection id="exhibit-a" title="Exhibit A: Support Services and Service Level Policy">
      <TermsExhibitAPart1 />
      <TermsExhibitAPart2 />
    </DocSection>
  </>
);
