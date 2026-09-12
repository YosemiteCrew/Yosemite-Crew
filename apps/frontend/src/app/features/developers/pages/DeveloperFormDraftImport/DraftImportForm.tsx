'use client';
import React, { useState } from 'react';

import { Primary } from '@/app/ui/primitives/Buttons';
import { Textarea } from '@/app/ui/Input';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import type { DropdownOption } from '@/app/hooks/useDropdown';

export interface DraftImportFormInput {
  suppliedText: string;
  sourceFormId?: string;
}

const GRAMMAR_HELP =
  'One field per line: label | type | required|optional | option1, option2. ' +
  'Type must be one of input, textarea, richtext, number, dropdown, radio, checkbox, ' +
  'boolean, date, signature. The required/optional segment and options are optional; ' +
  'dropdown/radio/checkbox need a comma-separated options segment.';

/**
 * Owns its own field state, matching CreateKeyForm: the page decides what
 * happens with a submission, this component only decides when one is valid.
 */
const DraftImportForm = ({
  sourceOptions,
  submitting,
  onSubmit,
}: {
  sourceOptions: DropdownOption[];
  submitting: boolean;
  onSubmit: (input: DraftImportFormInput) => void;
}) => {
  const [suppliedText, setSuppliedText] = useState('');
  const [sourceFormId, setSourceFormId] = useState<string | undefined>(undefined);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!suppliedText.trim() || submitting) return;
    onSubmit({ suppliedText, sourceFormId });
  };

  return (
    <form className="DraftImport-form yc-card-surface" onSubmit={handleSubmit}>
      <label className="text-body-3 text-text-primary" htmlFor="draftImportSourceForm">
        Existing form (optional)
      </label>
      <LabelDropdown
        placeholder="Existing form"
        options={sourceOptions}
        onSelect={(option) => setSourceFormId(option.value || undefined)}
        noOptionsMessage="No published forms to compare against"
        searchable
      />

      <label className="text-body-3 text-text-primary" htmlFor="draftImportSuppliedText">
        Supplied form text
      </label>
      <Textarea
        id="draftImportSuppliedText"
        className="DraftImport-textarea"
        value={suppliedText}
        onChange={(event) => setSuppliedText(event.target.value)}
        placeholder={
          'Patient name | input | required\nConsent to treatment | boolean | required\n' +
          'Preferred contact method | dropdown | optional | Email, Phone, Text'
        }
        rows={10}
        maxLength={20_000}
        aria-describedby="draftImportGrammarHelp"
      />
      <p id="draftImportGrammarHelp" className="text-caption-2 text-text-tertiary">
        {GRAMMAR_HELP}
      </p>

      <div className="DraftImport-formActions">
        <Primary
          text={submitting ? 'Importing…' : 'Preview import'}
          type="submit"
          isDisabled={!suppliedText.trim() || submitting}
          style={{ maxWidth: 200 }}
        />
      </div>
    </form>
  );
};

export default DraftImportForm;
