import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import { FormField } from "@/app/types/forms";

type ServiceGroupBuilderProps = {
  field: FormField & { type: "service-group" };
  onChange: (f: FormField) => void;
  serviceOptions?: { label: string; value: string }[];
};

const ServiceGroupBuilder: React.FC<ServiceGroupBuilderProps> = ({
  field,
  onChange,
  serviceOptions = [],
}) => {
  return (
    <div className="flex flex-col gap-3">
      <FormInput
        intype="text"
        inname="Label"
        value={field.label || ""}
        inlabel="Label"
        onChange={(e) => onChange({ ...field, label: e.target.value })}
        className="min-h-12!"
      />
      <MultiSelectDropdown
        placeholder="Select services"
        value={field.services ?? []}
        onChange={(services) => onChange({ ...field, services })}
        options={serviceOptions}
        className="min-h-12!"
        dropdownClassName="!h-fit"
      />
    </div>
  );
};

export default ServiceGroupBuilder;
