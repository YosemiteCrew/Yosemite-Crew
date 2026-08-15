import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { RoomUnitSizeOptions } from '@/app/features/organization/pages/Organization/types';

type RoomUnitFields = {
  id: string;
  name: string;
  size: string;
  count: number;
};

type RoomUnitFieldsPatch = Partial<Omit<RoomUnitFields, 'id'>>;

type RoomUnitFieldsEditorProps = {
  unit: RoomUnitFields;
  onUpdateUnit: (id: string, patch: RoomUnitFieldsPatch) => void;
};

/**
 * Editable Name / Size / Units field trio for a room unit, shared by the
 * add-room draft units and the room-info edit mode.
 */
const RoomUnitFieldsEditor = ({ unit, onUpdateUnit }: RoomUnitFieldsEditorProps) => (
  <div className="grid grid-cols-1 gap-3">
    <FormInput
      intype="text"
      value={unit.name}
      inlabel="Name"
      onChange={(event) => onUpdateUnit(unit.id, { name: event.target.value })}
    />
    <LabelDropdown
      placeholder="Size"
      options={RoomUnitSizeOptions}
      defaultOption={unit.size}
      onSelect={(option) => onUpdateUnit(unit.id, { size: option.value })}
    />
    <FormInput
      intype="number"
      value={String(unit.count)}
      inlabel="Units"
      onChange={(event) => {
        const parsed = Number(event.target.value);
        onUpdateUnit(unit.id, { count: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) });
      }}
    />
  </div>
);

export default RoomUnitFieldsEditor;
