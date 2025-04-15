// validators/fhirOrganizationValidator.js
const { z } = require('zod');

const telecomSchema = z.object({
  system: z.enum(["phone", "email", "url"]),
  value: z.string()
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

const fhirOrganizationSchema = z.object({
  resourceType: z.literal("Organization"),
  id: z.string(),
  name: z.string(),
  telecom: z.array(telecomSchema),
  address: z.array(addressSchema),
  contact: z.array(contactSchema).optional()
});

module.exports = { fhirOrganizationSchema };
