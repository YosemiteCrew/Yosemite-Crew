'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  IoArrowBack,
  IoBulbOutline,
  IoCopyOutline,
  IoLogoGithub,
  IoSearchOutline,
} from 'react-icons/io5';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperDocs.css';

const DOCS_BASE_PATH = '/docs';
const GITHUB_EDIT_URL =
  'https://github.com/YosemiteCrew/Yosemite-Crew/tree/dev/apps/frontend/content/docs';

type NavItem = { id: string; label: string };
type NavSection = { heading: string; items: NavItem[] };

/*
 * Only surfaces that exist are listed.
 *
 * A "Webhooks" page used to sit here describing signed event deliveries and a
 * signing secret. There is no WebhookSubscription model in the schema and no
 * route that delivers one, so the page documented a feature that had never
 * been built. Removed rather than relabelled: a developer does not need a
 * roadmap entry in an API reference.
 */
const NAV: NavSection[] = [
  {
    heading: 'Getting started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'appointments', label: 'Appointments' },
      { id: 'companions', label: 'Companions' },
    ],
  },
  {
    heading: 'Guides',
    items: [{ id: 'fhir', label: 'FHIR resources' }],
  },
];

type Article = {
  category: string;
  crumb: string;
  version: string;
  title: string;
  summary: string;
  detail?: string;
  /*
   * Identifiers that appear in the article's RENDERED detail but not in its
   * summary - the endpoint path, the permission, the stored status.
   *
   * Without these, a reader could see `appointments:edit:any` on screen, type it
   * into the search box, and get "No matches", because the detail lives in JSX
   * rather than in this data. Duplicating strings invites drift, so a test
   * asserts every term here actually appears in that article once rendered.
   */
  searchTerms?: string[];
};

const ARTICLES: Record<string, Article> = {
  overview: {
    category: 'Getting started',
    crumb: 'Overview',
    version: 'v1',
    title: 'Overview',
    summary:
      'Yosemite Crew exposes two separate API surfaces. The API-key-authenticated data plane is read-only and mounted at /v1/developer; the FHIR examples elsewhere in this reader use signed-in sessions and do not accept developer API keys.',
    detail:
      'The data plane currently serves GET /v1/developer/organizations, GET /v1/developer/usage, GET /v1/developer/appointments, and GET /v1/developer/appointments/:appointmentId. The generated reference in the full documentation includes these routes, but the backend routers remain the source of truth.',
  },
  authentication: {
    category: 'Getting started',
    crumb: 'Authentication',
    version: 'v1',
    title: 'Authentication',
    summary:
      'Send a key created in this portal as an Authorization: Bearer token to /v1/developer. The session-authenticated management routes under /v1/developers and the FHIR surface do not accept developer API keys.',
    detail:
      'GET /organizations discovers every practice where the key owner has a live active membership and needs no x-org-id. GET /usage is developer-owned and also needs no practice header. GET /appointments requires appointments:read, x-org-id, a live active membership, and appointment-read permission. GET /appointments/:appointmentId derives the practice from the record but rechecks the same live membership and permission. Keys belong to their owner rather than one permanent practice; keys created before appointments:read shipped carry no scopes and must be replaced to call appointment routes.',
  },
  appointments: {
    category: 'APIs',
    crumb: 'Appointments',
    version: 'v1',
    title: 'Appointments',
    searchTerms: ['/fhir/v1/appointment/pms', 'appointments:edit:any', 'x-org-id', 'UPCOMING'],
    summary:
      "Appointments are FHIR R4 Appointment resources under /fhir/v1/appointment. Practice writes go to /pms and mobile ones to /mobile; there is no route at the collection root. Writes land in the clinic's schedule and read back from the same router.",
  },
  companions: {
    category: 'APIs',
    crumb: 'Companions',
    version: 'v1',
    title: 'Companions',
    summary:
      'Animals are companions, served under /fhir/v1/companion and mapped to FHIR R4 Patient resources. If you are looking for a "patients" endpoint, this is it - the platform is multi-species, so the domain word is companion.',
  },
  fhir: {
    category: 'Guides',
    crumb: 'FHIR resources',
    version: 'GUIDE',
    title: 'FHIR resources',
    summary:
      'Clinical objects map to FHIR R4 resources under /fhir/v1. The generated OpenAPI reference in the full documentation lists the routes. It was generated once and committed rather than rebuilt, so treat it as a good map and the routers as the territory.',
  },
};

/*
 * A sample that works if pasted.
 *
 * This block used to POST to `https://api.yosemitecrew.com/v2/appointments`
 * with `Authorization: Bearer $YC_KEY`. There is no /v2 - the mounted prefixes
 * are /fhir, /v1, /public and /ap - and no route accepts an API key, so anyone
 * following it got a 404 from an endpoint this page badged STABLE.
 *
 * Three details that are easy to get wrong even after fixing the path, and that
 * a first correction here did get wrong:
 * - the org comes from an `Organization/...` PARTICIPANT, not from `x-org-id`.
 *   `fromFHIRAppointment` falls back to `unknown-org`, which 404s. The header is
 *   read by the permission middleware only.
 * - the submitted `status` is ignored: `createAppointmentFromPms` calls
 *   `createAppointment(dto, "UPCOMING")`, so a response can never echo
 *   `proposed`.
 * - the host is not hardcoded, because the session is issued for whichever
 *   origin `NEXT_PUBLIC_BASE_URL` names.
 * - the COMPANION'S PARENT is required, as a `RelatedPerson/...` participant.
 *   `fromFHIRAppointment` (packages/types/src/appointment.ts) reads the parent
 *   from that reference and falls back to `unknown-owner` without it;
 *   `createAppointment` then hands that literal to
 *   `assertParentManagesCompanion` and the write is refused. A sample missing
 *   it fails just as reliably as the /v2 path did, only later and with a less
 *   obvious message.
 * - `end`, `minutesDuration` and `serviceType` are read too: `endTime` falls
 *   back to "now" and `durationMinutes` to 0 when they are absent, so the
 *   appointment lands at a time nobody asked for.
 */
const CURL_SAMPLE = String.raw`curl -X POST \
  "$YC_API_BASE"/fhir/v1/appointment/pms \
  -H "Content-Type: application/json" \
  -H "x-org-id: $YC_ORG_ID" \
  --cookie "$YC_SESSION" \
  -d '{
    "resourceType": "Appointment",
    "start": "2026-07-17T10:30:00+02:00",
    "end": "2026-07-17T11:00:00+02:00",
    "minutesDuration": 30,
    "serviceType": [
      {
        "coding": [
          {
            "system": "http://example.org/appointment-types",
            "code": "<appointment-type-id>",
            "display": "Wellness exam"
          }
        ],
        "text": "Wellness exam"
      }
    ],
    "participant": [
      { "actor": { "reference": "Organization/<practice-id>" } },
      { "actor": { "reference": "Patient/<companion-id>" } },
      { "actor": { "reference": "RelatedPerson/<parent-id>" } }
    ]
  }'`;

const RESPONSE_SAMPLE = `{
  "message": "Appointment created",
  "data": { "resourceType": "Appointment", "status": "UPCOMING" }
}`;

const copyText = async (value: string): Promise<boolean> => {
  try {
    const clip = globalThis.navigator?.clipboard;
    if (clip?.writeText) {
      await clip.writeText(value);
      return true;
    }
  } catch {
    // Clipboard is unavailable or blocked — fall through to the graceful no-op.
  }
  return false;
};

const DeveloperDocs = () => {
  const [activeId, setActiveId] = useState('appointments');
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const active = ARTICLES[activeId];
  const isAppointments = activeId === 'appointments';

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    /*
     * Search the article, not just the rail label.
     *
     * Matching labels alone made the search only as good as the shortest name
     * in the rail. "api" - the first thing anyone types in an API reference -
     * returned "No matches" the moment the labels stopped happening to contain
     * the word, and the same held for any term a reader knows from the content
     * rather than from the navigation.
     */
    const matches = (item: NavItem) => {
      const article = ARTICLES[item.id];
      return [
        item.label,
        article?.category,
        article?.title,
        article?.summary,
        article?.detail,
        ...(article?.searchTerms ?? []),
      ].some((field) => field?.toLowerCase().includes(q));
    };
    return NAV.map((section) => ({
      ...section,
      items: section.items.filter(matches),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  const handleCopy = (key: string, value: string) => {
    void copyText(value).then((ok) => {
      if (ok) setCopiedKey(key);
    });
  };

  const pageText = useMemo(() => {
    const lines = [active.title, active.summary, active.detail].filter(Boolean);
    if (isAppointments) {
      lines.push(
        'Endpoint: POST /fhir/v1/appointment/pms',
        'Required scope: appointments:edit:any',
        'Practice surface, not a developer one: needs an active practice membership and appointments:edit:any. A developer-only account holds neither; calling it with a developer session returns 400 or 403.',
        'Body: FHIR R4 Appointment. Practice is read from an Organization participant (not x-org-id). Submitted status is ignored; created appointments are stored as UPCOMING. Parent must be a RelatedPerson participant.',
        'Request (cURL):\n' + CURL_SAMPLE,
        'Response (201):\n' + RESPONSE_SAMPLE,
      );
    }
    return lines.join('\n\n');
  }, [active, isAppointments]);

  return (
    <DevRouteGuard>
      <section className="DocsWrapper">
        <div className="DocsHeader">
          <Link href="/developers/home" className="DocsBackLink text-body-4-emphasis">
            <IoArrowBack size={18} />
            <span>Back to portal</span>
          </Link>
          <a
            className="DocsOpenLink text-body-4-emphasis text-text-brand"
            href={DOCS_BASE_PATH}
            target="_blank"
            rel="noreferrer"
          >
            Open full docs
          </a>
        </div>

        <div className="DocsShell">
          <nav className="DocsNav" aria-label="Documentation">
            <div className="DocsNavBrand">
              <div className="DocsNavBrandText">
                <span className="DocsNavBrandTitle">Docs</span>
                <span className="DocsNavBrandKicker">Developer</span>
              </div>
            </div>
            <div className="DocsSearch">
              <IoSearchOutline size={13} aria-hidden="true" />
              <input
                className="DocsSearchInput"
                type="search"
                placeholder="Search docs"
                aria-label="Search docs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {filteredNav.length === 0 ? (
              <div className="DocsNavEmpty">No matches</div>
            ) : (
              filteredNav.map((section, index) => (
                <React.Fragment key={section.heading}>
                  <span className={`DocsNavSection${index > 0 ? ' spaced' : ''}`}>
                    {section.heading}
                  </span>
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`DocsNavItem${item.id === activeId ? ' is-active' : ''}`}
                      aria-current={item.id === activeId ? 'page' : undefined}
                      onClick={() => setActiveId(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </React.Fragment>
              ))
            )}

            <a className="DocsNavGithub" href={GITHUB_EDIT_URL} target="_blank" rel="noreferrer">
              <IoLogoGithub size={14} />
              Edit on GitHub
            </a>
          </nav>

          <div className="DocsMain">
            <div className="DocsMainHead">
              <span className="DocsBreadcrumb">
                Docs / {active.category} / <strong>{active.crumb}</strong>
              </span>
              <span className="DocsMainHeadActions">
                <span className="DocsVersionBadge">{active.version}</span>
                <button
                  type="button"
                  className="DocsCopyBtn"
                  onClick={() => handleCopy('page', pageText)}
                >
                  <IoCopyOutline size={12} aria-hidden="true" />
                  {copiedKey === 'page' ? 'Copied' : 'Copy page'}
                </button>
              </span>
            </div>

            <div className="DocsBody">
              <article className="DocsArticle">
                <h3 className="DocsArticleTitle">{active.title}</h3>
                <p className="DocsArticleText">{active.summary}</p>
                {active.detail && <p className="DocsArticleText">{active.detail}</p>}

                {isAppointments ? (
                  <>
                    <div className="DocsEndpoint">
                      <span className="DocsMethod">POST</span>
                      <span className="DocsEndpointPath">/fhir/v1/appointment/pms</span>
                      <span className="DocsEndpointScope">appointments:edit:any</span>
                    </div>
                    <p className="DocsArticleText">
                      <strong>This is a practice surface, not a developer one.</strong> It needs an
                      active practice membership and{' '}
                      <code className="DocsInlineCode">appointments:edit:any</code>, and a
                      developer-only account holds neither - there is no developer role in the
                      permission model, so signing up through the developer door grants no
                      organisation access. Calling it with a developer session returns 400 or 403.
                      It is documented because it is the shape the API takes, not because you can
                      call it today.
                    </p>
                    <p className="DocsArticleText">
                      The body is a FHIR R4 Appointment, and the practice is read from an{' '}
                      <code className="DocsInlineCode">Organization</code> participant rather than
                      from <code className="DocsInlineCode">x-org-id</code>, which the permission
                      middleware reads separately. There is no route at the collection root - the
                      practice surface is <code className="DocsInlineCode">/pms</code> and the
                      mobile one is <code className="DocsInlineCode">/mobile</code>. The submitted{' '}
                      <code className="DocsInlineCode">status</code> is ignored; a created
                      appointment is stored as <code className="DocsInlineCode">UPCOMING</code>.
                    </p>
                    <div className="DocsNote">
                      <IoBulbOutline
                        size={15}
                        className="shrink-0 mt-0.5 text-cyan-text"
                        aria-hidden="true"
                      />
                      <span className="DocsNoteText">
                        Appointments are FHIR R4 <code className="DocsInlineCode">Appointment</code>{' '}
                        resources. Anything you write here reads back identically from the FHIR
                        endpoint.
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="DocsNote">
                    <IoBulbOutline
                      size={15}
                      className="text-cyan-text"
                      style={{ flex: 'none', marginTop: 2 }}
                      aria-hidden="true"
                    />
                    <span className="DocsNoteText">
                      This reference is seed content. Open the full documentation for the complete
                      API reference.
                    </span>
                  </div>
                )}
              </article>

              {isAppointments && (
                <div className="DocsCode">
                  <div className="DocsCodePanel">
                    <div className="DocsCodePanelHead">
                      <span className="DocsCodePanelLabel">REQUEST · cURL</span>
                      <button
                        type="button"
                        className="DocsCodeCopy"
                        onClick={() => handleCopy('request', CURL_SAMPLE)}
                      >
                        <IoCopyOutline size={11} aria-hidden="true" />
                        {copiedKey === 'request' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="DocsCodePre">{CURL_SAMPLE}</pre>
                  </div>
                  <div className="DocsCodePanel">
                    <div className="DocsCodePanelHead">
                      <span className="DocsCodePanelLabel">RESPONSE · 201</span>
                      <button
                        type="button"
                        className="DocsCodeCopy"
                        onClick={() => handleCopy('response', RESPONSE_SAMPLE)}
                      >
                        <IoCopyOutline size={11} aria-hidden="true" />
                        {copiedKey === 'response' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="DocsCodePre">{RESPONSE_SAMPLE}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </DevRouteGuard>
  );
};

export default DeveloperDocs;
