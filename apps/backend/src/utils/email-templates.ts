export type DateLike = Date | string | number;

export interface RenderedEmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

const formatDate = (date: DateLike): string =>
  date instanceof Date ? date.toUTCString() : new Date(date).toUTCString();

const renderBaseEmail = (
  subject: string,
  contentHtml: string,
): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${subject}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f8ff;">
    <center style="width:100%; background-color:#f4f8ff;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:100%; background-color:#ffffff;">
              <tr>
                <td align="center" style="padding:0; border-bottom:2px solid #7d7d7d; background-color:#ffffff;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:16px 24px;">
                        <a href="https://www.yosemitecrew.com/" style="text-decoration:none;">
                          <img
                            src="https://d2il6osz49gpup.cloudfront.net/Logo.png"
                            alt="Yosemite Crew Logo"
                            width="110"
                            height="100"
                            style="display:block; border:0; outline:none; text-decoration:none;"
                          />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td align="left" style="padding:32px 16px 32px 16px; font-family:Arial, sans-serif; font-size:18px; line-height:1.5; color:#595958;">
                  ${contentHtml}
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:0; margin:0;">
                  <img
                    src="https://d2il6osz49gpup.cloudfront.net/Images/landingbg1.jpg"
                    alt=""
                    width="600"
                    style="display:block; width:100%; max-width:600px; height:auto; border:0; outline:none; text-decoration:none;"
                  />
                </td>
              </tr>

              <tr>
                <td align="center" style="background-color:#f4f8ff; padding-top:24px;">
                  <img
                    src="https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
                    alt=""
                    width="60"
                    height="60"
                    style="display:block; margin:0 auto; border:0; outline:none; text-decoration:none;"
                  />
                </td>
              </tr>

              <tr>
                <td align="center" style="background-color:#f4f8ff; padding:24px 16px 30px 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
                    <tr>
                      <td valign="top" width="50%" style="padding:8px; font-family:Arial, sans-serif;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding-bottom:16px;">
                              <a href="https://www.yosemitecrew.com/" style="text-decoration:none;">
                                <img
                                  src="https://d2il6osz49gpup.cloudfront.net/Logo.png"
                                  alt="Yosemite Crew Logo"
                                  width="90"
                                  height="83"
                                  style="display:block; border:0; outline:none; text-decoration:none;"
                                />
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                  <td style="padding-right:8px; padding-bottom:8px;">
                                    <img
                                      src="https://d2il6osz49gpup.cloudfront.net/footer/gdpr.png"
                                      alt="GDPR"
                                      width="55"
                                      height="56"
                                      style="display:block; border:0; outline:none; text-decoration:none;"
                                    />
                                  </td>
                                  <td style="padding-right:8px; padding-bottom:8px;">
                                    <img
                                      src="https://d2il6osz49gpup.cloudfront.net/footer/soc-2.png"
                                      alt="SOC2"
                                      width="56"
                                      height="56"
                                      style="display:block; border:0; outline:none; text-decoration:none;"
                                    />
                                  </td>
                                  <td style="padding-right:8px; padding-bottom:8px;">
                                    <img
                                      src="https://d2il6osz49gpup.cloudfront.net/footer/iso.png"
                                      alt="ISO"
                                      width="54"
                                      height="60"
                                      style="display:block; border:0; outline:none; text-decoration:none;"
                                    />
                                  </td>
                                  <td style="padding-bottom:8px;">
                                    <img
                                      src="https://d2il6osz49gpup.cloudfront.net/footer/fhir.png"
                                      alt="FHIR"
                                      width="117"
                                      height="28"
                                      style="display:block; border:0; outline:none; text-decoration:none;"
                                    />
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <td valign="top" width="50%" style="padding:8px; font-family:Arial, sans-serif;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td valign="top" style="padding:4px 8px;">
                              <p style="margin:0 0 8px 0; font-size:16px; font-weight:600; color:#2b2b2b;">
                                Developers
                              </p>
                              <p style="margin:0 0 6px 0; font-size:14px;">
                                <a
                                  href="https://www.yosemitecrew.com/developers/signup"
                                  target="_blank"
                                  style="color:#2b2b2b; text-decoration:none;"
                                >
                                  Developer portal
                                </a>
                              </p>
                              <p style="margin:0; font-size:14px;">
                                <a
                                  href="https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md"
                                  target="_blank"
                                  style="color:#2b2b2b; text-decoration:none;"
                                >
                                  Contributing
                                </a>
                              </p>
                            </td>

                            <td valign="top" style="padding:4px 8px;">
                              <p style="margin:0 0 8px 0; font-size:16px; font-weight:600; color:#2b2b2b;">
                                Community
                              </p>
                              <p style="margin:0 0 6px 0; font-size:14px;">
                                <a
                                  href=""https://discord.gg/yosemitecrew"
                                  target="_blank"
                                  style="color:#2b2b2b; text-decoration:none;"
                                >
                                  Discord
                                </a>
                              </p>
                              <p style="margin:0; font-size:14px;">
                                <a
                                  href="https://github.com/YosemiteCrew/Yosemite-Crew"
                                  target="_blank"
                                  style="color:#2b2b2b; text-decoration:none;"
                                >
                                  GitHub
                                </a>
                              </p>
                            </td>

                            <td valign="top" style="padding:4px 8px;">
                              <p style="margin:0 0 8px 0; font-size:16px; font-weight:600; color:#2b2b2b;">
                                Company
                              </p>
                              <p style="margin:0 0 6px 0; font-size:14px;">
                                <a
                                  href="https://www.yosemitecrew.com/about"
                                  style="color:#2b2b2b; text-decoration:none;"
                                >
                                  About us
                                </a>
                              </p>
                              <p style="margin:0 0 6px 0; font-size:14px;">
                                <a
                                  href="https://www.yosemitecrew.com/terms-and-conditions"
                                  style="color:#2b2b2b; text-decoration:none;"
                                >
                                  Terms and conditions
                                </a>
                              </p>
                              <p style="margin:0 0 6px 0; font-size:14px;">
                                <a
                                  href="https://www.yosemitecrew.com/privacy-policy"
                                  style="color:#2b2b2b; text-decoration:none;"
                                >
                                  Privacy policy
                                </a>
                              </p>
                              <p style="margin:0; font-size:14px;">
                                <a
                                  href="https://www.yosemitecrew.com/pricing"
                                  style="color:#2b2b2b; text-decoration:none;"
                                >
                                  Pricing
                                </a>
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td align="center" style="background-color:#f4f8ff; padding:8px 16px 24px 16px;">
                  <p style="margin:0 0 4px 0; font-family:Arial, sans-serif; font-size:15px; font-weight:bold; line-height:1.2; color:#2b2b2b; text-align:center;">
                    Copyright &copy; 2025 DuneXploration
                  </p>
                  <p style="margin:0 0 4px 0; font-family:Arial, sans-serif; font-size:15px; line-height:1.4; color:#2b2b2b; text-align:center;">
                    DuneXploration UG (haftungsbeschraenkt), Am Finther Weg 7, 55127 Mainz<br />
                    email:
                    <a
                      href="mailto:support@yosemitecrew.com"
                      style="color:#007bff; font-weight:700; text-decoration:none;"
                    >
                      support@yosemitecrew.com
                    </a>,
                    phone:
                    <a
                      href="tel:+4915227763275"
                      style="color:#007bff; font-weight:700; text-decoration:none;"
                    >
                      +49 152 277 63275
                    </a>
                  </p>
                  <p style="margin:4px 0 0 0; font-family:Arial, sans-serif; font-size:15px; line-height:1.4; color:#2b2b2b; text-align:center;">
                    Geschaeftsfuehrer: Ankit Upadhyay -- Amtsgericht Mainz unter HRB 52778, VAT: DE367920596
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </center>
  </body>
</html>`;

type EmailTemplateBuilder<T> = (data: T) => {
  subject: string;
  contentHtml: string;
  textBody: string;
};

const createEmailTemplate =
  <T>(builder: EmailTemplateBuilder<T>) =>
  (data: T): RenderedEmailTemplate => {
    const { subject, contentHtml, textBody } = builder(data);

    return {
      subject,
      htmlBody: renderBaseEmail(subject, contentHtml),
      textBody,
    };
  };

/* ---------- Organisation Invite ---------- */

export interface OrganisationInviteTemplateData {
  organisationName: string;
  inviteeName?: string;
  inviterName?: string;
  acceptUrl: string;
  declineUrl?: string;
  expiresAt: DateLike;
  supportEmail?: string;
}

const buildOrganisationInviteTemplate =
  createEmailTemplate<OrganisationInviteTemplateData>((data) => {
    const inviteeName = data.inviteeName?.trim() || "there";
    const organisationName = data.organisationName.trim();
    const inviterName = data.inviterName?.trim() || "a team member";
    const expiry = formatDate(data.expiresAt);
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";

    const declineHtml = data.declineUrl
      ? `
          <table align="center" style="margin:8px auto 0;">
            <tr>
              <td bgcolor="#e5e7eb" style="border-radius:6px;">
                <a href="${data.declineUrl}" style="padding:12px 24px; color:#111827; font-weight:bold;">
                  Decline Invitation
                </a>
              </td>
            </tr>
          </table>
        `
      : "";
    const declineText = data.declineUrl ? `Decline: ${data.declineUrl}` : "";

    return {
      subject: `You’re invited to join ${organisationName} on Yosemite Crew`,
      contentHtml: `
      <p>Hi ${inviteeName},</p>

      <p>
        <strong>${inviterName}</strong> invited you to join
        <strong>${organisationName}</strong>.
      </p>

      <table align="center" style="margin:24px auto;">
        <tr>
          <td bgcolor="#2563eb" style="border-radius:6px;">
            <a href="${data.acceptUrl}" style="padding:14px 28px; color:#fff; font-weight:bold;">
              Accept Invitation
            </a>
          </td>
        </tr>
      </table>
      ${declineHtml}

      <p>Expires on <strong>${expiry}</strong></p>
      <p>Need help? <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    `,
      textBody: `
Hi ${inviteeName},

${inviterName} invited you to join ${organisationName}.
Accept: ${data.acceptUrl}
${declineText}

Expires on ${expiry}
Support: ${supportEmail}
    `.trim(),
    };
  });

/* ---------- Parent Invites Organisation ---------- */

export interface PetParentOrganisationInviteData {
  organisationName: string;
  petParentName: string;
  petParentEmail?: string;
  acceptUrl: string;
  expiresAt: DateLike;
  supportEmail?: string;
}

const buildPetParentOrganisationInviteTemplate =
  createEmailTemplate<PetParentOrganisationInviteData>((data) => {
    const organisationName = data.organisationName.trim();
    const petParentName = data.petParentName.trim();
    const expiry = formatDate(data.expiresAt);
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";

    return {
      subject: `${petParentName} invited you to join Yosemite Crew PMS`,
      contentHtml: `
        <p>Hello,</p>

        <p>
          <strong>${petParentName}</strong>
          has invited <strong>${organisationName}</strong> to join
          <strong>Yosemite Crew PMS</strong>.
        </p>

        <p>
          By joining Yosemite Crew PMS, your organisation can:
        </p>

        <ul style="padding-left:20px;">
          <li>Manage appointments seamlessly</li>
          <li>Collaborate with pet parents digitally</li>
          <li>Track care, tasks, and communication in one place</li>
        </ul>

        <table align="center" style="margin:32px auto;">
          <tr>
            <td bgcolor="#2563eb" style="border-radius:6px;">
              <a
                href="${data.acceptUrl}"
                target="_blank"
                rel="noopener"
                style="padding:14px 32px; color:#ffffff; font-weight:bold; text-decoration:none; display:inline-block;"
              >
                Join PMS
              </a>
            </td>
          </tr>
        </table>

        <p style="margin-top:24px;">
          This invitation expires on <strong>${expiry}</strong>.
        </p>

        <p style="font-size:16px;">
          If you weren’t expecting this invitation, you can safely ignore this email.
          For assistance, contact
          <a href="mailto:${supportEmail}">${supportEmail}</a>.
        </p>

        <p style="margin-top:24px;">
          Warm regards,<br />
          Yosemite Crew Team
        </p>
      `,
      textBody: `
Hello,

${petParentName} invited ${organisationName} to join Yosemite Crew PMS.

Join here:
${data.acceptUrl}

This invitation expires on ${expiry}.

Need help?
${supportEmail}

— Yosemite Crew Team
      `.trim(),
    };
  });

/* ---------- Appointment Assignment ---------- */

export interface AppointmentAssignedTemplateData {
  employeeName?: string;
  companionName: string;
  appointmentType?: string;
  appointmentTime: string;
  organisationName?: string;
  locationName?: string;
  appointmentUrl?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  supportEmail?: string;
}

const buildAppointmentAssignedTemplate =
  createEmailTemplate<AppointmentAssignedTemplateData>((data) => {
    const employeeName = data.employeeName?.trim() || "there";
    const appointmentType = data.appointmentType?.trim();
    const organisationName = data.organisationName?.trim() || "Yosemite Crew";
    const locationName = data.locationName?.trim();
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";
    const appointmentDetails = appointmentType
      ? `${appointmentType} for ${data.companionName}`
      : `Appointment for ${data.companionName}`;
    const actionUrl = data.appointmentUrl ?? data.ctaUrl;
    const actionLabel = data.ctaLabel?.trim() || "View Appointment";
    const actionHtml = actionUrl
      ? `
          <table align="center" style="margin:24px auto;">
            <tr>
              <td bgcolor="#2563eb" style="border-radius:6px;">
                <a href="${actionUrl}" style="padding:14px 28px; color:#fff; font-weight:bold;">
                  ${actionLabel}
                </a>
              </td>
            </tr>
          </table>
        `
      : "";
    const actionText = actionUrl ? `${actionLabel}: ${actionUrl}` : "";

    return {
      subject: `New appointment assigned at ${organisationName}`,
      contentHtml: `
      <p>Hi ${employeeName},</p>
      <p>${appointmentDetails} has been assigned to you.</p>
      <p><strong>When:</strong> ${data.appointmentTime}</p>
      ${locationName ? `<p><strong>Where:</strong> ${locationName}</p>` : ""}
      ${actionHtml}
      <p>If you need help, reach out at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    `,
      textBody: `
Hi ${employeeName},

${appointmentDetails} has been assigned to you.
When: ${data.appointmentTime}
${locationName ? `Where: ${locationName}` : ""}
${actionText}

Support: ${supportEmail}
      `.trim(),
    };
  });

/* ---------- Task Assignment ---------- */

export interface TaskAssignedTemplateData {
  employeeName?: string;
  taskName: string;
  companionName?: string;
  dueTime: string;
  assignedByName?: string;
  taskUrl?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  additionalNotes?: string;
  supportEmail?: string;
}

const buildTaskAssignedTemplate = createEmailTemplate<TaskAssignedTemplateData>(
  (data) => {
    const employeeName = data.employeeName?.trim() || "there";
    const assignedByName = data.assignedByName?.trim() || "a team member";
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";
    const companionLine = data.companionName
      ? `Companion: ${data.companionName}`
      : "";
    const actionUrl = data.taskUrl ?? data.ctaUrl;
    const actionLabel = data.ctaLabel?.trim() || "View Task";
    const actionHtml = actionUrl
      ? `
          <table align="center" style="margin:24px auto;">
            <tr>
              <td bgcolor="#2563eb" style="border-radius:6px;">
                <a href="${actionUrl}" style="padding:14px 28px; color:#fff; font-weight:bold;">
                  ${actionLabel}
                </a>
              </td>
            </tr>
          </table>
        `
      : "";
    const actionText = actionUrl ? `${actionLabel}: ${actionUrl}` : "";

    return {
      subject: `New task assigned: ${data.taskName}`,
      contentHtml: `
      <p>Hi ${employeeName},</p>
      <p><strong>${assignedByName}</strong> assigned you a task.</p>
      <p><strong>Task:</strong> ${data.taskName}</p>
      ${data.companionName ? `<p><strong>Companion:</strong> ${data.companionName}</p>` : ""}
      <p><strong>Due:</strong> ${data.dueTime}</p>
      ${data.additionalNotes ? `<p><strong>Notes:</strong> ${data.additionalNotes}</p>` : ""}
      ${actionHtml}
      <p>If you need help, reach out at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    `,
      textBody: `
Hi ${employeeName},

${assignedByName} assigned you a task.
Task: ${data.taskName}
${companionLine}
Due: ${data.dueTime}
${data.additionalNotes ? `Notes: ${data.additionalNotes}` : ""}
${actionText}

Support: ${supportEmail}
      `.trim(),
    };
  },
);

/* ---------- Task Reminder ---------- */

export interface TaskReminderTemplateData {
  employeeName?: string;
  taskName: string;
  companionName?: string;
  dueTime: string;
  taskUrl?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  supportEmail?: string;
}

const buildTaskReminderTemplate = createEmailTemplate<TaskReminderTemplateData>(
  (data) => {
    const employeeName = data.employeeName?.trim() || "there";
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";
    const companionLine = data.companionName
      ? `Companion: ${data.companionName}`
      : "";
    const actionUrl = data.taskUrl ?? data.ctaUrl;
    const actionLabel = data.ctaLabel?.trim() || "View Task";
    const actionHtml = actionUrl
      ? `
          <table align="center" style="margin:24px auto;">
            <tr>
              <td bgcolor="#2563eb" style="border-radius:6px;">
                <a href="${actionUrl}" style="padding:14px 28px; color:#fff; font-weight:bold;">
                  ${actionLabel}
                </a>
              </td>
            </tr>
          </table>
        `
      : "";
    const actionText = actionUrl ? `${actionLabel}: ${actionUrl}` : "";

    return {
      subject: `Task reminder: ${data.taskName}`,
      contentHtml: `
      <p>Hi ${employeeName},</p>
      <p>This is a reminder for your task.</p>
      <p><strong>Task:</strong> ${data.taskName}</p>
      ${data.companionName ? `<p><strong>Companion:</strong> ${data.companionName}</p>` : ""}
      <p><strong>Due:</strong> ${data.dueTime}</p>
      ${actionHtml}
      <p>If you need help, reach out at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    `,
      textBody: `
Hi ${employeeName},

This is a reminder for your task.
Task: ${data.taskName}
${companionLine}
Due: ${data.dueTime}
${actionText}

Support: ${supportEmail}
      `.trim(),
    };
  },
);

/* ---------- Speciality Head Assignment ---------- */

export interface SpecialityHeadAssignedTemplateData {
  employeeName?: string;
  specialityName: string;
  organisationName?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  supportEmail?: string;
}

const buildSpecialityHeadAssignedTemplate =
  createEmailTemplate<SpecialityHeadAssignedTemplateData>((data) => {
    const employeeName = data.employeeName?.trim() || "there";
    const organisationName = data.organisationName?.trim();
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";
    const orgLine = organisationName ? ` at ${organisationName}` : "";
    const actionUrl = data.ctaUrl;
    const actionLabel = data.ctaLabel?.trim() || "Open PMS";
    const actionHtml = actionUrl
      ? `
          <table align="center" style="margin:24px auto;">
            <tr>
              <td bgcolor="#2563eb" style="border-radius:6px;">
                <a href="${actionUrl}" style="padding:14px 28px; color:#fff; font-weight:bold;">
                  ${actionLabel}
                </a>
              </td>
            </tr>
          </table>
        `
      : "";
    const actionText = actionUrl ? `${actionLabel}: ${actionUrl}` : "";

    return {
      subject: `You’re the ${data.specialityName} head${orgLine}`,
      contentHtml: `
      <p>Hi ${employeeName},</p>
      <p>
        You’ve been assigned as the <strong>${data.specialityName}</strong> head${orgLine}.
      </p>
      ${actionHtml}
      <p>If you need help, reach out at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    `,
      textBody: `
Hi ${employeeName},

You’ve been assigned as the ${data.specialityName} head${orgLine}.
${actionText}

Support: ${supportEmail}
      `.trim(),
    };
  });

/* ---------- Free Plan Limit Reached ---------- */

export interface FreePlanLimitReachedTemplateData {
  ownerName?: string;
  organisationName: string;
  limitItems: Array<{ label: string; used: number; limit: number }>;
  ctaUrl?: string;
  ctaLabel?: string;
  supportEmail?: string;
}

const buildFreePlanLimitReachedTemplate =
  createEmailTemplate<FreePlanLimitReachedTemplateData>((data) => {
    const ownerName = data.ownerName?.trim() || "there";
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";
    const actionUrl = data.ctaUrl;
    const actionLabel = data.ctaLabel?.trim() || "Upgrade Plan";
    const limitsHtml = data.limitItems
      .map((item) => `<li>${item.label}: ${item.used} of ${item.limit}</li>`)
      .join("");
    const limitsText = data.limitItems
      .map((item) => `${item.label}: ${item.used} of ${item.limit}`)
      .join("\n");
    const actionHtml = actionUrl
      ? `
          <table align="center" style="margin:24px auto;">
            <tr>
              <td bgcolor="#2563eb" style="border-radius:6px;">
                <a href="${actionUrl}" style="padding:14px 28px; color:#fff; font-weight:bold;">
                  ${actionLabel}
                </a>
              </td>
            </tr>
          </table>
        `
      : "";
    const actionText = actionUrl ? `${actionLabel}: ${actionUrl}` : "";

    return {
      subject: `You've reached your free plan limits`,
      contentHtml: `
      <p>Hi ${ownerName},</p>
      <p>
        Your organisation <strong>${data.organisationName}</strong> has reached its free plan usage limits:
      </p>
      <ul style="padding-left:20px;">
        ${limitsHtml}
      </ul>
      ${actionHtml}
      <p>If you need help, reach out at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    `,
      textBody: `
Hi ${ownerName},

Your organisation ${data.organisationName} has reached its free plan usage limits:
${limitsText}
${actionText}

Support: ${supportEmail}
      `.trim(),
    };
  });

/* ---------- Appointment Payment Checkout ---------- */

export interface AppointmentPaymentCheckoutTemplateData {
  parentName?: string;
  companionName?: string;
  organisationName?: string;
  appointmentTime?: string;
  amountText?: string;
  checkoutUrl: string;
  ctaUrl?: string;
  ctaLabel?: string;
  supportEmail?: string;
}

const buildAppointmentPaymentCheckoutTemplate =
  createEmailTemplate<AppointmentPaymentCheckoutTemplateData>((data) => {
    const parentName = data.parentName?.trim() || "there";
    const organisationName = data.organisationName?.trim() || "Yosemite Crew";
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";
    const actionUrl = data.ctaUrl ?? data.checkoutUrl;
    const actionLabel = data.ctaLabel?.trim() || "Complete Payment";
    const actionHtml = actionUrl
      ? `
          <table align="center" style="margin:24px auto;">
            <tr>
              <td bgcolor="#2563eb" style="border-radius:6px;">
                <a href="${actionUrl}" style="padding:14px 28px; color:#fff; font-weight:bold;">
                  ${actionLabel}
                </a>
              </td>
            </tr>
          </table>
        `
      : "";
    const actionText = actionUrl ? `${actionLabel}: ${actionUrl}` : "";
    const companionLine = data.companionName
      ? `<p><strong>Companion:</strong> ${data.companionName}</p>`
      : "";
    const appointmentLine = data.appointmentTime
      ? `<p><strong>Appointment:</strong> ${data.appointmentTime}</p>`
      : "";
    const amountLine = data.amountText
      ? `<p><strong>Total:</strong> ${data.amountText}</p>`
      : "";

    return {
      subject: `Complete your payment for ${organisationName}`,
      contentHtml: `
      <p>Hi ${parentName},</p>
      <p>
        Your appointment has been booked with <strong>${organisationName}</strong>.
        Please complete payment to confirm the booking.
      </p>
      ${companionLine}
      ${appointmentLine}
      ${amountLine}
      ${actionHtml}
      <p>If you need help, reach out at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    `,
      textBody: `
Hi ${parentName},

Your appointment has been booked with ${organisationName}. Please complete payment to confirm the booking.
${data.companionName ? `Companion: ${data.companionName}` : ""}
${data.appointmentTime ? `Appointment: ${data.appointmentTime}` : ""}
${data.amountText ? `Total: ${data.amountText}` : ""}
${actionText}

Support: ${supportEmail}
      `.trim(),
    };
  });

/* ---------- Invoice Payment Checkout ---------- */

export interface InvoicePaymentCheckoutTemplateData {
  parentName?: string;
  organisationName?: string;
  invoiceId?: string;
  amountText?: string;
  checkoutUrl: string;
  ctaUrl?: string;
  ctaLabel?: string;
  supportEmail?: string;
}

const buildInvoicePaymentCheckoutTemplate =
  createEmailTemplate<InvoicePaymentCheckoutTemplateData>((data) => {
    const parentName = data.parentName?.trim() || "there";
    const organisationName = data.organisationName?.trim() || "Yosemite Crew";
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";
    const actionUrl = data.ctaUrl ?? data.checkoutUrl;
    const actionLabel = data.ctaLabel?.trim() || "Pay Invoice";
    const actionHtml = actionUrl
      ? `
          <table align="center" style="margin:24px auto;">
            <tr>
              <td bgcolor="#2563eb" style="border-radius:6px;">
                <a href="${actionUrl}" style="padding:14px 28px; color:#fff; font-weight:bold;">
                  ${actionLabel}
                </a>
              </td>
            </tr>
          </table>
        `
      : "";
    const actionText = actionUrl ? `${actionLabel}: ${actionUrl}` : "";
    const invoiceLine = data.invoiceId
      ? `<p><strong>Invoice:</strong> ${data.invoiceId}</p>`
      : "";
    const amountLine = data.amountText
      ? `<p><strong>Total:</strong> ${data.amountText}</p>`
      : "";

    return {
      subject: `Invoice payment for ${organisationName}`,
      contentHtml: `
      <p>Hi ${parentName},</p>
      <p>
        A new invoice is ready from <strong>${organisationName}</strong>.
        Please complete payment using the link below.
      </p>
      ${invoiceLine}
      ${amountLine}
      ${actionHtml}
      <p>If you need help, reach out at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    `,
      textBody: `
Hi ${parentName},

A new invoice is ready from ${organisationName}. Please complete payment using the link below.
${data.invoiceId ? `Invoice: ${data.invoiceId}` : ""}
${data.amountText ? `Total: ${data.amountText}` : ""}
${actionText}

Support: ${supportEmail}
      `.trim(),
    };
  });

/* ---------- Permissions Updated ---------- */

export interface PermissionsUpdatedTemplateData {
  employeeName?: string;
  organisationName: string;
  roleName?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  supportEmail?: string;
}

const buildPermissionsUpdatedTemplate =
  createEmailTemplate<PermissionsUpdatedTemplateData>((data) => {
    const employeeName = data.employeeName?.trim() || "there";
    const roleName = data.roleName?.trim();
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";
    const actionUrl = data.ctaUrl;
    const actionLabel = data.ctaLabel?.trim() || "Review Access";
    const actionHtml = actionUrl
      ? `
          <table align="center" style="margin:24px auto;">
            <tr>
              <td bgcolor="#2563eb" style="border-radius:6px;">
                <a href="${actionUrl}" style="padding:14px 28px; color:#fff; font-weight:bold;">
                  ${actionLabel}
                </a>
              </td>
            </tr>
          </table>
        `
      : "";
    const actionText = actionUrl ? `${actionLabel}: ${actionUrl}` : "";
    const roleLine = roleName ? `Your role is now ${roleName}.` : "";

    return {
      subject: "Your PMS permissions were updated",
      contentHtml: `
      <p>Hi ${employeeName},</p>
      <p>
        Your access permissions for <strong>${data.organisationName}</strong> have been updated.
      </p>
      ${roleLine ? `<p>${roleLine}</p>` : ""}
      ${actionHtml}
      <p>If you need help, reach out at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    `,
      textBody: `
Hi ${employeeName},

Your access permissions for ${data.organisationName} have been updated.
${roleLine}
${actionText}

Support: ${supportEmail}
      `.trim(),
    };
  });

type EmailTemplateRegistry = {
  organisationInvite: typeof buildOrganisationInviteTemplate;
  petParentOrganisationInvite: typeof buildPetParentOrganisationInviteTemplate;
  appointmentAssigned: typeof buildAppointmentAssignedTemplate;
  taskAssigned: typeof buildTaskAssignedTemplate;
  taskReminder: typeof buildTaskReminderTemplate;
  specialityHeadAssigned: typeof buildSpecialityHeadAssignedTemplate;
  freePlanLimitReached: typeof buildFreePlanLimitReachedTemplate;
  permissionsUpdated: typeof buildPermissionsUpdatedTemplate;
  appointmentPaymentCheckout: typeof buildAppointmentPaymentCheckoutTemplate;
  invoicePaymentCheckout: typeof buildInvoicePaymentCheckoutTemplate;
};

export const emailTemplates: EmailTemplateRegistry = {
  organisationInvite: buildOrganisationInviteTemplate,
  petParentOrganisationInvite: buildPetParentOrganisationInviteTemplate,
  appointmentAssigned: buildAppointmentAssignedTemplate,
  taskAssigned: buildTaskAssignedTemplate,
  taskReminder: buildTaskReminderTemplate,
  specialityHeadAssigned: buildSpecialityHeadAssignedTemplate,
  freePlanLimitReached: buildFreePlanLimitReachedTemplate,
  permissionsUpdated: buildPermissionsUpdatedTemplate,
  appointmentPaymentCheckout: buildAppointmentPaymentCheckoutTemplate,
  invoicePaymentCheckout: buildInvoicePaymentCheckoutTemplate,
};

export type EmailTemplateId = keyof typeof emailTemplates;
export type EmailTemplateDataMap = {
  [K in EmailTemplateId]: Parameters<(typeof emailTemplates)[K]>[0];
};

export const renderEmailTemplate = <K extends EmailTemplateId>(
  templateId: K,
  data: EmailTemplateDataMap[K],
): RenderedEmailTemplate => {
  const template = emailTemplates[templateId] as (
    input: EmailTemplateDataMap[K],
  ) => RenderedEmailTemplate;
  return template(data);
};

export const renderOrganisationInviteTemplate =
  emailTemplates.organisationInvite;

export const renderPetParentOrganisationInviteEmail =
  emailTemplates.petParentOrganisationInvite;
