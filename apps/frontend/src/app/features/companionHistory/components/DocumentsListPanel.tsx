'use client';

import { IoDocumentTextOutline } from 'react-icons/io5';
import { cardClass } from '@/app/features/companionHistory/components/ClinicalListChrome';
import CompanionDocumentsSection from '@/app/features/documents/components/CompanionDocumentsSection';

/**
 * Every other panel on this page (Problem list, Allergies, Consents, Patient
 * flags, In-house lab results) is its own fetch-and-render component. This one
 * is a thin card shell instead: CompanionDocumentsSection already owns its own
 * fetching, filter chips (including the Requested/Generated/Signed lifecycle
 * tabs - see recordLifecycle.ts), sort toggle, upload CTA and permission gate
 * (COMPANIONS_VIEW_ANY, matching the FlagListPanel gate this is paired with
 * below) - wrapping it a second time would just duplicate that.
 */
const DocumentsListPanel = ({ companionId }: { companionId: string }) => (
  <section className={cardClass} aria-labelledby="companion-documents-heading">
    <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
      <span className="text-[var(--ink-muted)]" aria-hidden="true">
        <IoDocumentTextOutline size={17} />
      </span>
      <h2 id="companion-documents-heading" className="text-[13.5px] font-bold text-[var(--ink)]">
        Documents
      </h2>
    </header>
    <div className="px-4 py-3">
      <CompanionDocumentsSection companionId={companionId} />
    </div>
  </section>
);

export default DocumentsListPanel;
