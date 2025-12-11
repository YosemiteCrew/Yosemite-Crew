import { Primary, Secondary } from "@/app/components/Buttons";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { useAuthStore } from "@/app/stores/authStore";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { RiEdit2Fill } from "react-icons/ri";

type FieldConfig = {
  label: string;
  key: string;
  type?: string;
  required?: boolean;
  editable?: boolean;
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

const ProfileCard = ({
  title,
  fields,
  org,
  showProfile,
  showProfileUser,
  editable = true,
  onSave,
}: ProfileCardProps) => {
  const attributes = useAuthStore((s) => s.attributes);
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    fields.reduce(
      (acc, field) => {
        acc[field.key] = org?.[field.key] ?? "";
        return acc;
      },
      {} as Record<string, string>
    )
  );

  const [formValuesErrors, setFormValuesErrors] = useState<
    Record<string, string | undefined>
  >({});

  useEffect(() => {
    setFormValues(
      fields.reduce(
        (acc, field) => {
          acc[field.key] = org?.[field.key] ?? "";
          return acc;
        },
        {} as Record<string, string>
      )
    );
    setFormValuesErrors({});
  }, [org, fields]);

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));

    setFormValuesErrors((prev) => ({
      ...prev,
      [key]: undefined,
    }));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (!field.required) continue;
      if (!field.editable) continue;
      const value = (formValues[field.key] || "").trim();
      if (!value) {
        errors[field.key] = `${field.label} is required`;
      }
    }
    setFormValuesErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCancel = () => {
    setFormValues(
      fields.reduce(
        (acc, field) => {
          acc[field.key] = org?.[field.key] ?? "";
          return acc;
        },
        {} as Record<string, string>
      )
    );
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
        {editable && !isEditing && (
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
              src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
              alt="Logo"
              height={60}
              width={60}
              className="rounded-full"
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
                  className="rounded-full"
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
                  href="/book-demo"
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
        {fields.map((field, index) => (
          <div key={field.key}>
            {isEditing && field.editable ? (
              <div className="flex-1 py-2 px-2">
                <FormInput
                  intype={field.type || "text"}
                  inname={field.key}
                  value={formValues[field.key]}
                  inlabel={field.label}
                  error={formValuesErrors[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="min-h-12!"
                />
              </div>
            ) : (
              <div
                className={`px-6! py-3! flex items-center gap-2 ${index !== fields.length - 1 && "border-b border-b-grey-light"}`}
              >
                <div className="font-satoshi font-semibold text-grey-noti text-[18px]">
                  {field.label + ":"}
                </div>
                <div className="font-satoshi font-semibold text-black-text text-[18px]">
                  {org[field.key] || "-"}
                </div>
              </div>
            )}
          </div>
        ))}
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
