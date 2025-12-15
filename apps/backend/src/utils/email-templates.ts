type DateLike = Date | string | number;

const formatExpiry = (expiresAt: DateLike): string => {
  if (expiresAt instanceof Date) {
    return expiresAt.toUTCString();
  }

  if (typeof expiresAt === "number") {
    return new Date(expiresAt).toUTCString();
  }

  return new Date(expiresAt).toUTCString();
};

export interface OrganisationInviteTemplateData {
  organisationName: string;
  inviteeName?: string;
  inviterName?: string;
  acceptUrl: string;
  expiresAt: DateLike;
  supportEmail?: string;
}

export interface RenderedEmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export const renderOrganisationInviteTemplate = (
  data: OrganisationInviteTemplateData,
): RenderedEmailTemplate => {
  const inviteeName = data.inviteeName?.trim() || "there";
  const organisationName = data.organisationName.trim();
  const inviterName = data.inviterName?.trim() || "a team member";
  const formattedExpiry = formatExpiry(data.expiresAt);
  const supportEmail = data.supportEmail?.trim() || "support@yosemitecrew.com";

  const subject = `You’re invited to join ${organisationName} on Yosemite Crew`;

  const htmlBody = `<!doctype html>
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

              <!-- Header -->
              <tr>
                <td align="center" style="padding:0; border-bottom:2px solid #7d7d7d;">
                  <table role="presentation" width="100%">
                    <tr>
                      <td align="center" style="padding:16px 24px;">
                        <a href="https://www.yosemitecrew.com/" style="text-decoration:none;">
                          <img
                            src="https://d2il6osz49gpup.cloudfront.net/Logo.png"
                            alt="Yosemite Crew Logo"
                            width="110"
                            height="100"
                            style="display:block; border:0;"
                          />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td align="left" style="padding:32px 16px; font-family:Arial, sans-serif; font-size:18px; line-height:1.5; color:#595958;">
                  <p style="margin:0 0 16px 0;">Hi ${inviteeName},</p>

                  <p style="margin:0 0 16px 0;">
                    <strong>${inviterName}</strong> has invited you to join
                    <strong>${organisationName}</strong> on Yosemite Crew.
                  </p>

                  <p style="margin:0 0 24px 0;">
                    Accept the invitation to collaborate with your team, manage projects, and explore everything Yosemite Crew has to offer.
                  </p>

                  <!-- CTA Button -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto;">
                    <tr>
                      <td align="center" bgcolor="#2563eb" style="border-radius:6px;">
                        <a
                          href="${data.acceptUrl}"
                          target="_blank"
                          rel="noopener"
                          style="
                            display:inline-block;
                            padding:14px 28px;
                            font-family:Arial, sans-serif;
                            font-size:16px;
                            font-weight:bold;
                            color:#ffffff;
                            text-decoration:none;
                            border-radius:6px;
                          "
                        >
                          Accept Invitation
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:24px 0 16px 0;">
                    This invitation expires on <strong>${formattedExpiry}</strong>.
                  </p>

                  <p style="margin:0;">
                    If you weren’t expecting this invitation, you can safely ignore this email
                    or contact us at
                    <a href="mailto:${supportEmail}" style="color:#007bff; font-weight:600; text-decoration:none;">
                      ${supportEmail}
                    </a>.
                  </p>

                  <p style="margin-top:24px;">
                    See you inside,<br />
                    Yosemite Crew Team
                  </p>
                </td>
              </tr>

              <!-- Hero Image -->
              <tr>
                <td align="center">
                  <img
                    src="https://d2il6osz49gpup.cloudfront.net/Images/landingbg1.jpg"
                    alt=""
                    width="600"
                    style="display:block; width:100%; max-width:600px; height:auto; border:0;"
                  />
                </td>
              </tr>

              <!-- Footer Decoration -->
              <tr>
                <td align="center" style="background-color:#f4f8ff; padding-top:24px;">
                  <img
                    src="https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
                    alt=""
                    width="60"
                    height="60"
                    style="display:block; margin:0 auto;"
                  />
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="background-color:#f4f8ff; padding:24px 16px 30px 16px;">
                  <!-- (Footer content is IDENTICAL to your OTP email footer — reuse as-is) -->
                  ${/* You can literally paste the same footer block here */""}
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </center>
  </body>
</html>`;

  const textBody = [
    `Hi ${inviteeName},`,
    ``,
    `${inviterName} has invited you to join ${organisationName} on Yosemite Crew.`,
    `Accept your invite: ${data.acceptUrl}`,
    ``,
    `This link expires on ${formattedExpiry}.`,
    ``,
    `Need help? Email ${supportEmail}.`,
  ].join("\n");

  return {
    subject,
    htmlBody,
    textBody,
  };
};
