import { CountriesOptions } from "@/app/components/AddCompanion/type";
import { Primary, Secondary } from "@/app/components/Buttons";
import { getFormattedDate } from "@/app/components/Calendar/weekHelpers";
import Datepicker from "@/app/components/Inputs/Datepicker";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import LogoUpdator from "@/app/components/UploadImage/LogoUpdator";
import { usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import { usePrimaryOrgProfile } from "@/app/hooks/useProfiles";
import { updateOrg } from "@/app/services/orgService";
import { upsertUserProfile } from "@/app/services/profileService";
import { useAuthStore } from "@/app/stores/authStore";
import { UserProfile } from "@/app/types/profile";
import { Organisation } from "@yosemite-crew/types";
import React, { useEffect, useMemo, useState } from "react";
import { RiEdit2Fill } from "react-icons/ri";

type FieldConfig = {
  label: string;
  key: string;
  type?: string;
  required?: boolean;
  editable?: boolean;
  options?: Array<{ label: string; value: string }>;
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
    <LabelDropdown
      placeholder={field.label}
      onSelect={(option) => onChange(option.value)}
      defaultOption={value}
      options={field.options || []}
    />
  ),
  dropdown: ({ field, value, onChange }) => (
    <LabelDropdown
      placeholder={field.label}
      onSelect={(option) => onChange(option.value)}
      defaultOption={value}
      options={field.options || []}
    />
  ),
  multiSelect: ({ field, value, onChange }) => (
    <MultiSelectDropdown
      placeholder={field.label}
      value={value || []}
      onChange={(e) => onChange(e)}
      options={field.options || []}
    />
  ),
  country: ({ field, value, onChange }) => (
    <LabelDropdown
      placeholder={field.label}
      onSelect={(option) => onChange(option.value)}
      defaultOption={value}
      options={CountriesOptions}
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
    className={`px-6! py-[10px]! flex items-center justify-between gap-2 ${showDivider ? "border-b border-b-card-border" : ""}`}
  >
    <div className="text-body-4 text-text-tertiary">{label}</div>
    <div className="text-body-4 text-text-primary text-right">
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
  if (type === "date" || type === "dateString") {
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
  const primaryOrg = usePrimaryOrg();
  const attributes = useAuthStore((s) => s.attributes);
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(() =>
    buildInitialValues(fields, org)
  );
  const [formValuesErrors, setFormValuesErrors] = useState<
    Record<string, string | undefined>
  >({});
  const orgId = primaryOrg?._id;
  const isDisabled = !orgId;

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

  const updateProfilePicture = async (s3Key: string) => {
    try {
      if (!profile || !s3Key) throw new Error("Profile or s3Key is missing");
      const payload: UserProfile = {
        ...profile,
        _id: profile?._id,
        personalDetails: {
          ...profile?.personalDetails,
          profilePictureUrl: "https://d2kyjiikho62xx.cloudfront.net/" + s3Key,
        },
      };
      await upsertUserProfile(payload);
    } catch (error) {
      console.log(error);
    }
  };

  const updateOrgLogo = async (s3Key: string) => {
    try {
      if (!primaryOrg || !s3Key) throw new Error("Org or s3Key is missing");
      const updated: Organisation = {
        ...primaryOrg,
        imageURL: "https://d2kyjiikho62xx.cloudfront.net/" + s3Key,
      };
      await updateOrg(updated);
    } catch (error: any) {
      console.error("Error updating organization:", error);
    }
  };

  return (
    <div className="border border-card-border rounded-2xl">
      <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
        <div className="text-body-3 text-text-primary">{title}</div>
        {isActuallyEditable && !isEditing && (
          <RiEdit2Fill
            size={18}
            color="#302f2e"
            className="cursor-pointer"
            onClick={() => setIsEditing(true)}
          />
        )}
      </div>
      <div className={`px-3! py-2! flex flex-col`}>
        {showProfileUser && (
          <div className="px-6! py-2! flex gap-2 items-center">
            <LogoUpdator
              imageUrl={profile?.personalDetails?.profilePictureUrl}
              title="Update Profile Picture"
              apiUrl={`/fhir/v1/user-profile/${orgId}/profile-picture`}
              onSave={updateProfilePicture}
              disabled={isDisabled}
            />
            <div className="text-body-3 text-text-primary">
              {(attributes?.given_name || "") +
                " " +
                (attributes?.family_name || "")}
            </div>
          </div>
        )}
        {showProfile && (
          <div className="px-6! py-2! flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <LogoUpdator
                  imageUrl={primaryOrg?.imageURL}
                  title="Update logo"
                  apiUrl={`/fhir/v1/organization/logo/presigned-url/${orgId}`}
                  onSave={updateOrgLogo}
                  disabled={isDisabled}
                />
                <div className="text-body-3 text-text-primary">{org.name}</div>
                <div
                  className="px-3! py-1! rounded-2xl w-fit text-caption-1"
                  style={getStatusStyle(org.isVerified ? "Active" : "Pending")}
                >
                  {org.isVerified ? "Verified" : "Pending"}
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
              <div className="text-caption-1 text-text-primary w-full sm:max-w-1/2">
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
        <div className="px-6! py-3! flex items-center justify-end w-full gap-3">
          <Secondary text="Cancel" href="#" onClick={handleCancel} />
          <Primary text="Save" href="#" onClick={handleSave} />
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
