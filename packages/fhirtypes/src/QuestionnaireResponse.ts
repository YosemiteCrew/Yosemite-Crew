import { Attachment } from "./Attachment";
import { BackboneElement } from "./BackboneElement";
import { Extension } from "./Extension";
import { Identifier } from "./Identifier";
import { Meta } from "./Meta";
import { Narrative } from "./Narrative";
import { Reference } from "./Reference";
import { Resource } from "./Resource";

/**
 * A structured set of questions and their answers.
 */
export interface QuestionnaireResponse {
  readonly resourceType: "QuestionnaireResponse";
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: Resource[];
  extension?: Extension[];
  modifierExtension?: Extension[];
  identifier?: Identifier;
  basedOn?: Reference[];
  parent?: Reference[];
  questionnaire?: string;
  status: QuestionnaireResponseStatus;
  subject?: Reference;
  encounter?: Reference;
  authored?: string;
  author?: Reference;
  source?: Reference;
  item?: QuestionnaireResponseItem[];
}

export type QuestionnaireResponseStatus =
  | "in-progress"
  | "completed"
  | "amended"
  | "entered-in-error"
  | "stopped";

export interface QuestionnaireResponseItem extends BackboneElement {
  linkId: string;
  definition?: string;
  text?: string;
  answer?: QuestionnaireResponseItemAnswer[];
  item?: QuestionnaireResponseItem[];
}

export interface QuestionnaireResponseItemAnswer extends BackboneElement {
  valueBoolean?: boolean;
  valueDecimal?: number;
  valueInteger?: number;
  valueDate?: string;
  valueDateTime?: string;
  valueTime?: string;
  valueString?: string;
  valueUri?: string;
  valueAttachment?: Attachment;
  valueCoding?: {
    system?: string;
    code?: string;
    display?: string;
  };
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueReference?: Reference;
  item?: QuestionnaireResponseItem[];
}
