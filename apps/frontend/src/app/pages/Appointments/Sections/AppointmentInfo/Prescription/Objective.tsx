import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import React, { useState } from "react";
import { DemoSubjectiveOptions } from "./demo";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { formDataProps } from "..";
import { AppointmentsProps } from "@/app/types/appointments";

type ObjectiveProps = {
  formData: formDataProps;
  setFormData: React.Dispatch<React.SetStateAction<formDataProps>>;
  activeAppointment: AppointmentsProps;
};

const Objective = ({
  formData,
  setFormData,
  activeAppointment,
}: ObjectiveProps) => {
  const [query, setQuery] = useState("");
  const [formDataErrors] = useState<{
    general?: string;
  }>({});

  const handleObjectiveSelect = (id: string) => {};

  const handleSave = () => {};

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <Accordion
        title="Objective (clinical examination)"
        defaultOpen
        showEditIcon={false}
        isEditing={true}
      >
        <div className="flex flex-col gap-3">
          <SearchDropdown
            placeholder="Search"
            options={DemoSubjectiveOptions}
            onSelect={handleObjectiveSelect}
            query={query}
            setQuery={setQuery}
          />
          <FormInput
            intype="text"
            inname="general"
            value={formData.general}
            inlabel="General behavior"
            onChange={(e) =>
              setFormData({ ...formData, general: e.target.value })
            }
            error={formDataErrors.general}
            className="min-h-12!"
          />
          <div className="flex flex-col gap-2">
            <div className="font-grotesk text-[19px] font-medium text-black-text ml-1!">
              Vitals
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="temperature"
                value={formData.temp}
                inlabel="Temperature"
                onChange={(e) =>
                  setFormData({ ...formData, temp: e.target.value })
                }
                className="min-h-12!"
              />
              <FormInput
                intype="text"
                inname="pulse"
                value={formData.pulse}
                inlabel="Pulse"
                onChange={(e) =>
                  setFormData({ ...formData, pulse: e.target.value })
                }
                className="min-h-12!"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="respiration"
                value={formData.respiration}
                inlabel="Respiration"
                onChange={(e) =>
                  setFormData({ ...formData, respiration: e.target.value })
                }
                className="min-h-12!"
              />
              <FormInput
                intype="text"
                inname="mucous"
                value={formData.mucousColor}
                inlabel="Mucous color"
                onChange={(e) =>
                  setFormData({ ...formData, mucousColor: e.target.value })
                }
                className="min-h-12!"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="bloodPressure"
                value={formData.bloodPressure}
                inlabel="Blood pressure"
                onChange={(e) =>
                  setFormData({ ...formData, bloodPressure: e.target.value })
                }
                className="min-h-12!"
              />
              <FormInput
                intype="text"
                inname="weight"
                value={formData.weight}
                inlabel="Body weight"
                onChange={(e) =>
                  setFormData({ ...formData, weight: e.target.value })
                }
                className="min-h-12!"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="hydration"
                value={formData.hydration}
                inlabel="Hydration status"
                onChange={(e) =>
                  setFormData({ ...formData, hydration: e.target.value })
                }
                className="min-h-12!"
              />
              <FormInput
                intype="text"
                inname="generalBehaviour"
                value={formData.generalBehaviour}
                inlabel="General behavior"
                onChange={(e) =>
                  setFormData({ ...formData, generalBehaviour: e.target.value })
                }
                className="min-h-12!"
              />
            </div>
          </div>
          <FormDesc
            intype="text"
            inname="musculoskeletal"
            value={formData.musculoskeletal}
            inlabel="Musculoskeletal Exam"
            onChange={(e) =>
              setFormData({ ...formData, musculoskeletal: e.target.value })
            }
            className="min-h-[120px]!"
          />
          <FormInput
            intype="text"
            inname="neuro"
            value={formData.neuro}
            inlabel="Neuro"
            onChange={(e) =>
              setFormData({ ...formData, neuro: e.target.value })
            }
            className="min-h-12!"
          />
          <FormInput
            intype="text"
            inname="pain"
            value={formData.pain}
            inlabel="Pain Score"
            onChange={(e) => setFormData({ ...formData, pain: e.target.value })}
            className="min-h-12!"
          />
        </div>
      </Accordion>
      <Primary href="#" text="Save" classname="h-13!" onClick={handleSave} />
    </div>
  );
};

export default Objective;
