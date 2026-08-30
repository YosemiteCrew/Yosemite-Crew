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

const DOCS_BASE_PATH = '/dev-docs/index.html';
const GITHUB_EDIT_URL = 'https://github.com/YosemiteCrew/Yosemite-Crew/tree/dev/apps/dev-docs';

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
};

const ARTICLES: Record<string, Article> = {
  overview: {
    category: 'Getting started',
    crumb: 'Overview',
    version: 'v1',
    title: 'Overview',
    summary:
      'The Yosemite Crew API is a FHIR R4 surface served under /fhir/v1, alongside a set of application endpoints under /v1. Requests are authorised with the session your account already holds. The complete generated reference, including every route and payload, is in the full documentation.',
  },
  authentication: {
    category: 'Getting started',
    crumb: 'Authentication',
    version: 'v1',
    title: 'Authentication',
    summary:
      'Requests are authorised with the signed-in session, and organisation-scoped routes read the practice from an x-org-id header. API keys created in this portal are not yet accepted by any endpoint: the key-authentication middleware exists but is not mounted on a route, so a key will not authenticate a request today. Create keys if you want them ready; build against a session until key auth ships.',
  },
  appointments: {
    category: 'APIs',
    crumb: 'Appointments',
    version: 'v1',
    title: 'Appointments',
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
      'Clinical objects map to FHIR R4 resources under /fhir/v1. The generated OpenAPI reference in the full documentation lists the routes that exist today, which is the list worth trusting.',
  },
};

/*
 * A sample that works if pasted.
 *
 * This block used to POST to `https://api.yosemitecrew.com/v2/appointments`
 * with `Authorization: Bearer $YC_KEY`. There is no /v2 - the mounted prefixes
 * are /fhir, /v1, /public and /ap - and no route accepts an API key, so anyone
 * following it got a 404 from an endpoint this page badged STABLE. The signed-in
 * session is how the API is actually reached today.
 */
const CURL_SAMPLE = String.raw`curl -X POST \
  https://devapi.yosemitecrew.com/fhir/v1/appointment/pms \
  -H "Content-Type: application/json" \
  -H "x-org-id: $YC_ORG_ID" \
  --cookie "$YC_SESSION" \
  -d '{
    "resourceType": "Appointment",
    "status": "proposed",
    "start": "2026-07-17T10:30:00+02:00",
    "participant": [
      { "actor": { "reference": "Patient/<companion-id>" } }
    ]
  }'`;

const RESPONSE_SAMPLE = `{
  "message": "Appointment created",
  "data": { "resourceType": "Appointment", "status": "proposed" }
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
    return NAV.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.label.toLowerCase().includes(q)),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  const handleCopy = (key: string, value: string) => {
    void copyText(value).then((ok) => {
      if (ok) setCopiedKey(key);
    });
  };

  const pageText = `${active.title}\n\n${active.summary}`;

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

                {isAppointments ? (
                  <>
                    <div className="DocsEndpoint">
                      <span className="DocsMethod">POST</span>
                      <span className="DocsEndpointPath">/fhir/v1/appointment/pms</span>
                      <span className="DocsEndpointScope">appointments:edit:any</span>
                    </div>
                    <p className="DocsArticleText">
                      Authorised by the signed-in session, scoped to the practice named in{' '}
                      <code className="DocsInlineCode">x-org-id</code>, and gated on{' '}
                      <code className="DocsInlineCode">appointments:edit:any</code>. The body is a
                      FHIR R4 Appointment. There is no route at the collection root - the practice
                      surface is <code className="DocsInlineCode">/pms</code> and the mobile one is{' '}
                      <code className="DocsInlineCode">/mobile</code>. The generated OpenAPI
                      reference in the full documentation is the authority here, because it is
                      produced from the routes themselves rather than written by hand.
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
