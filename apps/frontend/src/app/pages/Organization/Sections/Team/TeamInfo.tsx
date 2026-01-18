import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion, {
  FieldConfig,
} from "@/app/components/Accordion/EditableAccordion";
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
import PermissionsEditor from "./PermissionsEditor";
import { Permission, toPermissionArray } from "@/app/utils/permissions";
import { getProfileForUserForPrimaryOrg } from "@/app/services/teamService";
import Close from "@/app/components/Icons/Close";
import { EmploymentTypes, RoleOptions } from "../../types";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { GenderOptions } from "@/app/types/companion";

type TeamInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTeam: Team;
};

const getFields = ({
  SpecialitiesOptions,
}: {
  SpecialitiesOptions: { label: string; value: string }[];
}) =>
  [
    { label: "Name", key: "name", type: "text" },
    { label: "Role", key: "role", type: "select", options: RoleOptions },
    {
      label: "Department",
      key: "speciality",
      type: "select",
      options: SpecialitiesOptions,
    },
    { label: "Gender", key: "gender", type: "select", options: GenderOptions },
    { label: "Date of birth", key: "dateOfBirth", type: "date" },
    {
      label: "Employment type",
      key: "employmentType",
      type: "select",
      options: EmploymentTypes,
    },
    { label: "Country", key: "country", type: "country" },
    { label: "Phone number", key: "phoneNumber", type: "text" },
  ] satisfies FieldConfig[];

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
  const specialities = useSpecialitiesForPrimaryOrg();
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

  const SpecialitiesOptions = useMemo(
    () => specialities.map((s) => ({ label: s.name, value: s._id || s.name })),
    [specialities]
  );

  const fields = useMemo(
    () => getFields({ SpecialitiesOptions }),
    [SpecialitiesOptions]
  );

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
    const availability = profile?.baseAvailability ?? [];
    const normalAvailabilty = convertFromGetApi(availability);
    setAvailability(normalAvailabilty);
    setPerms(toPermissionArray(permissions));
    return {
      role: role_code,
    };
  }, [profile]);

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">View team</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>
        <div className="flex flex-col gap-8 overflow-y-auto flex-1 w-full scrollbar-hidden">
          <EditableAccordion
            title="Personal details"
            fields={fields}
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
            <Availability
              availability={availability}
              setAvailability={setAvailability}
            />
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
