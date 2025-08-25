import { z } from 'zod';

// --- Zod Schemas ---

const telecomSchema = z.object({
  system: z.enum(["phone", "email", "url"]),
  value: z.string()
});

const subject = z.object({
  reference:z.string()
});

const addressSchema = z.object({
  line: z.array(z.string()).min(1),
  city: z.string(),
  postalCode: z.string(),
  country: z.string()
});

const contactSchema = z.object({
  name: z.object({
    text: z.string()
  }),
  purpose: z.object({
    coding: z.array(
      z.object({
        system: z.string(),
        code: z.string(),
        display: z.string()
      })
    )
  }),
  telecom: z.array(telecomSchema)
});

export const fhirOrganizationSchema = z.object({
  resourceType: z.literal("Organization"),
  id: z.string().optional(),
  name: z.string(),
  telecom: z.array(telecomSchema),
  address: z.array(addressSchema).optional(),
  contact: z.array(contactSchema).optional(),
  subject:subject.optional()
});

// --- TypeScript Types ---

export type FhirTelecom = z.infer<typeof telecomSchema>;
export type FhirAddress = z.infer<typeof addressSchema>;
export type FhirContact = z.infer<typeof contactSchema>;
export type Fhirsubject = z.infer<typeof subject>;
export type FhirOrganization = z.infer<typeof fhirOrganizationSchema>;