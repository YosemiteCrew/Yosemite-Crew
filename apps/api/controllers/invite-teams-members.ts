// controllers/inviteTeamsMembers.ts
import AWS from "aws-sdk";
import { Request, Response } from "express";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { inviteTeamsMembers } from "../models/invite-teams-members";
import { invitedTeamMembersInterface, InvitePayload } from "@yosemite-crew/types";
import crypto from "crypto";
import { ProfileData, WebUser } from "../models/WebUser";
const sesClient = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
});
const cognito = new AWS.CognitoIdentityServiceProvider();
type InviteResult = {
    email: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
};

export const inviteTeamsMembersController = {
    InviteTeamsMembers: async (req: Request, res: Response): Promise<void> => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data: InvitePayload[] = Array.isArray(req.body) ? req.body : [req.body];
        console.log("Received invite data:", data);
        if (!data.length) {
            res.status(400).json({ message: "Request body is empty." });
            return;
        }
        console.log(data)
        const results: InviteResult[] = [];
        const name = await ProfileData.findOne({ userId: data[0].invitedBy })
        console.log(name)
        for (const invite of data) {
            const { email, role, department, invitedBy } = invite;

            if (!email || !role || !department || !invitedBy) {
                results.push({
                    email: email || "unknown",
                    status: "skipped",
                    error: "Missing required fields.",
                });
                continue;
            }

            if (!email.includes("@")) {
                results.push({
                    email,
                    status: "skipped",
                    error: "Invalid email format.",
                });
                continue;
            }

            try {
                const inviteCode = generateInviteCode();

                // Save to DB
                await new inviteTeamsMembers({
                    email,
                    role,
                    department,
                    invitedBy,
                    inviteCode,
                }).save();

                const baseUrl = "http://localhost:3000";
                const inviteLink = `${baseUrl}/signup?inviteCode=${inviteCode}`;

                // Send Email
                const command = new SendEmailCommand({
                    Destination: { ToAddresses: [email] },
                    Message: {
                        Subject: { Data: "You're Invited to Join the Team!" },
                        Body: {
                            Html: {
                                Data: `
            <html>
              <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: auto; padding: 20px;">
                  <h2>You’re Invited to Join Our Team!</h2>
                  <p>Hi <strong>${email}</strong>,</p>
                  <p>Click the button below to accept your invitation.</p>
                  <p style="text-align: center; margin: 30px 0;">
                    <a href="${inviteLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                      Accept Invitation
                    </a>
                  </p>
                  <p><strong>Invited by:</strong> ${name?.businessName ?? "Unknown"}</p>
                  <p style="margin-top: 40px;">Thanks,<br/>Team Yosemite</p>
                </div>
              </body>
            </html>
            `,
                            },
                        },
                    },
                    Source: process.env.MAIL_DRIVER!,
                });

                await sesClient.send(command);

                results.push({ email, status: "sent" });
            } catch (err: unknown) {
                results.push({
                    email,
                    status: "failed",
                    error: err && typeof err === "object" && "message" in err ? (err as { message?: string }).message : "Unknown error",
                });
            }
        }

        res.status(200).json({
            message: "Processed team invitations.",
            invited: results,
        });
    },
    inviteInfo: async (req: Request, res: Response) => {
        const { code } = req.query;

        console.log("Invite Code:", code);

        if (!code) {
            return res.status(400).json({ message: "Invite code is required." });
        }

        const invite = await inviteTeamsMembers.findOne({ inviteCode: code });

        if (!invite) {
            return res.status(404).json({ message: "Invalid or expired invite code." });
        }

        // Use invitedAt instead of createdAt
        if (!invite.invitedAt) {
            return res.status(400).json({ message: "Invite date is missing or invalid." });
        }
        const invitedAt = new Date(invite.invitedAt);
        const now = new Date();
        const diffInMs = now.getTime() - invitedAt.getTime();
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        if (diffInDays > 3) {
            await inviteTeamsMembers.deleteOne({ inviteCode: code });
            return res.status(410).json({ message: "This invite link has expired." });
        }

        return res.status(200).json({
            email: invite.email,
            role: invite.role,
            department: invite.department,
            invitedBy: invite.invitedBy,
        });
    }
    ,
    invitedTeamMembersRegister: async (
        req: Request<invitedTeamMembersInterface>,
        res: Response
    ): Promise<Response> => {
        try {
            const { email, password, role, department, invitedBy } = req.body as invitedTeamMembersInterface;

            // Validate required fields
            if (!email || !password || !role || !department || !invitedBy) {
                return res.status(400).json({ message: "Missing required fields." });
            }

            // Step 1: Check if the user was invited
            const invitedRecord = await inviteTeamsMembers.findOne({ email });
            console.log("hello", invitedRecord)
            if (!invitedRecord) {
                return res.status(403).json({ message: "This email was not invited." });
            }

            // Step 2: Validate invitedBy
            if (invitedRecord.invitedBy !== invitedBy) {
                return res.status(403).json({ message: "Invalid invitation or mismatched invitedBy." });
            }

            // Step 3: Check if user already exists in Cognito
            try {
                const params: AWS.CognitoIdentityServiceProvider.AdminGetUserRequest = {
                    UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB as string,
                    Username: String(email),
                };

                const userData = await cognito.adminGetUser(params).promise();
                const emailVerified = userData.UserAttributes?.find(
                    (attr) => attr.Name === "email_verified"
                )?.Value === "true";

                if (emailVerified) {
                    return res.status(409).json({ message: "User already exists. Please login." });
                }

                // User not verified, resend OTP
                const resendParams: AWS.CognitoIdentityServiceProvider.ResendConfirmationCodeRequest = {
                    ClientId: process.env.COGNITO_CLIENT_ID_WEB as string,
                    Username: String(email),
                };

                if (process.env.COGNITO_CLIENT_SECRET) {
                    resendParams.SecretHash = getSecretHash(String(email));
                }

                await cognito.resendConfirmationCode(resendParams).promise();
                return res.status(200).json({ message: "New OTP sent to your email." });

            } catch (err: unknown) {
                if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code !== "UserNotFoundException") {
                    console.error("Error checking Cognito user:", err);
                    return res.status(500).json({ message: "Error checking user status." });
                }
                // Continue if UserNotFoundException
            }

            // Step 4: Register user in Cognito
            const signUpParams: AWS.CognitoIdentityServiceProvider.SignUpRequest = {
                ClientId: process.env.COGNITO_CLIENT_ID_WEB as string,
                Username: email,
                Password: password,
                UserAttributes: [{ Name: "email", Value: email }],
            };

            if (process.env.COGNITO_CLIENT_SECRET) {
                signUpParams.SecretHash = getSecretHash(email);
            }

            let cognitoResponse;
            try {
                cognitoResponse = await cognito.signUp(signUpParams).promise();
            } catch (err: unknown) {
                if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "UsernameExistsException") {
                    return res.status(409).json({
                        message: "User already exists in Cognito. Please verify your email.",
                    });
                }
                console.error("Cognito Signup Error:", err);
                return res.status(500).json({ message: "Error registering user. Please try again later." });
            }

            // Step 5: Save user to MongoDB
            const newUser = new WebUser({
                cognitoId: String(cognitoResponse.UserSub),
                role: String(role),
                department: String(department),
            });

            await newUser.save();

            return res.status(200).json({
                message: "User registered successfully! Please verify your email with OTP.",
            });

        } catch (error) {
            console.error("Unexpected Error:", error);
            return res.status(500).json({ message: "Internal Server Error. Please try again later." });
        }
    }





};
function getSecretHash(email: string,) {
    const clientId = process.env.COGNITO_CLIENT_ID_WEB;
    const clientSecret: string = process.env.COGNITO_CLIENT_SECRET_WEB as string
    return crypto
        .createHmac("SHA256", clientSecret)
        .update(email + clientId)
        .digest("base64");
}

const generateInviteCode = () => {
    return Math.random().toString(36).substr(2, 8).toUpperCase(); // 8-character code
};
