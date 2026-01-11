export type DateLike = Date | string | number;

export interface RenderedEmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

const formatDate = (date: DateLike): string =>
  date instanceof Date
    ? date.toUTCString()
    : new Date(date).toUTCString();

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
      <table role="presentation" width="100%">
        <tr>
          <td align="center">
            <table role="presentation" width="600" style="background-color:#ffffff;">

              <!-- Header -->
              <tr>
                <td align="center" style="border-bottom:2px solid #7d7d7d;">
                  <a href="https://www.yosemitecrew.com/">
                    <img
                      src="https://d2il6osz49gpup.cloudfront.net/Logo.png"
                      alt="Yosemite Crew Logo"
                      width="110"
                      height="100"
                    />
                  </a>
                </td>
              </tr>

              <!-- Content -->
              ${contentHtml}

              <!-- Hero Image -->
              <tr>
                <td align="center">
                  <img
                    src="https://d2il6osz49gpup.cloudfront.net/Images/landingbg1.jpg"
                    width="600"
                    style="width:100%;"
                  />
                </td>
              </tr>

              <!-- Footer Decoration -->
              <tr>
                <td align="center" style="background-color:#f4f8ff; padding-top:24px;">
                  <img
                    src="https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
                    width="60"
                    height="60"
                  />
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="background-color:#f4f8ff; padding:24px;">
                  <!-- reuse OTP footer here -->
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
  expiresAt: DateLike;
  supportEmail?: string;
}

export const renderOrganisationInviteTemplate = createEmailTemplate<
  OrganisationInviteTemplateData
>((data) => {
  const inviteeName = data.inviteeName?.trim() || "there";
  const organisationName = data.organisationName.trim();
  const inviterName = data.inviterName?.trim() || "a team member";
  const expiry = formatDate(data.expiresAt);
  const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";

  return {
    subject: `You’re invited to join ${organisationName} on Yosemite Crew`,
    contentHtml: `
      <tr>
        <td style="padding:32px 16px; font-family:Arial; font-size:18px;">
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

          <p>Expires on <strong>${expiry}</strong></p>
          <p>Need help? <a href="mailto:${supportEmail}">${supportEmail}</a></p>
        </td>
      </tr>
    `,
    textBody: `
Hi ${inviteeName},

${inviterName} invited you to join ${organisationName}.
Accept: ${data.acceptUrl}

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

export const renderPetParentOrganisationInviteEmail =
  createEmailTemplate<PetParentOrganisationInviteData>((data) => {
    const organisationName = data.organisationName.trim();
    const petParentName = data.petParentName.trim();
    const expiry = formatDate(data.expiresAt);
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";

    return {
      subject: `${petParentName} invited you to join Yosemite Crew PMS`,
      contentHtml: `
        <tr>
          <td style="padding:32px 16px; font-family:Arial; font-size:18px; line-height:1.5; color:#595958;">
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
          </td>
        </tr>
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


