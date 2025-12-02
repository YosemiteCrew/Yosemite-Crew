import { TextField } from "@/app/types/forms";

const TextRenderer: React.FC<{
  field: TextField;
}> = ({ field }) => {
  if (!field.value || field.value.trim().length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="font-grotesk text-black-text text-[18px] font-medium">
        {field.value}
      </div>
    </div>
  );
};

export default TextRenderer;
