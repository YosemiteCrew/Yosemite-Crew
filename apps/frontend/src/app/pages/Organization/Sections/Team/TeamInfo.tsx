import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion, {
  FieldConfig,
} from "@/app/components/Accordion/EditableAccordion";
import Availability from "@/app/components/Availability/Availability";
import {
  AvailabilityState,
  convertAvailability,
  convertFromGetApi,
  daysOfWeek,
  DEFAULT_INTERVAL,
  hasAtLeastOneAvailability,
} from "@/app/components/Availability/utils";
import Modal from "@/app/components/Modal";
import { Team } from "@/app/types/team";
import React, { useEffect, useMemo, useState } from "react";
import PermissionsEditor from "./PermissionsEditor";
import { Permission, RoleCode } from "@/app/utils/permissions";
import {
  getProfileForUserForPrimaryOrg,
  removeMember,
  updateMember,
} from "@/app/services/teamService";
import Close from "@/app/components/Icons/Close";
import { EmploymentTypes, RoleOptions } from "../../types";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { GenderOptions } from "@/app/types/companion";
import { MdDeleteForever } from "react-icons/md";
import { allowDelete } from "@/app/utils/team";
import { Primary } from "@/app/components/Buttons";

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
    { label: "Role", key: "role", type: "select", options: RoleOptions },
    {
      label: "Employment type",
      key: "employmentType",
      type: "select",
      options: EmploymentTypes,
      editable: false,
    },
    {
      label: "Department",
      key: "speciality",
      type: "multiSelect",
      options: SpecialitiesOptions,
      editable: false,
    },
  ] satisfies FieldConfig[];

const PersonalFields = [
  { label: "Name", key: "name", type: "text" },
  { label: "Gender", key: "gender", type: "select", options: GenderOptions },
  { label: "Date of birth", key: "dateOfBirth", type: "date" },
  { label: "Country", key: "country", type: "country" },
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
  const specialities = useSpecialitiesForPrimaryOrg();
  const [perms, setPerms] = React.useState<Permission[]>([]);
  const [role, setRole] = useState<RoleCode | null>(null);
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
    if (activeTeam) {
      setPerms(activeTeam.effectivePermissions);
      setRole(activeTeam.role as RoleCode);
    }
  }, [activeTeam]);

  useEffect(() => {
    if (profile) {
      const availability = profile?.baseAvailability ?? [];
      const normalAvailabilty = convertFromGetApi(availability);
      setAvailability(normalAvailabilty);
    }
  }, [profile]);

  const SpecialitiesOptions = useMemo(
    () => specialities.map((s) => ({ label: s.name, value: s._id || s.name })),
    [specialities]
  );

  const fields = useMemo(
    () => getFields({ SpecialitiesOptions }),
    [SpecialitiesOptions]
  );

  useEffect(() => {
    const userId = activeTeam.practionerId;
    if (!showModal || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getProfileForUserForPrimaryOrg(userId);
        if (!cancelled) setProfile(data);
      } catch {
        // intentionally silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showModal, activeTeam]);

  const orgInfoData = useMemo(
    () => ({
      role: activeTeam?.role ?? "",
      speciality: activeTeam?.speciality.map((s) => s._id) ?? "",
      employmentType: profile?.profile?.personalDetails?.employmentType ?? "",
    }),
    [profile, activeTeam]
  );

  const personalInfoData = useMemo(
    () => ({
      name: activeTeam?.name ?? "",
      gender: profile?.profile?.personalDetails?.gender ?? "",
      dateOfBirth: profile?.profile?.personalDetails?.dateOfBirth ?? "",
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

  const handleDelete = async () => {
    try {
      await removeMember(activeTeam);
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleMappingUpdate = async (values: any) => {
    try {
      console.log(activeTeam);
      const member: Team = {
        ...activeTeam,
        role: values.role,
      };
      await updateMember(member);
    } catch (error) {
      console.log(error);
    }
  };

  const updateAvailability = async () => {
    try {
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        console.log("No availability selected");
        return;
      }
    } catch (error) {
      console.log(error);
    }
  };

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
          <div className={`flex items-center gap-2`}>
            <div className="flex items-center justify-between w-full">
              <div className="text-body-2 text-text-primary">
                {activeTeam.name || "-"}
              </div>
              {allowDelete(activeTeam.role as RoleCode) && (
                <MdDeleteForever
                  className="cursor-pointer"
                  onClick={handleDelete}
                  size={26}
                  color="#EA3729"
                />
              )}
            </div>
          </div>
          <EditableAccordion
            title="Org details"
            fields={fields}
            data={orgInfoData}
            defaultOpen={true}
            onSave={handleMappingUpdate}
          />
          <EditableAccordion
            title="Personal details"
            fields={PersonalFields}
            data={personalInfoData}
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
            <div className="flex flex-col w-full gap-3">
              <Availability
                availability={availability}
                setAvailability={setAvailability}
              />
              <div className="w-full flex justify-end! mb-1">
                <Primary href="#" text="Save" onClick={updateAvailability} />
              </div>
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
