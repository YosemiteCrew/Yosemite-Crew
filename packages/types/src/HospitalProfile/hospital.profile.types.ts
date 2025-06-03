export type Telecom = {
  system: string;
  value: string;
};

export type Identifier = {
  system: string;
  value: string;
};

export type Extension = {
  url: string;
  valueDecimal?: number;
  valueString?: string;
  extension?: Extension[]; // nested extensions
};

export type Address = {
  line?: string[];
  city?: string;
  street?: string;
  state?: string;
  postalCode?: string;
  extension?: Extension[];
};

export type Organization = {
  name: string;
  identifier: Identifier[];
  telecom: Telecom[];
  address?: Address[] | [Address]; // both accepted
  extension?: any[];
  active?: boolean;
};

export type HealthcareService = {
  type?: {
    coding?: {
      code?: string;
      display?: string;
    }[];
  }[];
};

export type Data = {
  organization: Organization;
  healthcareServices: HealthcareService[];
};
