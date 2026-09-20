'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import PermissionGate from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { logger } from '@/app/lib/logger';
import { useOrgStore } from '@/app/stores/orgStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { loadForms } from '@/app/features/forms/services/formService';
import {
  createDraftImport,
  discardDraftImport,
  getDraftImport,
  type DraftImportView,
} from '@/app/services/formDraftImportService';

import DraftImportForm, { type DraftImportFormInput } from './DraftImportForm';
import DraftImportReview from './DraftImportReview';

import './DeveloperFormDraftImport.css';
import '@/app/features/organizations/styles/Organizations.css';

/**
 * Review surface for #3055's deterministic supplied-text-to-draft-form
 * import: paste text, preview the proposed fields and the diff against an
 * existing form, then keep (via the existing form editor/publish flow,
 * untouched here) or discard.
 *
 * Owns the data and the three requests (create/refresh/discard); the form and
 * the review are separate presentational components, same split as
 * DeveloperApiKeys/CreateKeyForm/KeyTable.
 */
const DeveloperFormDraftImport = () => {
  const primaryOrgId = useOrgStore((state) => state.primaryOrgId);
  const formIds = useFormsStore((state) => state.formIds);
  const formsById = useFormsStore((state) => state.formsById);
  const forms = useMemo(() => formIds.map((id) => formsById[id]), [formIds, formsById]);

  const [view, setView] = useState<DraftImportView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadForms().catch((err) => logger.error('Failed to load forms for draft import', err));
  }, []);

  // Only a form with a real backend id and a published version is a usable
  // diff base; the backend's loadSourceForm looks up Form.id directly and a
  // 404 there would otherwise read as an inexplicable error on submit.
  const sourceOptions = useMemo(
    () =>
      forms
        .filter((form) => Boolean(form._id) && form.status === 'Published')
        .map((form) => ({ value: form._id as string, label: form.name })),
    [forms]
  );

  const handleSubmit = async (input: DraftImportFormInput) => {
    if (!primaryOrgId) {
      setError('No organisation selected.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createDraftImport(primaryOrgId, input);
      setView(created);
    } catch (err) {
      logger.error('Failed to create form draft import', err);
      setError('Could not import the supplied text. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!primaryOrgId || !view) return;
    setRefreshing(true);
    setError(null);
    try {
      const refreshed = await getDraftImport(primaryOrgId, view.id);
      setView(refreshed);
    } catch (err) {
      logger.error('Failed to refresh form draft import', err);
      setError('Could not refresh this draft. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [primaryOrgId, view]);

  const handleDiscard = async () => {
    if (!primaryOrgId || !view) return;
    setDiscarding(true);
    setError(null);
    try {
      await discardDraftImport(primaryOrgId, view.id);
      setView(null);
    } catch (err) {
      logger.error('Failed to discard form draft import', err);
      setError(
        'Could not discard this draft. It may already have been published - open it from Forms instead.'
      );
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <DevRouteGuard>
      <PermissionGate
        anyOf={[PERMISSIONS.FORMS_VIEW_ANY]}
        deniedResource="Intake form import"
        orgId={primaryOrgId}
      >
        <div className="OperationsWrapper">
          <div className="TitleContainer">
            <h1 className="text-heading-1 text-text-primary">Intake form draft import</h1>
          </div>

          <p className="text-body-3 text-text-secondary DraftImport-intro">
            Paste supplied intake-form text to preview the fields it would create and how they
            differ from an existing form&apos;s published version. Nothing is published from here -
            review the draft, then use the existing form editor to publish or discard it.
          </p>

          {error && (
            <p className="text-body-3 DraftImport-error" role="alert">
              {error}
            </p>
          )}

          {!view && (
            <DraftImportForm
              sourceOptions={sourceOptions}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          )}

          {view && (
            <DraftImportReview
              view={view}
              refreshing={refreshing}
              discarding={discarding}
              onRefresh={handleRefresh}
              onDiscard={handleDiscard}
            />
          )}
        </div>
      </PermissionGate>
    </DevRouteGuard>
  );
};

export default DeveloperFormDraftImport;
