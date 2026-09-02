export type DateLike = Date | string | number;

export interface RenderedEmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

const formatDate = (date: DateLike): string =>
  date instanceof Date ? date.toUTCString() : new Date(date).toUTCString();

/**
 * Design tokens, resolved to literal values.
 *
 * Email HTML cannot use CSS custom properties, so each value below is the
 * concrete hex for the matching token in the Yosemite Crew design system
 * (tokens/colors.css). Keep this table in sync when the design system moves;
 * the token name in the comment is the source of truth.
 */
const T = {
  page: "#efe8dc", // --page          app background (warm bone)
  screen: "#f7f3ec", // --screen        card / panel surface
  screen2: "#f1ebe1", // --screen-2      secondary surface inside a card
  hairline: "#e5dccf", // --hairline      1px borders
  inkBody: "#302f2e", // --ink-body      body copy
  inkMuted: "#5c5956", // --ink-muted     labels, secondary copy
  inkFaint: "#8f8984", // --ink-faint     legal / fine print
  blue: "#257bed", // --blue          links
  ctaBg: "#302f2e", // --cta           primary button fill
  ctaText: "#ffffff", // --cta-text      primary button label
  // Dark scheme counterparts (progressive enhancement - see the <style> block).
  darkPage: "#201c18",
  darkScreen: "#2f271e",
  darkHairline: "#40362b",
  darkInkBody: "#e6ddd0",
  darkInkMuted: "#a89e90",
  darkBlue: "#8fb6f5",
  darkCtaBg: "#f2ece1",
  darkCtaText: "#201c18",
} as const;

/** --font-serif. Newsreader is not loadable in most mail clients; Georgia is the fallback that ships. */
const FONT_SERIF = "'Newsreader', Georgia, 'Times New Roman', serif";
/** --font-sans. Satoshi rarely loads in mail clients, so fall through to the system stack. */
const FONT_SANS =
  "'Satoshi Variable', 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const CDN = "https://d2il6osz49gpup.cloudfront.net";

/**
 * Primary call to action.
 *
 * Rendered as a padded table cell rather than a styled anchor so that Outlook
 * desktop still shows a filled block. Outlook ignores border-radius, so the
 * pill degrades to a rectangle there - deliberate, not a bug.
 */
export const renderEmailButton = (url: string, label: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 8px auto;">
    <tr>
      <td align="center" bgcolor="${T.ctaBg}" class="yc-btn-cell" style="background-color:${T.ctaBg}; border-radius:999px;">
        <a
          href="${url}"
          target="_blank"
          class="yc-btn"
          style="display:inline-block; padding:14px 32px; font-family:${FONT_SANS}; font-size:16px; font-weight:600; line-height:1; letter-spacing:-0.01em; color:${T.ctaText}; text-decoration:none; border-radius:999px;"
        >${label}</a>
      </td>
    </tr>
  </table>
`;

/** Secondary action. Outlined rather than filled so it never competes with the primary. */
export const renderEmailSecondaryButton = (
  url: string,
  label: string,
): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:12px auto 0 auto;">
    <tr>
      <td align="center" style="border:1px solid ${T.hairline}; border-radius:999px;" class="yc-rule">
        <a
          href="${url}"
          target="_blank"
          class="yc-muted"
          style="display:inline-block; padding:12px 28px; font-family:${FONT_SANS}; font-size:15px; font-weight:500; line-height:1; color:${T.inkMuted}; text-decoration:none; border-radius:999px;"
        >${label}</a>
      </td>
    </tr>
  </table>
`;

const footerLink = (href: string, label: string): string => `
  <p style="margin:0 0 8px 0; font-family:${FONT_SANS}; font-size:14px; line-height:1.4;">
    <a href="${href}" target="_blank" style="color:${T.inkMuted}; text-decoration:none;" class="yc-muted">${label}</a>
  </p>
`;

const complianceBadge = (
  file: string,
  alt: string,
  w: number,
  h: number,
): string => `
  <td style="padding:0 6px 0 0;">
    <img src="${CDN}/footer/${file}" alt="${alt}" width="${w}" height="${h}" style="display:block; border:0; outline:none; text-decoration:none;" />
  </td>
`;

const renderBaseEmail = (
  subject: string,
  contentHtml: string,
  preheader?: string,
  title?: string,
): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${subject}</title>
    <style>
      /* Fluid down to phone widths. Clients that ignore <style> keep the 600px table. */
      @media only screen and (max-width: 620px) {
        .yc-shell { width: 100% !important; }
        .yc-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .yc-title { font-size: 26px !important; }
        .yc-col { display: block !important; width: 100% !important; padding-bottom: 20px !important; }
      }
      /* Dark scheme. Apple Mail and iOS honour this; Gmail largely ignores it and keeps the light palette, which is why every colour is also inlined. */
      @media (prefers-color-scheme: dark) {
        .yc-page { background-color: ${T.darkPage} !important; }
        .yc-card { background-color: ${T.darkScreen} !important; border-color: ${T.darkHairline} !important; }
        .yc-body, .yc-body p, .yc-body li, .yc-body strong { color: ${T.darkInkBody} !important; }
        .yc-title { color: ${T.darkInkBody} !important; }
        .yc-muted { color: ${T.darkInkMuted} !important; }
        .yc-rule { border-color: ${T.darkHairline} !important; }
        .yc-link { color: ${T.darkBlue} !important; }
        .yc-btn { background-color: ${T.darkCtaBg} !important; color: ${T.darkCtaText} !important; }
        .yc-btn-cell { background-color: ${T.darkCtaBg} !important; }
      }
    </style>
  </head>
  <body class="yc-page" style="margin:0; padding:0; background-color:${T.page}; -webkit-font-smoothing:antialiased;">
    <!-- Preview text shown in the inbox list before the mail is opened. -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${preheader ?? subject}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="yc-page" style="background-color:${T.page};">
      <tr>
        <td align="center" style="padding:32px 16px;">

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="yc-shell" style="width:600px; max-width:100%;">

            <!-- Logo, sitting on the page ground above the card -->
            <tr>
              <td align="center" style="padding:0 0 24px 0;">
                <a href="https://www.yosemitecrew.com/" target="_blank" style="text-decoration:none;">
                  <img src="${CDN}/Logo.png" alt="Yosemite Crew" width="96" height="87" style="display:block; border:0; outline:none; text-decoration:none;" />
                </a>
              </td>
            </tr>

            <!-- Message card -->
            <tr>
              <td class="yc-card" style="background-color:${T.screen}; border:1px solid ${T.hairline}; border-radius:20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td class="yc-pad yc-body" style="padding:40px; font-family:${FONT_SANS}; font-size:16px; line-height:1.5; letter-spacing:-0.02em; color:${T.inkBody};">
                      <h1 class="yc-title" style="margin:0 0 24px 0; font-family:${FONT_SERIF}; font-size:32px; font-weight:400; line-height:1.2; letter-spacing:-0.02em; color:${T.inkBody};">${title ?? subject}</h1>
                      ${contentHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Compliance marks. The badge PNGs are dark ink, so they sit on a
                 permanently light chip - it must NOT invert in dark mode or they vanish. -->
            <tr>
              <td align="center" style="padding:32px 0 0 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${T.screen2}" style="background-color:${T.screen2}; border-radius:999px;">
                  <tr>
                    <td style="padding:10px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    ${complianceBadge("gdpr.png", "GDPR", 46, 47)}
                    ${complianceBadge("soc-2.png", "SOC 2", 47, 47)}
                    ${complianceBadge("iso.png", "ISO", 45, 50)}
                    <td style="padding:0;">
                      <img src="${CDN}/footer/fhir.png" alt="FHIR" width="98" height="23" style="display:block; border:0; outline:none; text-decoration:none;" />
                    </td>
                  </tr>
                </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 8px 0 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td class="yc-rule" style="border-top:1px solid ${T.hairline}; font-size:0; line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer links -->
            <tr>
              <td class="yc-pad" style="padding:24px 8px 0 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td class="yc-col" valign="top" width="33%" style="padding:0 8px 0 0;">
                      <p style="margin:0 0 10px 0; font-family:${FONT_SANS}; font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:${T.inkFaint};" class="yc-muted">Developers</p>
                      ${footerLink("https://www.yosemitecrew.com/developers/signup", "Developer portal")}
                      ${footerLink("https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md", "Contributing")}
                    </td>
                    <td class="yc-col" valign="top" width="33%" style="padding:0 8px;">
                      <p style="margin:0 0 10px 0; font-family:${FONT_SANS}; font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:${T.inkFaint};" class="yc-muted">Community</p>
                      ${footerLink("https://discord.gg/SwM6mX85KD", "Discord")}
                      ${footerLink("https://github.com/YosemiteCrew/Yosemite-Crew", "GitHub")}
                    </td>
                    <td class="yc-col" valign="top" width="33%" style="padding:0 0 0 8px;">
                      <p style="margin:0 0 10px 0; font-family:${FONT_SANS}; font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:${T.inkFaint};" class="yc-muted">Company</p>
                      ${footerLink("https://www.yosemitecrew.com/about", "About us")}
                      ${footerLink("https://www.yosemitecrew.com/pricing", "Pricing")}
                      ${footerLink("https://www.yosemitecrew.com/terms-and-conditions", "Terms and conditions")}
                      ${footerLink("https://www.yosemitecrew.com/privacy-policy", "Privacy policy")}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Impressum. Required disclosure under German law - do not trim. -->
            <tr>
              <td class="yc-pad" align="center" style="padding:24px 8px 8px 8px;">
                <p style="margin:0 0 6px 0; font-family:${FONT_SANS}; font-size:12px; line-height:1.5; color:${T.inkFaint}; text-align:center;" class="yc-muted">
                  Copyright &copy; 2026 DuneXploration
                </p>
                <p style="margin:0 0 6px 0; font-family:${FONT_SANS}; font-size:12px; line-height:1.5; color:${T.inkFaint}; text-align:center;" class="yc-muted">
                  DuneXploration UG (haftungsbeschraenkt), Am Finther Weg 7, 55127 Mainz<br />
                  <a href="mailto:support@yosemitecrew.com" style="color:${T.blue}; text-decoration:none;" class="yc-link">support@yosemitecrew.com</a>
                  &nbsp;&middot;&nbsp;
                  <a href="tel:+4915227763275" style="color:${T.blue}; text-decoration:none;" class="yc-link">+49 152 277 63275</a>
                </p>
                <p style="margin:0; font-family:${FONT_SANS}; font-size:12px; line-height:1.5; color:${T.inkFaint}; text-align:center;" class="yc-muted">
                  Geschaeftsfuehrer: Ankit Upadhyay &middot; Amtsgericht Mainz HRB 52778 &middot; VAT DE367920596
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

type EmailTemplateBuilder<T> = (data: T) => {
  subject: string;
  contentHtml: string;
  textBody: string;
  /** Serif headline inside the card. Falls back to the subject line. */
  title?: string;
  /** Inbox preview snippet. Falls back to the subject line. */
  preheader?: string;
};

/**
 * Escape a value for interpolation into email HTML.
 *
 * Template data carries free text people typed - companion and staff names,
 * task notes, organisation names - straight into the markup below. Without this
 * a name like `<img src=x onerror=...>` is delivered as live markup in the
 * recipient's mail client.
 *
 * Applied to URLs too: `&` -> `&amp;` is the correct encoding inside an `href`
 * attribute and mail clients decode it, while `"` -> `&quot;` is what stops a
 * crafted URL from breaking out of the attribute.
 */
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// Template data is assembled from records, so nesting is shallow in practice -
// but this recurses over whatever it is handed. A deeply nested value would
// exhaust the stack, and a cyclic one would never terminate at all, so both are
// bounded. Past the limit the value is returned unescaped-but-untouched, which
// is safe: escaping applies to the strings it does reach, and a structure this
// deep is not something a template renders.
const MAX_ESCAPE_DEPTH = 100;

const escapeDeepValue = <T>(
  value: T,
  depth: number,
  seen: WeakSet<object>,
): T => {
  if (typeof value === "string") return escapeHtml(value) as unknown as T;
  if (depth >= MAX_ESCAPE_DEPTH) return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    return value.map((item) =>
      escapeDeepValue(item, depth + 1, seen),
    ) as unknown as T;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (seen.has(value)) return value;
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        escapeDeepValue(item, depth + 1, seen),
      ]),
    ) as unknown as T;
  }
  return value;
};

const escapeDeep = <T>(value: T): T =>
  escapeDeepValue(value, 0, new WeakSet<object>());

/**
 * Builders are pure, so run each one twice: once over escaped data for the HTML
 * body, once over the raw data for the subject and plaintext body (which must
 * NOT carry entities). This escapes every template at one choke point instead of
 * relying on each of them to remember.
 */
const createEmailTemplate =
  <T>(builder: EmailTemplateBuilder<T>) =>
  (data: T): RenderedEmailTemplate => {
    // Raw for the subject line and the plaintext body, which must NOT carry
    // entities. Everything that lands in the HTML - the content, the preheader,
    // the document title - comes from the escaped pass instead.
    const { subject, textBody } = builder(data);
    const {
      contentHtml,
      title: escapedTitle,
      preheader: escapedPreheader,
    } = builder(escapeDeep(data));

    return {
      subject,
      htmlBody: renderBaseEmail(
        escapeHtml(subject),
        contentHtml,
        escapedPreheader,
        escapedTitle,
      ),
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
          ${renderEmailSecondaryButton(data.declineUrl, "Decline Invitation")}
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

      ${renderEmailButton(data.acceptUrl, "Accept Invitation")}
      ${declineHtml}

      <p>Expires on <strong>${expiry}</strong></p>
      <p>Need help? <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a></p>
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

        ${renderEmailButton(data.acceptUrl, "Join PMS")}

        <p style="margin-top:24px;">
          This invitation expires on <strong>${expiry}</strong>.
        </p>

        <p style="font-size:16px;">
          If you weren’t expecting this invitation, you can safely ignore this email.
          For assistance, contact
          <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.
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
          ${renderEmailButton(actionUrl, actionLabel)}
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
      <p>If you need help, reach out at <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.</p>
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
          ${renderEmailButton(actionUrl, actionLabel)}
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
      <p>If you need help, reach out at <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.</p>
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
          ${renderEmailButton(actionUrl, actionLabel)}
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
      <p>If you need help, reach out at <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.</p>
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
          ${renderEmailButton(actionUrl, actionLabel)}
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
      <p>If you need help, reach out at <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.</p>
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
          ${renderEmailButton(actionUrl, actionLabel)}
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
      <p>If you need help, reach out at <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.</p>
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
          ${renderEmailButton(actionUrl, actionLabel)}
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
      <p>If you need help, reach out at <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.</p>
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
          ${renderEmailButton(actionUrl, actionLabel)}
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
      <p>If you need help, reach out at <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.</p>
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
          ${renderEmailButton(actionUrl, actionLabel)}
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
      <p>If you need help, reach out at <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.</p>
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
  adverseEventReported: typeof buildAdverseEventReportedTemplate;
};

export interface AdverseEventReportedTemplateData {
  organisationName?: string;
  reporterName: string;
  reporterEmail?: string;
  reporterPhone?: string;
  companionName: string;
  productName: string;
  brandName?: string;
  batchNumber?: string;
  quantityUsed?: string;
  administrationMethod?: string;
  eventDate?: string;
  conditionBefore?: string;
  conditionAfter?: string;
  authorityName?: string;
  authorityUrl?: string;
  reportUrl?: string;
  supportEmail?: string;
}

/**
 * Sent to the clinic a pet owner linked their adverse-event report to.
 *
 * This is currently the ONLY way a practice learns the report exists: the
 * report is stored org-scoped and reachable over the API, but apps/frontend
 * has no screen for adverse events, so nothing surfaces it in the PIMS.
 *
 * It deliberately does not tell the clinic the report has been filed with
 * anyone. Nothing is transmitted to a regulator or a manufacturer - see
 * regulatory-authority-seed.data.ts - so the mail states where the owner can
 * file it themselves, and leaves the filing to a human.
 */
const buildAdverseEventReportedTemplate =
  createEmailTemplate<AdverseEventReportedTemplateData>((data) => {
    const supportEmail = data.supportEmail ?? "support@yosemitecrew.com";
    const organisationName = data.organisationName?.trim() || "your practice";
    const product = data.brandName
      ? `${data.productName} (${data.brandName})`
      : data.productName;

    const detail = (label: string, value?: string) =>
      value?.trim()
        ? `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
        : "";
    const detailText = (label: string, value?: string) =>
      value?.trim() ? `${label}: ${value}` : "";

    const authorityHtml = data.authorityName
      ? `<p>Adverse events for this market are handled by <strong>${escapeHtml(data.authorityName)}</strong>.` +
        (data.authorityUrl
          ? ` Reporting guidance: <a href="${escapeHtml(data.authorityUrl)}" style="color:#257bed; text-decoration:none;" class="yc-link">${escapeHtml(data.authorityUrl)}</a>.`
          : "") +
        `</p>
         <p>Yosemite Crew has <strong>not</strong> forwarded this report to them, or to the manufacturer. Nothing has left the practice.</p>`
      : `<p>Yosemite Crew has <strong>not</strong> forwarded this report to a regulator or manufacturer. Nothing has left the practice.</p>`;

    return {
      subject: `Adverse event reported for ${data.companionName}: ${data.productName}`,
      contentHtml: `
      <p>Hi ${escapeHtml(organisationName)},</p>
      <p><strong>${escapeHtml(data.reporterName)}</strong> reported a suspected adverse event for <strong>${escapeHtml(data.companionName)}</strong>.</p>
      ${detail("Product", product)}
      ${detail("Batch number", data.batchNumber)}
      ${detail("Amount used", data.quantityUsed)}
      ${detail("How it was given", data.administrationMethod)}
      ${detail("When it happened", data.eventDate)}
      ${detail("Condition before", data.conditionBefore)}
      ${detail("Condition after", data.conditionAfter)}
      ${detail("Reporter email", data.reporterEmail)}
      ${detail("Reporter phone", data.reporterPhone)}
      ${authorityHtml}
      ${data.reportUrl ? renderEmailButton(data.reportUrl, "View the report") : ""}
      <p>If you need help, reach out at <a href="mailto:${supportEmail}" style="color:#257bed; text-decoration:none;" class="yc-link">${supportEmail}</a>.</p>
    `,
      textBody: `
Hi ${organisationName},

${data.reporterName} reported a suspected adverse event for ${data.companionName}.

${detailText("Product", product)}
${detailText("Batch number", data.batchNumber)}
${detailText("Amount used", data.quantityUsed)}
${detailText("How it was given", data.administrationMethod)}
${detailText("When it happened", data.eventDate)}
${detailText("Condition before", data.conditionBefore)}
${detailText("Condition after", data.conditionAfter)}
${detailText("Reporter email", data.reporterEmail)}
${detailText("Reporter phone", data.reporterPhone)}

${data.authorityName ? `Adverse events for this market are handled by ${data.authorityName}.` : ""}
${data.authorityUrl ? `Reporting guidance: ${data.authorityUrl}` : ""}
Yosemite Crew has NOT forwarded this report to a regulator or manufacturer. Nothing has left the practice.

${data.reportUrl ? `View the report: ${data.reportUrl}` : ""}

Need help? ${supportEmail}
      `,
    };
  });

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
  adverseEventReported: buildAdverseEventReportedTemplate,
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
