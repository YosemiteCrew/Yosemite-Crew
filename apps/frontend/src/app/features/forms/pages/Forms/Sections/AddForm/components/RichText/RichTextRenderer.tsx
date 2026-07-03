import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { FormField } from '@/app/features/forms/types/forms';
import { sanitizeRichText } from '@/app/lib/richText';

/**
 * Runtime renderer for a rich-text field. Emits sanitized HTML via the shared
 * RichTextEditor so the value can be stored and sent to the backend as-is.
 */
const RichTextRenderer: React.FC<{
  field: FormField & { type: 'richtext' };
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly }) => {
  if (readOnly) {
    return (
      <div className="flex flex-col gap-2">
        {field.label && (
          <span className="font-satoshi text-black-text text-[16px] font-medium">
            {field.label}
          </span>
        )}
        <div
          className="min-h-22 text-body-4 text-text-primary leading-[150%] [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_p]:min-h-5"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(value ?? '') }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {field.label && (
        <span className="font-satoshi text-black-text text-[16px] font-medium">{field.label}</span>
      )}
      <RichTextEditor
        ariaLabel={field.label || 'Rich text'}
        value={value ?? ''}
        onChange={onChange}
        placeholder={field.placeholder || ''}
        readOnly={readOnly}
        toolbarPlacement="inline"
      />
    </div>
  );
};

export default RichTextRenderer;
