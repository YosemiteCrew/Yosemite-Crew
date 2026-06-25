import React from 'react';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { FormField } from '@/app/features/forms/types/forms';
import { StructureLockContext } from '../BuildWrapper';

/**
 * Builder block for a rich-text field. The author sets a label and the default
 * (prefill) content that the form/template loads with. Used by SOAP / Discharge
 * templates so the prefilled clinical text renders with formatting.
 *
 * When the structure is locked (YC-default templates) the label is fixed — it renders as a
 * read-only heading and only the rich-text content stays editable. The editor sits in a titled,
 * bordered container so the preloaded content reads as a proper section rather than a bare
 * floating editor.
 */
const RichTextBuilder: React.FC<{
  field: FormField & { type: 'richtext' };
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => {
  const structureLocked = React.useContext(StructureLockContext);
  const label = field.label || 'Rich text';
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-input-border bg-surface-1 p-3">
      {structureLocked ? (
        <p className="text-body-2 font-medium text-text-primary">{label}</p>
      ) : (
        <FormInput
          intype="text"
          inname="Label"
          value={field.label || ''}
          inlabel="Label"
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          className="min-h-12!"
        />
      )}
      <p className="text-caption-2 text-text-secondary">
        Content preloaded into the workspace when this template is applied.
      </p>
      <RichTextEditor
        ariaLabel={`${label} default content`}
        value={typeof field.defaultValue === 'string' ? field.defaultValue : ''}
        onChange={(html) => onChange({ ...field, defaultValue: html })}
        placeholder="Default content shown when the form loads…"
        toolbarPlacement="inline"
      />
    </div>
  );
};

export default RichTextBuilder;
