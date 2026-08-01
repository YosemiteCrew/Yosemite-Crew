import type { LegalSection } from '../legalContentTypes';

export const TERMS_EXHIBIT_A_SECTIONS: LegalSection[] = [
  {
    id: 'exhibit-a',
    title: 'Exhibit A: Support Services and Service Level Policy',
    blocks: [
      { type: 'h3', content: '1. Definitions', k: 'b0' },
      {
        type: 'p',
        content: [
          { text: '1.1. Emergency Downtime', bold: true, k: 'r0' },
          ' means such time as the SaaS Service is offline due to a short-term emergency condition, provided that: (a) the incident lasts less than three (3) hours; and (b) there have been no prior Emergency Downtime incidents within 90 days before the incident.',
        ],
        k: 'b1',
      },
      {
        type: 'p',
        content: [
          { text: '1.2. Excused Downtime', bold: true, k: 'r0' },
          ' means any downtime that is Maintenance Downtime or Emergency Downtime or that is caused by the failure of any third party vendors, the Internet in general, or any event beyond the reasonable control of the party, including force of nature, war, riot, civil action, terrorism, labor dispute, malicious acts or denial of service by a third party, or failure of telecommunication systems or utilities (“Force Majeure Event”).',
        ],
        k: 'b2',
      },
      {
        type: 'p',
        content: [
          { text: '1.3. Error', bold: true, k: 'r0' },
          ' means a failure of the SaaS Service to conform to the specifications set forth in the Documentation, resulting in the inability to use, or material restriction in the use of the SaaS Service.',
        ],
        k: 'b3',
      },
      {
        type: 'p',
        content: [
          { text: '1.4. Maintenance Downtime', bold: true, k: 'r0' },
          ' means such time as the SaaS Service is offline for maintenance or backup purposes, provided that the incident is scheduled with Customer at least 24 hours in advance.',
        ],
        k: 'b4',
      },
      {
        type: 'p',
        content: [
          { text: '1.5. Monthly Availability Percentage', bold: true, k: 'r0' },
          ' means the percentage of time over the course of each calendar month during the Subscription Term, excluding Excused Downtime, that the SaaS Service is available for use by Customer.',
        ],
        k: 'b5',
      },
      {
        type: 'p',
        content: [
          { text: '1.6. Start Time', bold: true, k: 'r0' },
          ' means the time at which DuneXploration first becomes aware of an Error.',
        ],
        k: 'b6',
      },
      {
        type: 'p',
        content: [
          { text: '1.7. Update', bold: true, k: 'r0' },
          ' is a SaaS Service release that DuneXploration makes generally available to all DuneXploration customers, along with any corresponding changes to Documentation. An Update may be an error correction or bug fix; or it may be enhancement, new feature, or new functionality.',
        ],
        k: 'b7',
      },
      { type: 'h3', content: '2. Support Services', k: 'b8' },
      {
        type: 'p',
        content: [
          'DuneXploration will provide Support Services to Customer through an online form (  ',
          { text: 'support@yosemitecrew.com', href: 'mailto:support@yosemitecrew.com', k: 'r0' },
          '  ) and a discord chat (  ',
          { text: 'https://discord.gg/YVzMq97Bk', href: 'https://discord.gg/YVzMq97Bk', k: 'r1' },
          '  ) or through other customer support center contacts, set forth below (the ',
          { text: '“Customer Support Center”', bold: true, k: 'r2' },
          '). Customer will receive Updates, other software modifications or additions, procedures, or routine or configuration changes that may solve, bypass or eliminate the practical adverse effect of the Error. Customer will designate a certain number of employees or agents that will interface with the Customer Support Center, and submit Errors, requests or support tickets (the ',
          { text: '“Technical Support Contacts”', bold: true, k: 'r3' },
          '). Customer is permitted to name as many Technical Contacts as allowed pursuant to the purchased Support Service Subscription. Customer’s non-named Technical Contacts may contact the Customer Support Center only in case of an emergency or on an exception basis, and DuneXploration will respond to such Error submission and cooperate with the non-named Technical Contact, subject to later verification and involvement of a named Technical Support Contact. Additional named Technical Support Contacts may be permitted upon mutual agreement of the parties.',
        ],
        k: 'b9',
      },
      { type: 'h3', content: '3. Support Services subscriptions', k: 'b10' },
      {
        type: 'p',
        content:
          'Customer will have access to the Customer Support Center, Monday through Friday, 9 a.m. to 5 p.m. (DuneXploration’s local time). Submitted Errors will be classNameified by severity as set forth in the table below. Customer may assign two (2) Technical Support Contacts, which may contact the Customer Support Center through any of the Customer Support Center Contacts, as set forth below.',
        k: 'b11',
      },
      { type: 'h3', content: '4. SaaS Service availability', k: 'b12' },
      {
        type: 'p',
        content:
          'DuneXploration will use its commercially reasonable efforts to ensure a Monthly Availability Percentage of the SaaS Service is equal to or greater than 99.99% excluding any Excused Downtime.',
        k: 'b13',
      },
      { type: 'h3', content: '5. Service Level Credits', k: 'b14' },
      {
        type: 'p',
        content: [
          { text: '5.1.', bold: true, k: 'r0' },
          ' If DuneXploration does not meet the Uptime levels specified below, Customer will be entitled, upon written request, to a service level credit (“Service Level Credit”) to be calculated as follows:',
        ],
        k: 'b15',
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
                  'If Uptime Percentage is at least 99.995% of the month’s minutes, no Service Level Credits are provided; or',
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
                  'If Uptime Percentage is 99.75% to 99.94% (inclusive) of the month’s minutes, Customer will be eligible for a credit of 5% of a monthly average fee derived from one-twelfth (1/12th) of the then-current annual fee paid to DuneXploration; or',
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
                  'If Uptime Percentage is 99.50% to 99.74% (inclusive) of the month’s minutes, Customer will be eligible for a credit of 7.5% of a monthly average fee derived from one-twelfth (1/12th) of the then-current annual fee paid to DuneXploration; or',
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
                  'If Uptime Percentage is less than 99.50% of the month’s minutes, Customer will be eligible for a credit of 10.0% of a monthly average fee derived from one-twelfth (1/12th) of the then-current annual fee paid to DuneXploration.',
                k: 'b0',
              },
            ],
          },
        ],
        k: 'b16',
      },
      {
        type: 'p',
        content: [
          { text: '5.2.', bold: true, k: 'r0' },
          ' Customer shall only be eligible to request Service Level Credits if it notifies DuneXploration in writing within thirty (30) days from the end of the month for which Service Level Credits are due. All claims will be verified against DuneXploration’s system records. In the event after such notification DuneXploration determines that Service Level Credits are not due, or that different Service Level Credits are due, DuneXploration shall notify Customer in writing on that finding. Service Level Credits will be applied to the next invoice following Customer’s request and DuneXploration’s confirmation of available credits. Service Level Credits shall be Customer’s sole and exclusive remedy in the event of any failure to meet the Service Levels. DuneXploration will only provide records of system availability in response to good faith Customer claims.',
        ],
        k: 'b17',
      },
      { type: 'h3', content: '6. Customer Support Center contact', k: 'b18' },
      {
        type: 'table',
        caption: 'Customer support center contact channels and response options',
        head: ['Support channel', 'Details'],
        rows: [
          {
            k: 'r0',
            cells: [
              { content: 'Phone Support', header: true, k: 'c0' },
              { content: 'English', k: 'c1' },
            ],
          },
          {
            k: 'r1',
            cells: [
              { content: 'Support Phone', header: true, k: 'c0' },
              { content: 'None', k: 'c1' },
            ],
          },
          {
            k: 'r2',
            cells: [
              { content: 'Support Mail', header: true, k: 'c0' },
              {
                content: [
                  {
                    text: 'support@yosemitecrew.com',
                    href: 'mailto:support@yosemitecrew.com',
                    k: 'r0',
                  },
                ],
                k: 'c1',
              },
            ],
          },
          {
            k: 'r3',
            cells: [
              { content: 'Support Chat', header: true, k: 'c0' },
              {
                content: [
                  {
                    text: 'https://discord.gg/YVzMq97Bk',
                    href: 'https://discord.gg/YVzMq97Bk',
                    k: 'r0',
                  },
                ],
                k: 'c1',
              },
            ],
          },
        ],
        k: 'b19',
      },
      { type: 'h3', content: '7. Error response service levels', k: 'b20' },
      {
        type: 'p',
        content:
          'Customer shall submit each ticket with a severity level designation based on the definitions in the table below. Severity response times do not vary, whether Customer contacts the Customer Support Center via phone or email. DuneXploration shall respond to such ticket in accordance with the severity designation and validate Customer’s severity level designation or notify Customer of a proposed change in the severity level designation with justification for the change. DuneXploration will provide continuous efforts to resolve Severity 1 issues until a workaround or resolution can be provided or until the incident can be downgraded to a lower severity. DuneXploration will use reasonable efforts to meet the target response times for the Errors stated in the table below.',
        k: 'b21',
      },
      {
        type: 'table',
        caption: 'Error response service levels and target response times',
        head: ['Severity Level', 'Description', 'Response Time'],
        rows: [
          {
            k: 'r0',
            cells: [
              { content: 'Severity 1 (Critical)', k: 'c0' },
              {
                content:
                  'Any Error in the SaaS Service causing the SaaS Service to be unusable, resulting in a critical impact on the operation of the SaaS Service and there is no workaround DuneXploration will promptly: (i) assign a specialist to correct the Error; (ii) provide ongoing communication on the status of an Update; and (iii) begin to provide a temporary workaround or fix.',
                k: 'c1',
              },
              { content: 'Within 2 hours.', k: 'c2' },
            ],
          },
          {
            k: 'r1',
            cells: [
              { content: 'Severity 2 (Serious)', k: 'c0' },
              {
                content:
                  'An Error in a SaaS Service where the SaaS Service will operate but its operation is severely restricted. No workaround is available, and performance may be degraded, or functions are limited. DuneXploration will promptly: (i) assign a specialist to correct the Error; and (ii) provide additional escalated Support Services as determined necessary by DuneXploration.',
                k: 'c1',
              },
              { content: 'Within 4 hours.', k: 'c2' },
            ],
          },
          {
            k: 'r2',
            cells: [
              { content: 'Severity 3 (Moderate)', k: 'c0' },
              {
                content:
                  'An Error in the SaaS Service where the SaaS Service will operate with limitations that are not critical to the overall operation, such as a workaround forces a user and/or a systems operator to use a time-consuming procedure to operate the system; or removes a non-essential feature. DuneXploration will triage the request and may include a resolution in the next Update.',
                k: 'c1',
              },
              { content: 'Within 8 hours.', k: 'c2' },
            ],
          },
          {
            k: 'r3',
            cells: [
              { content: 'Severity 4 (Low)', k: 'c0' },
              {
                content:
                  'An Error in the SaaS Service where the SaaS Service can be used with only slight inconvenience. All SaaS Service feature requests fall into this severity level. DuneXploration will triage the request and may include a resolution in the next Update.',
                k: 'c1',
              },
              { content: 'Next business day.', k: 'c2' },
            ],
          },
        ],
        k: 'b22',
      },
    ],
  },
];
