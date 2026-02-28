import { FormField, FormFieldType } from '@/app/features/forms/types/forms';
import DropdownRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Dropdown/DropdownRenderer';
import InputRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Input/InputRenderer';
import SignatureRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Signature/SignatureRenderer';
import TextRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Text/TextRenderer';
import BooleanRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Boolean/BooleanRenderer';
import DateRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Date/DateRenderer';

const humanizeKey = (key: string): string => {
  const withSpaces = key
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return withSpaces
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getFallbackValue = (field: FormField) => {
  if (field.type === 'checkbox') return [];
  if (field.type === 'boolean') return false;
  if (field.type === 'number' || field.type === 'date') return '';
  if (field.type === 'textarea' || field.type === 'input') {
    return field.placeholder || '';
  }
  return '';
};

type RuntimeRendererProps = {
  field: any;
  value: any;
  onChange: (v: any) => void;
  readOnly?: boolean;
};

const runtimeComponentMap: Record<FormFieldType, React.ComponentType<RuntimeRendererProps>> = {
  textarea: TextRenderer as any,
  input: InputRenderer as any,
  number: InputRenderer as any,
  dropdown: DropdownRenderer as any,
  radio: DropdownRenderer as any,
  checkbox: DropdownRenderer as any,
  boolean: BooleanRenderer as any,
  date: DateRenderer as any,
  signature: SignatureRenderer as any,
  group: (() => null) as any,
};

type FormRendererProps = {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (id: string, value: any) => void;
  readOnly?: boolean;
  depth?: number;
};

export const FormRenderer: React.FC<FormRendererProps> = ({
  fields,
  values,
  onChange,
  readOnly = false,
  depth = 0,
}) => {
  const getInteractiveTarget = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof HTMLElement)) return null;
    return target.closest(
      "input, textarea, select, button, a, [tabindex], [contenteditable='true']"
    ) as HTMLElement | null;
  };

  const preventReadOnlyFocus: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!readOnly) return;
    const interactive = getInteractiveTarget(e.target);
    if (!interactive) return;
    e.preventDefault();
    interactive.blur?.();
  };

  const handleReadOnlyFocusCapture: React.FocusEventHandler<HTMLDivElement> = (e) => {
    if (!readOnly) return;
    const interactive = getInteractiveTarget(e.target);
    if (!interactive) return;
    interactive.blur?.();
  };

  const isMedicationLikeGroup = (field: FormField): boolean =>
    Boolean(field.meta?.medicationGroup || field.meta?.medicineId) ||
    /medication|medications/i.test(field.id ?? '');

  const getGroupContainerClass = (level: number, medicationGroup: boolean): string => {
    if (level === 0) {
      return 'rounded-2xl border border-card-border bg-white px-4 py-4';
    }
    if (medicationGroup) {
      return 'rounded-xl border border-card-border bg-white px-3 py-3';
    }
    if (level === 1) {
      return 'rounded-xl border border-grey-light bg-white px-3 py-3';
    }
    return 'rounded-lg border-l-2 border-card-border bg-white px-3 py-2';
  };

  const getGroupTitleClass = (level: number): string =>
    level <= 1
      ? 'font-grotesk text-black-text text-[18px] font-medium'
      : 'font-grotesk text-black-text text-[16px] font-medium';

  const labelForField = (field: FormField): string => {
    const label = (field.label ?? '').trim();
    const id = field.id ?? '';
    if (label && label !== id) return label;
    if (/_services$/i.test(id)) return 'Services';
    return humanizeKey(id || 'Field');
  };

  return (
    <div
      className="flex flex-col gap-3"
      onPointerDownCapture={preventReadOnlyFocus}
      onFocusCapture={handleReadOnlyFocusCapture}
    >
      {fields.map((field) => {
        const fieldWithLabel: FormField = { ...field, label: labelForField(field) };
        if (field.type === 'group') {
          const medicationGroup = isMedicationLikeGroup(field);
          return (
            <div
              key={field.id}
              className={`${getGroupContainerClass(depth, medicationGroup)} flex flex-col gap-3`}
            >
              <div className={getGroupTitleClass(depth)}>{fieldWithLabel.label || 'Group'}</div>
              <FormRenderer
                fields={field.fields ?? []}
                values={values}
                onChange={onChange}
                readOnly={readOnly}
                depth={depth + 1}
              />
            </div>
          );
        }

        const Component = runtimeComponentMap[field.type];
        const existingValue = values[field.id];
        const defaultValue = (field as any).defaultValue;
        const value = existingValue ?? defaultValue ?? getFallbackValue(field);
        return (
          <Component
            key={field.id}
            field={fieldWithLabel}
            value={value}
            onChange={(v: any) => onChange(field.id, v)}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
};

export default FormRenderer;
