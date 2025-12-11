import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import { FormField } from "@/app/types/forms";

type ServiceGroupRendererProps = {
  field: FormField & { type: "service-group" };
  value: string[];
  onChange: (v: string[]) => void;
  serviceOptions: { label: string; value: string }[];
  readOnly?: boolean;
};

const ServiceGroupRenderer: React.FC<ServiceGroupRendererProps> = ({
  field,
  value,
  onChange,
  serviceOptions,
  readOnly = false,
}) => {
  const options = serviceOptions ?? [];
  const resolvedValue = Array.isArray(value) ? value : [];

  if (readOnly) {
    const displayValues = resolvedValue
      .map((val) => options.find((o) => o.value === val)?.label ?? val)
      .filter(Boolean);
    return (
      <div className="flex flex-col gap-2">
        <div className="font-grotesk text-black-text text-[16px] font-medium">
          {field.label || "Services"}
        </div>
        {displayValues.length ? (
          <div className="flex flex-wrap gap-2">
            {displayValues.map((label) => (
              <span
                key={label}
                className="px-3! py-1.5! rounded-2xl border border-grey-light text-[14px] text-black-text"
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[14px] text-grey-dark">No services selected</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="font-grotesk text-black-text text-[16px] font-medium">
        {field.label || "Services"}
      </div>
      <MultiSelectDropdown
        placeholder={field.placeholder || "Select services"}
        value={resolvedValue}
        onChange={onChange}
        options={options}
        className="min-h-12!"
        dropdownClassName="!h-fit"
      />
    </div>
  );
};

export default ServiceGroupRenderer;
