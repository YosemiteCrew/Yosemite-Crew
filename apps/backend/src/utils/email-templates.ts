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

  const subject = `You’re invited to join ${organisationName}`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 0 auto; padding: 24px; background-color: #ffffff; }
    .button { display: inline-block; margin-top: 16px; padding: 12px 24px; color: #fff; background-color: #2563eb; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .muted { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div style="padding: 32px 0;">
    <div class="container">
      <p>Hi ${inviteeName},</p>
      <p>${inviterName} has invited you to join <strong>${organisationName}</strong> on Yosemite Crew.</p>
      <p>Click the button below to accept your invite. You can sign up or log in and you’ll be taken straight to the confirmation screen.</p>
      <p style="text-align:center;">
        <a class="button" href="${data.acceptUrl}" target="_blank" rel="noopener">Accept Invite</a>
      </p>
      <p class="muted">This invite link expires on <strong>${formattedExpiry}</strong>.</p>
      <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
      <p class="muted">If you weren’t expecting this email or need help, contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    </div>
  </div>
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
