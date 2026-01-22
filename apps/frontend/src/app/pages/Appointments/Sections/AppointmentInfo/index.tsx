import Labels from "@/app/components/Labels/Labels";
import Modal from "@/app/components/Modal";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import Summary from "./Finance/Summary";
import Task from "./Tasks/Task";
import AppointmentInfo from "./Info/AppointmentInfo";
import Companion from "./Info/Companion";
import History from "./Info/History";
import Subjective from "./Prescription/Subjective";
import Objective from "./Prescription/Objective";
import Assessment from "./Prescription/Assessment";
import Chat from "./Tasks/Chat";
import Details from "./Finance/Details";
import Documents from "./Prescription/Documents";
import Discharge from "./Prescription/Discharge";
import Audit from "./Prescription/Audit";
import Plan from "./Prescription/Plan";
import { Appointment, FormSubmission, Service } from "@yosemite-crew/types";
import { fetchSubmissions } from "@/app/services/soapService";
import Close from "@/app/components/Icons/Close";
import { usePermissions } from "@/app/hooks/usePermissions";
import { PERMISSIONS } from "@/app/utils/permissions";

type AppoitmentInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment | null;
};

export type ServiceEdit = Service & {
  discount: string;
};

export type FormDataProps = {
  subjective: FormSubmission[];
  objective: FormSubmission[];
  assessment: FormSubmission[];
  discharge: FormSubmission[];
  plan: FormSubmission[];
  total: string;
  subTotal: string;
  tax: string;
};

export const createEmptyFormData = (): FormDataProps => ({
  subjective: [],
  objective: [],
  assessment: [],
  discharge: [],
  plan: [],
  total: "",
  subTotal: "",
  tax: "",
});

type LabelKey = (typeof labels)[number]["key"];
type SubLabelKey = (typeof labels)[number]["labels"][number]["key"];

const labels = [
  {
    key: "info",
    name: "Info",
    labels: [
      { key: "appointment", name: "Appointment" },
      { key: "companion", name: "Companion" },
      { key: "history", name: "History" },
    ],
  },
  {
    key: "prescription",
    name: "Prescription",
    labels: [
      { key: "subjective", name: "Subjective" },
      { key: "objective", name: "Objective" },
      { key: "assessment", name: "Assessment" },
      { key: "plan", name: "Plan" },
      { key: "audit-trail", name: "Audit trail" },
      { key: "discharge-summary", name: "Discharge summary" },
      { key: "documents", name: "Documents" },
    ],
  },
  {
    key: "tasks",
    name: "Tasks",
    labels: [
      { key: "parent-chat", name: "Companion parent chat" },
      { key: "task", name: "Task" },
    ],
  },
  {
    key: "finance",
    name: "Finance",
    labels: [
      { key: "summary", name: "Summary" },
      { key: "payment-details", name: "Payment details" },
    ],
  },
];

const COMPONENT_MAP: Record<LabelKey, Record<SubLabelKey, React.FC<any>>> = {
  info: {
    appointment: AppointmentInfo,
    companion: Companion,
    history: History,
  },
  prescription: {
    subjective: Subjective,
    objective: Objective,
    assessment: Assessment,
    plan: Plan,
    "audit-trail": Audit,
    "discharge-summary": Discharge,
    documents: Documents,
  },
  tasks: {
    "parent-chat": Chat,
    task: Task,
  },
  finance: {
    summary: Summary,
    "payment-details": Details,
  },
};

const AppoitmentInfo = ({
  showModal,
  setShowModal,
  activeAppointment,
}: AppoitmentInfoProps) => {
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.PRESCRIPTION_EDIT_OWN);
  const [activeLabel, setActiveLabel] = useState<LabelKey>(labels[0].key);
  const [activeSubLabel, setActiveSubLabel] = useState<SubLabelKey>(
    labels[0].labels[0].key,
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const Content = COMPONENT_MAP[activeLabel]?.[activeSubLabel];
  const [formData, setFormData] = useState<FormDataProps>(
    createEmptyFormData(),
  );

  useEffect(() => {
    const current = labels.find((l) => l.key === activeLabel);
    if (current && current.labels.length > 0) {
      setActiveSubLabel(current.labels[0].key);
    }
  }, [activeLabel]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const appointmentId = activeAppointment?.id;
      if (!appointmentId) {
        setFormData(createEmptyFormData());
        return;
      }
      try {
        const soap = await fetchSubmissions(appointmentId);
        if (cancelled) return;
        setFormData((prev) => ({
          ...prev,
          subjective: soap?.soapNotes?.Subjective ?? [],
          objective: soap?.soapNotes?.Objective ?? [],
          assessment: soap?.soapNotes?.Assessment ?? [],
          plan: soap?.soapNotes?.Plan ?? [],
          discharge: soap?.soapNotes?.Discharge ?? [],
          // not present in GetSOAPResponse, keep as-is / empty
          total: prev.total ?? "",
          subTotal: prev.subTotal ?? "",
          tax: prev.tax ?? "",
        }));
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to fetch submissions:", e);
        setFormData(createEmptyFormData());
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeAppointment?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeLabel, activeSubLabel]);

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex justify-center items-center gap-2">
              <Image
                alt="pet image"
                src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
                className="rounded-full"
                height={40}
                width={40}
              />
              <div className="text-body-1 text-text-primary">
                {activeAppointment?.companion.name}
              </div>
              <div className="text-body-4 text-text-primary mt-1">
                {activeAppointment?.companion.breed}
              </div>
            </div>
            <Close onClick={() => setShowModal(false)} />
          </div>

          <Labels
            labels={labels}
            activeLabel={activeLabel}
            setActiveLabel={setActiveLabel}
            activeSubLabel={activeSubLabel}
            setActiveSubLabel={setActiveSubLabel}
          />
        </div>

        <div
          ref={scrollRef}
          className="flex overflow-y-auto flex-1 scrollbar-hidden"
        >
          {Content ? (
            <Content
              activeAppointment={activeAppointment}
              formData={formData}
              setFormData={setFormData}
              canEdit={canEdit}
            />
          ) : null}
        </div>
      </div>
    </Modal>
  );
};

export default AppoitmentInfo;
