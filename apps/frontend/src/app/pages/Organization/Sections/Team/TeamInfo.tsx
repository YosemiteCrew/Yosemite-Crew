import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Availability from "@/app/components/Availability/Availability";
import {
  AvailabilityState,
  daysOfWeek,
  DEFAULT_INTERVAL,
} from "@/app/components/Availability/utils";
import Modal from "@/app/components/Modal";
import { Team } from "@/app/types/team";
import React, { useMemo, useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import PermissionsEditor from "./PermissionsEditor";
import {
  Permission,
  RoleCode,
  toPermissionArray,
} from "@/app/utils/permissions";
import { useOrgStore } from "@/app/stores/orgStore";

type TeamInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTeam: Team;
};

const Fields = [
  { label: "Name", key: "name", type: "text" },
  { label: "Email", key: "email", type: "text" },
  { label: "Role", key: "role", type: "text" },
  { label: "Department", key: "speciality", type: "text" },
  { label: "Gender", key: "gender", type: "text" },
  { label: "Date of birth", key: "dob", type: "text" },
  { label: "Employment type", key: "employmentType", type: "text" },
  { label: "Country", key: "country", type: "text" },
  { label: "Phone number", key: "phone", type: "text" },
];

const AddressFields = [
  { label: "Address", key: "addressLine", type: "text" },
  { label: "Area", key: "area", type: "text" },
  { label: "State/Province", key: "state", type: "text" },
  { label: "City", key: "city", type: "text" },
  { label: "Postal code", key: "postalCode", type: "text" },
];

const ProfessionalFields = [
  { label: "LinkedIn", key: "linkedin", type: "text" },
  { label: "Medical license number", key: "licenseNumber", type: "text" },
  { label: "Years of experience", key: "experience", type: "text" },
  { label: "Specialisation", key: "specialisation", type: "text" },
  {
    label: "Qualification (MBBS, MD, etc.)",
    key: "qulaification",
    type: "text",
  },
  { label: "Biography or short description", key: "description", type: "text" },
];

const TeamInfo = ({ showModal, setShowModal, activeTeam }: TeamInfoProps) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  const membershipsByOrgId = useOrgStore.getState().membershipsByOrgId;

  const { role, permissions } = useMemo(() => {
    if (!primaryOrgId) return { role: null, permissions: [] };
    const membership = membershipsByOrgId[primaryOrgId];
    console.log(membership)
    return {
      role: membership.roleCode.toUpperCase() as RoleCode,
      permissions: toPermissionArray(membership?.effectivePermissions ?? []),
    };
  }, [primaryOrgId, membershipsByOrgId]);

  const [perms, setPerms] = React.useState<Permission[]>(permissions ?? []);
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

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            View team
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>
        <div className="flex flex-col gap-8 overflow-y-auto flex-1 w-full">
          <EditableAccordion
            title="Personal details"
            fields={Fields}
            data={{ ...activeTeam, speciality: activeTeam.speciality.name }}
            defaultOpen={true}
          />
          <EditableAccordion
            title="Address details"
            fields={AddressFields}
            data={activeTeam}
            defaultOpen={false}
          />
          <EditableAccordion
            title="Professional details"
            fields={ProfessionalFields}
            data={activeTeam}
            defaultOpen={false}
          />

          <Accordion
            title="Availability"
            defaultOpen={false}
            showEditIcon={false}
            isEditing={false}
          >
            <div className="px-3! py-3!">
              <Availability
                availability={availability}
                setAvailability={setAvailability}
              />
            </div>
          </Accordion>

          {role && (
            <PermissionsEditor role={role} onChange={setPerms} value={perms} />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default TeamInfo;
