import { FormField } from "@/app/types/forms";
import React from "react";

const SignatureRenderer: React.FC<{
  field: FormField;
}> = ({ field }) => (
  <div className="flex flex-col gap-3">
    <div className="font-grotesk text-black-text text-[18px] font-medium">
      {field.label}
    </div>
    <div className="h-[120px] flex items-center justify-center border-2 border-dashed border-grey-light rounded-2xl font-grotesk text-grey-noti text-[18px] font-medium">
      Draw your signature here
    </div>
  </div>
);

export default SignatureRenderer;
