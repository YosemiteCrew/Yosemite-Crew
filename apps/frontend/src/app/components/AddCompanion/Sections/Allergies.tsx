import React, { useState } from "react";
import { Primary } from "../../Buttons";
import FormDesc from "../../Inputs/FormDesc/FormDesc";
import Accordion from "../../Accordion/Accordion";

const Allergies = () => {
  const [formData, setFormData] = useState({
    allergies: "",
    diet: "",
    notes: "",
  });

  return (
    <div className="flex flex-col justify-between flex-1 gap-6 w-full">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk font-medium text-black-text text-[23px]">
          Allergies / Restrictions
        </div>
        <Accordion
          title="Allergies / Restrictions"
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            <FormDesc
              intype="text"
              inname="allergies"
              value={formData.allergies}
              inlabel="Allergies (optional)"
              onChange={(e) =>
                setFormData({ ...formData, allergies: e.target.value })
              }
              className="min-h-[120px]!"
            />
            <FormDesc
              intype="text"
              inname="diet"
              value={formData.diet}
              inlabel="Dietary Restrictions (optional)"
              onChange={(e) =>
                setFormData({ ...formData, diet: e.target.value })
              }
              className="min-h-[120px]!"
            />
            <FormDesc
              intype="text"
              inname="notes"
              value={formData.notes}
              inlabel="Notes (optional)"
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="min-h-[120px]!"
            />
          </div>
        </Accordion>
      </div>
      <Primary
        href="#"
        text="Save"
        classname="max-h-12! text-lg! tracking-wide!"
      />
    </div>
  );
};

export default Allergies;
