// controllers/inviteTeamsMembers.ts
import AWS from "aws-sdk";
import { Request, Response } from "express";
import dotenv from 'dotenv';
dotenv.config();
// import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { inviteTeamsMembers } from "../models/invite-teams-members";
import { invitedTeamMembersInterface, InvitePayload } from "@yosemite-crew/types";
import crypto from "crypto";
import { ProfileData, WebUser } from "../models/WebUser";
const region = process.env.AWS_REGION || "eu-central-1";
const SES = new AWS.SES({ region });

type InviteResult = {
    email: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
};

const cognito = new AWS.CognitoIdentityServiceProvider({ region: process.env.AWS_REGION || "us-east-1" });

export const inviteTeamsMembersController = {
    InviteTeamsMembers: async (req: Request, res: Response): Promise<void> => {
        const data: InvitePayload[] = Array.isArray(req.body)
            ? (req.body as InvitePayload[])
            : [req.body as InvitePayload];
        if (!data.length) {
            res.status(400).json({ message: "Request body is empty." });
            return;
        }
        console.log("Received invite data:", process.env.MAIL_DRIVER, process.env.AWS_REGION);
         if (typeof data[0].invitedBy  !== "string" || !/^[a-fA-F0-9-]{36}$/.test(data[0].invitedBy )) {
        res.status(400).json({ message: "Invalid invitedBy format" });
        return;
      }
        const results: InviteResult[] = [];
        const name = await ProfileData.findOne({ userId: data[0].invitedBy });
        const inviterName = name?.businessName || "Unknown";

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
                const inviteCode = Math.random().toString(36).substring(2, 10); // Simple code
                await new inviteTeamsMembers({
                    email,
                    role,
                    department,
                    invitedBy,
                    inviteCode,
                }).save();

                const baseUrl = "http://localhost:3000";
                const inviteLink = `${baseUrl}/signup?inviteCode=${inviteCode}`;

                await SES.sendEmail({
                    Source: process.env.MAIL_DRIVER!,
                    Destination: { ToAddresses: [email] },
                    Message: {
                        Subject: {
                            Data: "You're Invited to Join the Team!",
                            Charset: "UTF-8",
                        },
                        Body: {
                            Html: {
                                Charset: "UTF-8",
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
                                                <p><strong>Invited by:</strong> ${inviterName}</p>
                                                <p style="margin-top: 40px;">Thanks,<br/>Team Yosemite</p>
                                            </div>
                                            </body>
                                        </html>
                                        `,
                            },
                        },
                    },
                }).promise();

                results.push({ email, status: "sent" });
            } catch (err: unknown) {
                results.push({
                    email,
                    status: "failed",
                    error: err instanceof Error ? err.message : "Unknown error",
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
            inviteCode: invite.inviteCode,
        });
    }
    ,
    invitedTeamMembersRegister: async (
        req: Request<invitedTeamMembersInterface>,
        res: Response
    ): Promise<void> => {
        try {
            const { email, password, role, department, invitedBy, inviteCode } = req.body as invitedTeamMembersInterface;

             if (typeof invitedBy !== "string" || !/^[a-fA-F0-9-]{36}$/.test(invitedBy)) {
        res.status(400).json({ message: "Invalid invitedBy format" });
        return
      }
            // Validate required fields
            if (!email || !password || !role || !department || !invitedBy) {
                
                res.status(400).json({ message: "Missing required fields." });
                return
            }
            // Step 1: Check if the user was invited
            const invitedRecord = await inviteTeamsMembers.findOne({ email });
            console.log("hello", invitedRecord)
            if (!invitedRecord) {
                 res.status(403).json({ message: "This email was not invited." });
                 return
            }
            // Step 2: Validate invitedBy
            if (invitedRecord.invitedBy !== invitedBy) {
                 res.status(403).json({ message: "Invalid invitation or mismatched invitedBy." });
                 return
            }
            // Step 3: Check if user already exists in Cognito
            try {
                const params: AWS.CognitoIdentityServiceProvider.AdminGetUserRequest = {
                    UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB as string,
                    Username: email,
                };

                const userData = await cognito.adminGetUser(params).promise();
                console.log("User found in Cognito:", userData);

                const emailVerified = userData.UserAttributes?.find(
                    (attr) => attr.Name === "email_verified"
                )?.Value === "true";

                console.log("Email verified status:", emailVerified);

                if (emailVerified) {
                     res
                        .status(409)
                        .json({ message: "User already exists. Please login." });
                        return
                }

                // Resend OTP
                console.log("User exists but is not verified. Resending OTP...");
                const resendParams: AWS.CognitoIdentityServiceProvider.ResendConfirmationCodeRequest = {
                    ClientId: process.env.COGNITO_CLIENT_ID_WEB as string,
                    Username: email,
                };

                if (process.env.COGNITO_CLIENT_SECRET) {
                    resendParams.SecretHash = getSecretHash(email);
                }

                await cognito.resendConfirmationCode(resendParams).promise();

                 res
                    .status(200)
                    .json({ message: "New OTP sent to your email." });
                    return

            } catch (err) {
                if (
                    typeof err === "object" &&
                    err !== null &&
                    "code" in err &&
                    (err as { code: string }).code !== "UserNotFoundException"
                ) {
                    console.error("Error checking Cognito user:", err);
                     res
                        .status(500)
                        .json({ message: "Error checking user status." });
                        return
                }
                // if it's "UserNotFoundException", continue to signup logic
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
                     res.status(409).json({
                        message: "User already exists in Cognito. Please verify your email.",
                    });
                    return
                }
                console.error("Cognito Signup Error:", err);
                 res.status(500).json({ message: "Error registering user. Please try again later." });
                 return
            }
            // Step 5: Determine businessId
            let businessId: string = invitedBy; // default fallback

            const inviterUser = await WebUser.findOne({ cognitoId: invitedBy }).lean();
            const rolesThatInheritBusiness = [
                "Vet",
                "Vet Technician",
                "Nurse",
                "Vet Assistant",
                "Receptionist",
            ];

            if (inviterUser && rolesThatInheritBusiness.includes(inviterUser.role)) {
                businessId = inviterUser.bussinessId || invitedBy;
            }

            // Step 6: Save user to MongoDB
            const newUser = new WebUser({
                cognitoId: String(cognitoResponse.UserSub),
                role,
                department,
                bussinessId: businessId,
            });
            const response = await newUser.save();
            if (response) {
                // Step 6: Save invite record with status "accepted"
                await inviteTeamsMembers.updateOne(
                    { inviteCode: String(inviteCode) },
                    { status: "accepted" }
                );
            }
             res.status(200).json({
                message: "User registered successfully! Please verify your email with OTP.",
            });
            return
        } catch (error) {
            console.error("Unexpected Error:", error);
             res.status(500).json({ message: "Internal Server Error. Please try again later." });
             return
        }
    },
    manageInviteStatus: async (req: Request, res: Response): Promise<Response> => {
        const { userId, status } = req.body as { userId: string; status: string };


        if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
            return res.status(400).json({ message: "Invalid doctorId format" });
        }
        try {
            const invite = await inviteTeamsMembers.findOne({ inviteCode : userId });

            if (!invite) {
                return res.status(404).json({ message: "Invite not found." });
            }

            // Update the status of the invite
            invite.status = status;
            await invite.save();

            return res.status(200).json({
                message: `Invite status updated to ${status}.`,
                invite,
            });
        } catch (error) {
            console.error("Error managing invite status:", error);
            return res.status(500).json({ message: "Internal Server Error." });
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

// const generateInviteCode = () => {
//     return Math.random().toString(36).substr(2, 8).toUpperCase(); // 8-character code
// };
