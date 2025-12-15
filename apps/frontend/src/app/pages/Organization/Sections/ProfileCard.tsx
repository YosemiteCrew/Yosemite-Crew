import { Primary, Secondary } from "@/app/components/Buttons";
import { getFormattedDate } from "@/app/components/Calendar/weekHelpers";
import Datepicker from "@/app/components/Inputs/Datepicker";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import { usePrimaryOrgProfile } from "@/app/hooks/useProfiles";
import { useAuthStore } from "@/app/stores/authStore";
import { isHttpsImageUrl } from "@/app/utils/urls";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { RiEdit2Fill } from "react-icons/ri";

type FieldConfig = {
  label: string;
  key: string;
  type?: string;
  required?: boolean;
  editable?: boolean;
  options?: Array<string | { label: string; value: string }>;
};

type ProfileCardProps = {
  title: string;
  fields: FieldConfig[];
  org: Record<string, any>;
  showProfile?: boolean;
  showProfileUser?: boolean;
  editable?: boolean;
  onSave?: (values: Record<string, string>) => Promise<void> | void;
};

const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "active":
      return { color: "#008F5D", backgroundColor: "#E6F4EF" };
    case "pending":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    default:
      return { color: "", backgroundColor: "" };
  }
};

type FormValues = Record<string, any>;

const resolveLabel = (
  options: Array<{ label: string; value: string }>,
  value: string
) => options.find((o) => o.value === value)?.label ?? value;

const normalizeOptions = (
  options?: Array<string | { label: string; value: string }>
) =>
  options?.map((option: any) =>
    typeof option === "string" ? { label: option, value: option } : option
  ) ?? [];

const buildInitialValues = (
  fields: FieldConfig[],
  data: Record<string, any>
): FormValues =>
  fields.reduce((acc, field) => {
    const initialValue = data?.[field.key];
    if (field.type === "multiSelect") {
      let value: string[] = [];
      if (Array.isArray(initialValue)) value = initialValue;
      else if (typeof initialValue === "string" && initialValue.trim() !== "")
        value = [initialValue];
      acc[field.key] = value;
      return acc;
    }
    acc[field.key] = initialValue ?? "";
    return acc;
  }, {} as FormValues);

const getRequiredError = (
  field: FieldConfig,
  value: any
): string | undefined => {
  if (!field.required) return undefined;
  const label = `${field.label} is required`;
  if (Array.isArray(value)) return value.length ? undefined : label;
  if (field.type === "date") return value ? undefined : label;
  if (field.type === "number") return value ? undefined : label;
  return (value ?? "").toString().trim() ? undefined : label;
};

const FieldComponents: Record<
  string,
  React.FC<{
    field: FieldConfig;
    value: any;
    error?: string;
    onChange: (v: any) => void;
  }>
> = {
  text: ({ field, value, onChange, error }) => (
    <FormInput
      intype="text"
      inname={field.key}
      value={value}
      inlabel={field.label}
      error={error}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12!"
    />
  ),
  number: ({ field, value, onChange, error }) => (
    <FormInput
      intype="number"
      inname={field.key}
      value={value}
      inlabel={field.label}
      error={error}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12!"
    />
  ),
  select: ({ field, value, onChange }) => (
    <Dropdown
      placeholder={field.label}
      value={value || ""}
      onChange={(e) => onChange(e)}
      className="min-h-12!"
      dropdownClassName="top-[55px]! !h-fit"
      options={field.options || []}
    />
  ),
  dropdown: ({ field, value, onChange }) => (
    <Dropdown
      placeholder={field.label}
      value={value || ""}
      onChange={(e) => onChange(e)}
      className="min-h-12!"
      dropdownClassName="top-[55px]! !h-fit"
      options={field.options || []}
    />
  ),
  multiSelect: ({ field, value, onChange }) => (
    <MultiSelectDropdown
      placeholder={field.label}
      value={value || []}
      onChange={(e) => onChange(e)}
      className="min-h-12!"
      options={field.options || []}
      dropdownClassName="h-fit!"
    />
  ),
  country: ({ field, value, onChange }) => (
    <Dropdown
      placeholder={field.label}
      value={value || ""}
      onChange={(e) => onChange(e)}
      className="min-h-12!"
      dropdownClassName="top-[55px]! !h-fit"
      type="country"
      search
    />
  ),
  date: ({ field, value, onChange }) => (
    <Datepicker
      currentDate={value}
      setCurrentDate={onChange}
      type="input"
      placeholder={field.label}
    />
  ),
  dateString: ({ field, value, onChange }) => {
    const fallback = new Date();
    const currentDate = toDateOrFallback(value, fallback);
    const setCurrentDate: React.Dispatch<React.SetStateAction<Date>> = (
      action
    ) => {
      const next = typeof action === "function" ? action(currentDate) : action;
      onChange(next);
    };
    return (
      <Datepicker
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        type="input"
        placeholder={field.label}
      />
    );
  },
};

const FieldValueRow: React.FC<{
  label: string;
  value: React.ReactNode;
  showDivider: boolean;
}> = ({ label, value, showDivider }) => (
  <div
    className={`px-6! py-3! flex items-center gap-2 ${showDivider ? "border-b border-b-grey-light" : ""}`}
  >
    <div className="font-satoshi font-semibold text-grey-noti text-[18px]">
      {label}:
    </div>
    <div className="font-satoshi font-semibold text-black-text text-[18px] overflow-scroll scrollbar-hidden">
      {value ?? "-"}
    </div>
  </div>
);

const toDateOrFallback = (raw: any, fallback: Date) => {
  const d = toDateOrNull(raw); // your helper from earlier
  return d ?? fallback;
};

const toDateOrNull = (raw: any): Date | null => {
  if (!raw) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === "number") {
    const ms = raw < 1e12 ? raw * 1000 : raw; // allow seconds
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const dt = new Date(y, mo, d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
};

const renderValue = (field: FieldConfig, formValues: FormValues) => {
  const type = field.type || "text";
  const raw = formValues[field.key];
  if (type === "date") {
    const dt = toDateOrNull(raw);
    return dt ? getFormattedDate(dt) : "-";
  }
  if (type === "dateString") {
    const dt = toDateOrNull(raw);
    return dt ? getFormattedDate(dt) : "-";
  }
  if (type === "multiSelect") {
    const options = normalizeOptions(field.options);
    const isArray = Array.isArray(raw);
    const tempRaw = raw ? [raw] : [];
    const arr = isArray ? raw : tempRaw;
    if (!arr.length) return "-";
    if (options.length)
      return arr.map((v) => resolveLabel(options, v)).join(", ");
    return arr.join(", ");
  }
  if (type === "select" || type === "dropdown") {
    const options = normalizeOptions(field.options);
    if (!raw) return "-";
    return options.length ? resolveLabel(options, raw) : raw;
  }
  return raw || "-";
};

const ProfileCard = ({
  title,
  fields,
  org,
  showProfile,
  showProfileUser,
  editable = true,
  onSave,
}: ProfileCardProps) => {
  const profile = usePrimaryOrgProfile();
  const attributes = useAuthStore((s) => s.attributes);
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(() =>
    buildInitialValues(fields, org)
  );
  const [formValuesErrors, setFormValuesErrors] = useState<
    Record<string, string | undefined>
  >({});

  useEffect(() => {
    setFormValues(buildInitialValues(fields, org));
    setFormValuesErrors({});
  }, [org, fields]);

  const isActuallyEditable = useMemo(
    () => editable && !!onSave,
    [editable, onSave]
  );

  const handleChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setFormValuesErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (!field.required) continue;
      if (!field.editable) continue;
      const err = getRequiredError(field, formValues[field.key]);
      if (err) errors[field.key] = err;
    }
    setFormValuesErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCancel = () => {
    setFormValues(buildInitialValues(fields, org));
    setFormValuesErrors({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await onSave?.(formValues);
      setIsEditing(false);
    } catch (error) {
      console.error("Error in ProfileCard onSave:", error);
    }
  };

  return (
    <div className="border border-grey-light rounded-2xl">
      <div className="px-6! py-4! border-b border-b-grey-light flex items-center justify-between">
        <div className="font-grotesk font-medium text-black-text text-[19px]">
          {title}
        </div>
        {isActuallyEditable && !isEditing && (
          <RiEdit2Fill
            size={20}
            color="#302f2e"
            className="cursor-pointer"
            onClick={() => setIsEditing(true)}
          />
        )}
      </div>
      <div className={`px-3! py-2! flex flex-col`}>
        {showProfileUser && (
          <div className="px-6! py-3! flex gap-3 items-center">
            <Image
              src={
                isHttpsImageUrl(profile?.personalDetails?.profilePictureUrl)
                  ? profile?.personalDetails?.profilePictureUrl
                  : "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
              }
              alt="Logo"
              height={60}
              width={60}
              className="rounded-full object-cover h-[60px] min-w-[60px] max-h-[60px]"
            />
            <div className="font-grotesk font-medium text-black-text text-[28px]">
              {(attributes?.given_name || "") +
                " " +
                (attributes?.family_name || "")}
            </div>
          </div>
        )}
        {showProfile && (
          <div className="px-6! py-3! flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src={
                    org.imageURL ||
                    "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
                  }
                  alt="Logo"
                  height={60}
                  width={60}
                  className="rounded-full object-cover h-[60px] min-w-[60px] max-h-[60px]"
                />
                <div className="flex flex-col">
                  <div className="font-grotesk font-medium text-black-text text-[28px]">
                    {org.name}
                  </div>
                  <div
                    className="px-3.5! py-1.5! rounded-xl w-fit font-satoshi font-semibold text-[16px]"
                    style={getStatusStyle(
                      org.isVerified ? "Active" : "Pending"
                    )}
                  >
                    {org.isVerified ? "Active" : "Pending"}
                  </div>
                </div>
              </div>
              {!org?.isVerified && (
                <Primary
                  text="Book onboarding call"
                  href="/book-onboarding"
                  classname=""
                />
              )}
            </div>
            {!org?.isVerified && (
              <div className="font-satoshi font-medium text-grey-noti text-[18px]">
                <span className="text-[#247AED]">Note : </span>This short chat
                helps us confirm your business and add you to our trusted
                network of verified pet professionals - so you can start
                connecting with clients faster.
              </div>
            )}
          </div>
        )}
        {fields.map((field, index) => {
          const type = field.type || "text";
          const Component = FieldComponents[type] || FieldComponents.text;
          const showDivider = index !== fields.length - 1;
          return (
            <div key={field.key}>
              {isEditing && field.editable ? (
                <div className="flex-1 py-2 px-2">
                  <Component
                    field={field}
                    value={formValues[field.key]}
                    error={formValuesErrors[field.key]}
                    onChange={(v) => handleChange(field.key, v)}
                  />
                </div>
              ) : (
                <FieldValueRow
                  label={field.label}
                  value={renderValue(field, formValues)}
                  showDivider={showDivider}
                />
              )}
            </div>
          );
        })}
      </div>
      {isEditing && (
        <div className="px-6! py-4! flex items-center justify-end w-full gap-3">
          <Secondary
            text="Cancel"
            href="#"
            className="h-13!"
            onClick={handleCancel}
          />
          <Primary
            text="Save"
            href="#"
            classname="h-13!"
            onClick={handleSave}
          />
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
