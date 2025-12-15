import Labels from "@/app/components/Labels/Labels";
import Modal from "@/app/components/Modal";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { BsChatHeartFill } from "react-icons/bs";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { IoDocumentText, IoEye } from "react-icons/io5";
import { PiMoneyWavyFill } from "react-icons/pi";
import Summary from "./Finance/Summary";
import Task from "./Tasks/Task";
import AppointmentInfo from "./Info/AppointmentInfo";
import Companion from "./Info/Companion";
import History from "./Info/History";
import Subjective from "./Prescription/Subjective";
import Objective from "./Prescription/Objective";
import Assessment from "./Prescription/Assessment";
import Chat from "./Tasks/Chat";
import ParentTask from "./Tasks/ParentTask";
import Details from "./Finance/Details";
import Documents from "./Prescription/Documents";
import Discharge from "./Prescription/Discharge";
import Audit from "./Prescription/Audit";
import Plan from "./Prescription/Plan";
import { Appointment, FormSubmission, Service } from "@yosemite-crew/types";
import { fetchSubmissions } from "@/app/services/soapService";

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
    icon: IoEye,
    iconSize: 32,
    labels: [
      { key: "appointment", name: "Appointment" },
      { key: "companion", name: "Companion" },
      { key: "history", name: "History" },
    ],
  },
  {
    key: "prescription",
    name: "Prescription",
    icon: IoDocumentText,
    iconSize: 32,
    labels: [
      { key: "subjective", name: "Subjective" },
      { key: "obective", name: "Objecive" },
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
    icon: BsChatHeartFill,
    iconSize: 24,
    labels: [
      { key: "parent-chat", name: "Parent chat" },
      { key: "task", name: "Task" },
      { key: "parent-task", name: "Parent task" },
    ],
  },
  {
    key: "finance",
    name: "Finance",
    icon: PiMoneyWavyFill,
    iconSize: 24,
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
    obective: Objective,
    assessment: Assessment,
    plan: Plan,
    "audit-trail": Audit,
    "discharge-summary": Discharge,
    documents: Documents,
  },
  tasks: {
    "parent-chat": Chat,
    task: Task,
    "parent-task": ParentTask,
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
  const [activeLabel, setActiveLabel] = useState<LabelKey>(labels[0].key);
  const [activeSubLabel, setActiveSubLabel] = useState<SubLabelKey>(
    labels[0].labels[0].key
  );
  const Content = COMPONENT_MAP[activeLabel]?.[activeSubLabel];
  const [formData, setFormData] = useState<FormDataProps>(
    createEmptyFormData()
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
          subjective: soap.Subjective ?? [],
          objective: soap.Objective ?? [],
          assessment: soap.Assessment ?? [],
          plan: soap.Plan ?? [],
          // not present in GetSOAPResponse, keep as-is / empty
          discharge: prev.discharge ?? [],
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

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex flex-col">
          <div className="flex justify-between">
            <IoIosCloseCircleOutline
              size={28}
              color="#302f2e"
              className="opacity-0"
            />
            <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
              <Image
                alt="pet image"
                src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
                className="rounded-full"
                height={80}
                width={80}
              />
            </div>
            <IoIosCloseCircleOutline
              size={28}
              color="#302f2e"
              onClick={() => setShowModal(false)}
              className="cursor-pointer"
            />
          </div>
          <div className="flex justify-center font-grotesk font-medium text-[23px] text-black-text">
            {activeAppointment?.companion?.name}
          </div>
          <div className="flex justify-center font-satoshi font-medium text-[14px] text-black-text">
            {activeAppointment?.companion?.breed +
              " / " +
              activeAppointment?.companion?.species}
          </div>
        </div>

        <Labels
          labels={labels}
          activeLabel={activeLabel}
          setActiveLabel={setActiveLabel}
          activeSubLabel={activeSubLabel}
          setActiveSubLabel={setActiveSubLabel}
        />

        <div className="flex overflow-y-auto flex-1">
          {Content ? (
            <Content
              activeAppointment={activeAppointment}
              formData={formData}
              setFormData={setFormData}
            />
          ) : null}
        </div>
      </div>
    </Modal>
  );
};

export default AppoitmentInfo;
