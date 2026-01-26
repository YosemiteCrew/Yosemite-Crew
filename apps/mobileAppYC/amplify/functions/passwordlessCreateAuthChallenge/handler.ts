import type { CreateAuthChallengeTriggerHandler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const OTP_LENGTH = 4;
const OTP_METADATA_PREFIX = 'PASSWORDLESS_OTP';
const DEMO_PASSWORD_METADATA_PREFIX = 'DEMO_PASSWORD';
const DEMO_LOGIN_EMAIL = 'test@yosemitecrew.com';
const DEMO_LOGIN_PASSWORD = 'Test@YosemiteCrew@1234';
const DEBUG_LOG_OTP = process.env.PASSWORDLESS_DEBUG_LOG_OTP === 'true';

const sesClient = new SESClient({});

const generateOtp = (length: number) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildOtpEmailHtml = (recipientName: string, otp: string) => {
  const safeName = escapeHtml(recipientName);
  const safeOtp = escapeHtml(otp);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Yosemite Crew OTP Email</title>
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
                <td align="left" style="padding:32px 16px; font-family:Arial, sans-serif; font-size:18px; line-height:1.5; color:#595958;">
                  <p style="margin:0 0 16px 0;">Hi ${safeName},</p>
                  <p style="margin:0 0 16px 0;">Your companions are waiting, and so is your OTP! 🐶🐱🐴</p>
                  <p style="margin:0 0 16px 0;">Use this one-time password to continue: <strong>${safeOtp}</strong></p>
                  <p style="margin:0 0 16px 0;">
                    It’s valid for the next 10 minutes, so don’t let your dog chew it up or your cat nap on it too long. 😺
                  </p>
                  <p style="margin:0 0 16px 0;">
                    If you didn’t request this code, you can safely ignore this email.
                  </p>
                  <p style="margin:0;">
                    See you inside, <br />
                    Yosemite Crew Team
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0; margin:0;">
                  <img
                    src="https://d2il6osz49gpup.cloudfront.net/Images/landingbg1.jpg"
                    alt="Yosemite Crew"
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
                                      style="display:block;"
                                    />
                                  </td>
                                  <td style="padding-right:8px; padding-bottom:8px;">
                                    <img
                                      src="https://d2il6osz49gpup.cloudfront.net/footer/soc-2.png"
                                      alt="SOC 2"
                                      width="56"
                                      height="56"
                                      style="display:block;"
                                    />
                                  </td>
                                  <td style="padding-right:8px; padding-bottom:8px;">
                                    <img
                                      src="https://d2il6osz49gpup.cloudfront.net/footer/iso.png"
                                      alt="ISO"
                                      width="54"
                                      height="60"
                                      style="display:block;"
                                    />
                                  </td>
                                  <td style="padding-bottom:8px;">
                                    <img
                                      src="https://d2il6osz49gpup.cloudfront.net/footer/fhir.png"
                                      alt="FHIR"
                                      width="117"
                                      height="28"
                                      style="display:block;"
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
                              <p style="margin:0 0 8px 0; font-size:16px; font-weight:600; color:#2b2b2b;">Developers</p>
                              <p style="margin:0 0 6px 0; font-size:14px;">
                                <a href="https://www.yosemitecrew.com/developers/signup" target="_blank" style="color:#2b2b2b; text-decoration:none;">
                                  Developer portal
                                </a>
                              </p>
                              <p style="margin:0; font-size:14px;">
                                <a href="https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md" target="_blank" style="color:#2b2b2b; text-decoration:none;">
                                  Contributing
                                </a>
                              </p>
                            </td>
                            <td valign="top" style="padding:4px 8px;">
                              <p style="margin:0 0 8px 0; font-size:16px; font-weight:600; color:#2b2b2b;">Community</p>
                              <p style="margin:0 0 6px 0; font-size:14px;">
                                <a href="https://discord.gg/yosemitecrew" target="_blank" style="color:#2b2b2b; text-decoration:none;">
                                  Discord
                                </a>
                              </p>
                              <p style="margin:0; font-size:14px;">
                                <a href="https://github.com/YosemiteCrew/Yosemite-Crew" target="_blank" style="color:#2b2b2b; text-decoration:none;">
                                  GitHub
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
            </table>
          </td>
        </tr>
      </table>
    </center>
  </body>
</html>`;
};

const buildOtpEmailText = (recipientName: string, otp: string) =>
  `Hi ${recipientName},

Your companions are waiting, and so is your OTP!

Use this one-time password to continue: ${otp}

It’s valid for the next 10 minutes, so don’t let your dog chew it up or your cat nap on it too long.

If you didn’t request this code, you can safely ignore this email.

See you inside,
Yosemite Crew Team`;

const resolveRecipientName = (
  event: Parameters<CreateAuthChallengeTriggerHandler>[0],
  fallbackEmail: string,
): string => {
  const metadataName = event.request.clientMetadata?.firstName?.trim();
  if (metadataName) {
    return metadataName;
  }

  const attrs = event.request.userAttributes ?? {};
  const candidateKeys = ['given_name', 'name', 'custom:first_name', 'preferred_username'];
  for (const key of candidateKeys) {
    const value = attrs[key];
    if (value && value.trim() && !value.includes('@')) {
      return value.trim();
    }
  }

  if (fallbackEmail.includes('@')) {
    const localPart = fallbackEmail.split('@')[0];
    if (localPart) {
      return localPart;
    }
  }
  return 'there';
};

const sendOtpEmail = async (email: string, otp: string, recipientName: string) => {
  const fromEmail = process.env.PASSWORDLESS_OTP_EMAIL_FROM;
  const subject = process.env.PASSWORDLESS_OTP_EMAIL_SUBJECT ?? 'Your login code';

  if (!fromEmail) {
    if (DEBUG_LOG_OTP) {
      console.log(`DEBUG PASSWORDLESS OTP for ${email}:`, otp);
    }
    return;
  }

  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: buildOtpEmailHtml(recipientName, otp) },
        Text: { Data: buildOtpEmailText(recipientName, otp) },
      },
    },
  });

  await sesClient.send(command);
};

const resolveEmail = (event: Parameters<CreateAuthChallengeTriggerHandler>[0]): string | null => {
  const metadataEmail = event.request.clientMetadata?.loginEmail?.trim();
  if (metadataEmail && metadataEmail.includes('@')) {
    return metadataEmail.toLowerCase();
  }
  const userAttrs = event.request.userAttributes || {};
  if (userAttrs.email && userAttrs.email.trim().includes('@')) {
    return userAttrs.email.trim().toLowerCase();
  }
  if (userAttrs.preferred_username && userAttrs.preferred_username.trim().includes('@')) {
    return userAttrs.preferred_username.trim().toLowerCase();
  }
  if (event.userName && event.userName.trim().includes('@')) {
    return event.userName.trim().toLowerCase();
  }
  return null;
};

export const handler: CreateAuthChallengeTriggerHandler = async (event) => {
  console.log('Passwordless create-auth challenge invoked', {
    userName: event.userName,
    clientMetadata: event.request.clientMetadata,
    userAttributes: event.request.userAttributes,
  });

  const email = resolveEmail(event);

  if (!email) {
    console.error('Passwordless create-auth challenge missing email', {
      userName: event.userName,
      clientMetadata: event.request.clientMetadata,
      userAttributes: event.request.userAttributes,
    });
    throw new Error('Cannot issue passwordless challenge without an email address.');
  }

  console.log('Passwordless create-auth challenge resolved email', { email });

  const session = event.request.session ?? [];
  const previousChallenge = session[session.length - 1];
  const previousMetadata = previousChallenge?.challengeMetadata;
  const previousResult = previousChallenge?.challengeResult;

  const isDemoLogin = email === DEMO_LOGIN_EMAIL;

  let challengeAnswer: string | null = null;
  let challengeMetadataPrefix = OTP_METADATA_PREFIX;
  let shouldSendEmail = !isDemoLogin;

  if (
    previousMetadata?.startsWith(`${OTP_METADATA_PREFIX}:`) &&
    previousResult === false
  ) {
    const parts = previousMetadata.split(':');
    if (parts.length >= 2 && parts[1]) {
      challengeAnswer = parts[1];
      shouldSendEmail = false;
    }
  }

  if (previousMetadata?.startsWith(`${DEMO_PASSWORD_METADATA_PREFIX}:`)) {
    challengeAnswer = DEMO_LOGIN_PASSWORD;
    challengeMetadataPrefix = DEMO_PASSWORD_METADATA_PREFIX;
    shouldSendEmail = false;
  }

  if (isDemoLogin) {
    challengeAnswer = DEMO_LOGIN_PASSWORD;
    challengeMetadataPrefix = DEMO_PASSWORD_METADATA_PREFIX;
    shouldSendEmail = false;
  }

  if (!challengeAnswer) {
    challengeAnswer = generateOtp(OTP_LENGTH);
    challengeMetadataPrefix = OTP_METADATA_PREFIX;
    shouldSendEmail = true;
  }

  const recipientName = resolveRecipientName(event, email);

  if (shouldSendEmail) {
    await sendOtpEmail(email, challengeAnswer, recipientName);
  }

  event.response.publicChallengeParameters = {
    deliveryMedium: shouldSendEmail ? 'EMAIL' : 'DEMO_PASSWORD',
    demoLogin: isDemoLogin ? 'true' : 'false',
  };
  event.response.privateChallengeParameters = {
    answer: challengeAnswer,
    challengeType: challengeMetadataPrefix,
  };
  event.response.challengeMetadata = `${challengeMetadataPrefix}:${challengeAnswer}:${Date.now()}`;

  return event;
};
