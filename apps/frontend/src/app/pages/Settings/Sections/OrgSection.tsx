import AccordionButton from "@/app/components/Accordion/AccordionButton";
import React, { useEffect, useState } from "react";
import ProfileCard from "../../Organization/Sections/ProfileCard";
import Availability from "@/app/components/Availability/Availability";
import { usePrimaryOrgWithMembership } from "@/app/hooks/useOrgSelectors";
import { Primary } from "@/app/components/Buttons";
import {
  AvailabilityState,
  convertAvailability,
  daysOfWeek,
  DEFAULT_INTERVAL,
  hasAtLeastOneAvailability,
} from "@/app/components/Availability/utils";
import { upsertAvailability } from "@/app/services/availability";
import { usePrimaryAvailability } from "@/app/hooks/useAvailabiities";

const ProfessionalFields = [
  {
    label: "LinkedIn",
    key: "linkedIn",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Medical license number",
    key: "license",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Years of experience",
    key: "experience",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Specialisation",
    key: "specialisation",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Qualification (MBBS, MD,etc.)",
    key: "qualification",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Biography or short description",
    key: "biography",
    required: true,
    editable: true,
    type: "text",
  },
];

const AddressFields = [
  {
    label: "Address line",
    key: "addressLine",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "State / Province",
    key: "state",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "City",
    key: "city",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Postal code",
    key: "postalCode",
    required: true,
    editable: true,
    type: "text",
  },
];

const OrgRelatedFields = [
  {
    label: "Name",
    key: "name",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Role",
    key: "roleDisplay",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Department",
    key: "department",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Employment type",
    key: "employmentType",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Gender",
    key: "gender",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Date of birth",
    key: "dob",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Phone number",
    key: "phone",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Country",
    key: "country",
    required: true,
    editable: true,
    type: "text",
  },
];

const OrgSection = () => {
  const { org, membership } = usePrimaryOrgWithMembership();
  const { availabilities } = usePrimaryAvailability();
  const [availability, setAvailability] = useState<AvailabilityState>(
    daysOfWeek.reduce<AvailabilityState>((acc, day) => {
      const isWeekday =
        day === "Monday" ||
        day === "Tuesday" ||
        day === "Wednesday" ||
        day === "Thursday" ||
        day === "Friday";

      acc[day] = {
        enabled: isWeekday,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      return acc;
    }, {} as AvailabilityState)
  );

  useEffect(() => {
    if (availabilities) {
      setAvailability(availabilities);
    }
  }, [availabilities]);

  const handleClick = async () => {
    try {
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        console.log("No availability selected");
        return;
      }
      await upsertAvailability(converted, null);
    } catch (error) {
      console.log(error);
    }
  };

  if (!org || !membership) return null;

  return (
    <AccordionButton title="Org Details" defaultOpen showButton={false}>
      <div className="flex flex-col gap-4">
        <ProfileCard
          title="Info"
          fields={OrgRelatedFields}
          org={{ ...org, ...membership }}
        />
        <ProfileCard
          title="Address"
          fields={AddressFields}
          org={{ ...org, ...membership }}
        />
        <ProfileCard
          title="Professional details"
          fields={ProfessionalFields}
          org={{ ...org, ...membership }}
        />
        <div className="border border-grey-light rounded-2xl">
          <div className="px-6! py-4! border-b border-b-grey-light flex items-center justify-between">
            <div className="font-grotesk font-medium text-black-text text-[19px]">
              Availability
            </div>
          </div>
          <div className="px-10! py-10! flex flex-col gap-4">
            <Availability
              availability={availability}
              setAvailability={setAvailability}
            />
            <div className="w-full flex justify-end!">
              <Primary
                href="#"
                text="Save"
                style={{ width: "160px" }}
                onClick={handleClick}
              />
            </div>
          </div>
        </div>
      </div>
    </AccordionButton>
  );
};

export default OrgSection;
