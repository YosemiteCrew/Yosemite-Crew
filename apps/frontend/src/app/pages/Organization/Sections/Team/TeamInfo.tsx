import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Availability from "@/app/components/Availability/Availability";
import {
  AvailabilityState,
  convertFromGetApi,
  daysOfWeek,
  DEFAULT_INTERVAL,
} from "@/app/components/Availability/utils";
import Modal from "@/app/components/Modal";
import { Team } from "@/app/types/team";
import React, { useEffect, useMemo, useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import PermissionsEditor from "./PermissionsEditor";
import { Permission, toPermissionArray } from "@/app/utils/permissions";
import { getProfileForUserForPrimaryOrg } from "@/app/services/teamService";

type TeamInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTeam: Team;
};

const Fields = [
  { label: "Name", key: "name", type: "text" },
  { label: "Role", key: "role", type: "text" },
  { label: "Department", key: "speciality", type: "text" },
  { label: "Gender", key: "gender", type: "text" },
  { label: "Date of birth", key: "dateOfBirth", type: "text" },
  { label: "Employment type", key: "employmentType", type: "text" },
  { label: "Country", key: "country", type: "text" },
  { label: "Phone number", key: "phoneNumber", type: "text" },
];

const AddressFields = [
  { label: "Address", key: "addressLine", type: "text" },
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
  const [perms, setPerms] = React.useState<Permission[]>([]);
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

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const userId = activeTeam._id;
    if (!showModal || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getProfileForUserForPrimaryOrg(userId);
        console.log(data);
        if (!cancelled) setProfile(data);
      } catch {
        // intentionally silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showModal, activeTeam]);

  const basicInfoData = useMemo(
    () => ({
      name: activeTeam?.name ?? "",
      role: activeTeam?.role ?? "",
      speciality: activeTeam?.speciality?.name ?? "",
      gender: profile?.profile?.personalDetails?.gender ?? "",
      dateOfBirth: profile?.profile?.personalDetails?.dateOfBirth ?? "",
      employmentType: profile?.profile?.personalDetails?.employmentType ?? "",
      phoneNumber: profile?.profile?.personalDetails?.phoneNumber ?? "",
      country: profile?.profile?.personalDetails?.address?.country ?? "",
    }),
    [profile, activeTeam]
  );

  const addressInfoData = useMemo(
    () => ({
      addressLine:
        profile?.profile?.personalDetails?.address?.addressLine ?? "",
      state: profile?.profile?.personalDetails?.address?.state ?? "",
      city: profile?.profile?.personalDetails?.address?.city ?? "",
      postalCode: profile?.profile?.personalDetails?.address?.postalCode ?? "",
    }),
    [profile]
  );

  const professionalInfoData = useMemo(
    () => ({
      linkedin: profile?.profile?.professionalDetails?.linkedin ?? "",
      licenseNumber:
        profile?.profile?.professionalDetails?.medicalLicenseNumber ?? "",
      experience:
        profile?.profile?.professionalDetails?.yearsOfExperience ?? "",
      specialisation:
        profile?.profile?.professionalDetails?.specialization ?? "",
      qulaification: profile?.profile?.professionalDetails?.qualification ?? "",
      description: profile?.profile?.professionalDetails?.biography ?? "",
    }),
    [profile]
  );

  const { role } = useMemo(() => {
    const role_code = profile?.mapping?.roleCode ?? null;
    const permissions = profile?.mapping?.effectivePermissions ?? [];
    const availability = profile?.baseAvailability ?? []
    const normalAvailabilty = convertFromGetApi(availability)
    console.log(availability, normalAvailabilty)
    setAvailability(normalAvailabilty)
    setPerms(toPermissionArray(permissions));
    return {
      role: role_code,
    };
  }, [profile]);

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
            data={basicInfoData}
            defaultOpen={true}
            showEditIcon={false}
          />
          <EditableAccordion
            title="Address details"
            fields={AddressFields}
            data={addressInfoData}
            defaultOpen={false}
            showEditIcon={false}
          />
          <EditableAccordion
            title="Professional details"
            fields={ProfessionalFields}
            data={professionalInfoData}
            defaultOpen={false}
            showEditIcon={false}
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

          {role && perms && (
            <PermissionsEditor role={role} onChange={setPerms} value={perms} />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default TeamInfo;
