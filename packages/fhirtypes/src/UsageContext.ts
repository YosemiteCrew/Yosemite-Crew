import { CodeableConcept } from "./CodeableConcept";
import { Coding } from "./Coding";
import { Quantity } from "./Quantity";
import { Range } from "./Range";
import { Reference } from "./Reference";

/**
 * The content was developed with a focus and intent of supporting the contexts listed.
 */
export interface UsageContext {
  code: Coding;
  valueCodeableConcept?: CodeableConcept;
  valueQuantity?: Quantity;
  valueRange?: Range;
  valueReference?: Reference;
}
