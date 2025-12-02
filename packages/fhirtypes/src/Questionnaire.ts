import { Attachment } from "./Attachment";
import { BackboneElement } from "./BackboneElement";
import { CodeableConcept } from "./CodeableConcept";
import { Coding } from "./Coding";
import { ContactDetail } from "./ContactDetail";
import { Extension } from "./Extension";
import { Identifier } from "./Identifier";
import { Meta } from "./Meta";
import { Narrative } from "./Narrative";
import { Period } from "./Period";
import { Quantity } from "./Quantity";
import { Reference } from "./Reference";
import { Resource } from "./Resource";
import { UsageContext } from "./UsageContext";

/**
 * A structured set of questions intended to guide the collection of answers.
 */
export interface Questionnaire {
  readonly resourceType: "Questionnaire";
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: Resource[];
  extension?: Extension[];
  modifierExtension?: Extension[];
  url?: string;
  identifier?: Identifier[];
  version?: string;
  name?: string;
  title?: string;
  derivedFrom?: string[];
  status: QuestionnaireStatus;
  experimental?: boolean;
  subjectType?: string[];
  date?: string;
  publisher?: string;
  contact?: ContactDetail[];
  description?: string;
  useContext?: UsageContext[];
  jurisdiction?: CodeableConcept[];
  purpose?: string;
  copyright?: string;
  approvalDate?: string;
  lastReviewDate?: string;
  effectivePeriod?: Period;
  code?: Coding[];
  item?: QuestionnaireItem[];
}

export type QuestionnaireStatus = "draft" | "active" | "retired" | "unknown";

export type QuestionnaireItemType =
  | "group"
  | "display"
  | "boolean"
  | "decimal"
  | "integer"
  | "date"
  | "dateTime"
  | "time"
  | "string"
  | "text"
  | "url"
  | "choice"
  | "open-choice"
  | "attachment"
  | "reference"
  | "quantity";

export interface QuestionnaireItem extends BackboneElement {
  linkId: string;
  definition?: string;
  code?: Coding[];
  prefix?: string;
  text?: string;
  type: QuestionnaireItemType;
  enableWhen?: QuestionnaireItemEnableWhen[];
  enableBehavior?: "all" | "any";
  required?: boolean;
  repeats?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  answerValueSet?: string;
  answerOption?: QuestionnaireItemAnswerOption[];
  initial?: QuestionnaireItemInitial[];
  item?: QuestionnaireItem[];
}

export type QuestionnaireEnableOperator =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "exists";

export interface QuestionnaireItemEnableWhen extends BackboneElement {
  question: string;
  operator: QuestionnaireEnableOperator;
  answerBoolean?: boolean;
  answerDecimal?: number;
  answerInteger?: number;
  answerDate?: string;
  answerDateTime?: string;
  answerTime?: string;
  answerString?: string;
  answerCoding?: Coding;
  answerQuantity?: Quantity;
  answerReference?: Reference;
}

export interface QuestionnaireItemAnswerOption extends BackboneElement {
  valueInteger?: number;
  valueDate?: string;
  valueTime?: string;
  valueString?: string;
  valueCoding?: Coding;
  valueReference?: Reference;
  valueQuantity?: Quantity;
  initialSelected?: boolean;
}

export interface QuestionnaireItemInitial extends BackboneElement {
  valueBoolean?: boolean;
  valueDecimal?: number;
  valueInteger?: number;
  valueDate?: string;
  valueDateTime?: string;
  valueTime?: string;
  valueString?: string;
  valueUri?: string;
  valueAttachment?: Attachment;
  valueCoding?: Coding;
  valueQuantity?: Quantity;
  valueReference?: Reference;
}
