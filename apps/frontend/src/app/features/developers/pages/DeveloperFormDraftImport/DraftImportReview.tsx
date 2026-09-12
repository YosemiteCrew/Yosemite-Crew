'use client';
import React from 'react';

import { Secondary } from '@/app/ui/primitives/Buttons';
import type { DraftImportView } from '@/app/services/formDraftImportService';

const CHANGE_LABEL: Record<DraftImportView['diff'][number]['change'], string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  unchanged: 'Unchanged',
};

/**
 * Renders one completed create/get response: the proposed fields, every
 * unsupported construct (never silently dropped - #3060's own acceptance
 * criterion), the diff against the source form's latest published version,
 * and a staleness banner when the source changed since this draft was made.
 *
 * Owns no server state - the page passes the current view down and this
 * component only decides how to lay it out.
 */
const DraftImportReview = ({
  view,
  refreshing,
  discarding,
  onRefresh,
  onDiscard,
}: {
  view: DraftImportView;
  refreshing: boolean;
  discarding: boolean;
  onRefresh: () => void;
  onDiscard: () => void;
}) => {
  const changed = view.diff.filter((entry) => entry.change !== 'unchanged');

  return (
    <div className="DraftImport-review">
      {view.stale && (
        <div className="DraftImport-stale" role="status">
          <p>
            The source form changed since this draft was created. Refresh to see the current diff
            before deciding.
          </p>
          <Secondary
            text={refreshing ? 'Refreshing…' : 'Refresh'}
            onClick={onRefresh}
            isDisabled={refreshing}
            style={{ maxWidth: 140 }}
          />
        </div>
      )}

      {view.unsupportedConstructs.length > 0 && (
        <section className="DraftImport-section yc-card-surface">
          <h2 className="text-heading-3 text-text-primary">
            Unsupported constructs ({view.unsupportedConstructs.length})
          </h2>
          <ul className="DraftImport-unsupportedList">
            {view.unsupportedConstructs.map((item) => (
              <li key={`${item.line}-${item.raw}`}>
                <span className="DraftImport-unsupportedLine">Line {item.line}:</span>{' '}
                <code>{item.raw}</code>
                <p className="text-caption-2 text-text-tertiary">{item.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="DraftImport-section yc-card-surface">
        <h2 className="text-heading-3 text-text-primary">Proposed fields ({view.fields.length})</h2>
        {view.fields.length === 0 ? (
          <p className="text-body-3 text-text-secondary">No supported fields were parsed.</p>
        ) : (
          <ul className="DraftImport-fieldList">
            {view.fields.map((field) => (
              <li key={field.id}>
                <span className="DraftImport-fieldLabel">{field.label}</span>
                <span className="DraftImport-badge DraftImport-badge--type">{field.type}</span>
                {field.required && (
                  <span className="DraftImport-badge DraftImport-badge--required">Required</span>
                )}
                {field.options && field.options.length > 0 && (
                  <span className="text-caption-2 text-text-tertiary">
                    {field.options.map((option) => option.label).join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="DraftImport-section yc-card-surface">
        <h2 className="text-heading-3 text-text-primary">
          Diff against published version ({changed.length} changed)
        </h2>
        {view.diff.length === 0 ? (
          <p className="text-body-3 text-text-secondary">
            No source form was selected, so there is nothing to diff against.
          </p>
        ) : (
          <ul className="DraftImport-diffList">
            {view.diff.map((entry) => (
              <li key={entry.id}>
                <span
                  className={`DraftImport-badge DraftImport-badge--${entry.change}`}
                  data-testid={`diff-${entry.id}`}
                >
                  {CHANGE_LABEL[entry.change]}
                </span>
                <span className="DraftImport-fieldLabel">
                  {entry.after?.label ?? entry.before?.label ?? entry.id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="DraftImport-reviewActions">
        <Secondary
          text={discarding ? 'Discarding…' : 'Discard draft'}
          onClick={onDiscard}
          isDisabled={discarding}
          style={{ maxWidth: 160 }}
        />
      </div>
    </div>
  );
};

export default DraftImportReview;
