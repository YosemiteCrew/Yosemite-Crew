// controllers/inviteTeamsMembers.ts
import AWS from "aws-sdk";
import { Request, Response } from "express";
import { inviteTeamsMembers } from "../models/invite-teams-members";
import { DepartmentsForInvite, DoctorType, invitedTeamMembersInterface, InviteItem, InvitePayload, TeamOverview, WebUserType } from "@yosemite-crew/types";
import crypto from "crypto";
import { ProfileData, WebUser } from "../models/WebUser";
import AddDoctors from "../models/AddDoctor";
import { convertToFhirDepartment, convertToFhirTeamMembers, toFHIRInviteList, toFhirTeamOverview } from "@yosemite-crew/fhir";
import Department from "../models/AddDepartment";
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
            ? req.body as InvitePayload[]
            : [req.body] as [InvitePayload];

        if (!data.length) {
            res.status(400).json({ message: "Request body is empty." });
            return;
        }

        const invitedBy = data[0].invitedBy;
        if (typeof invitedBy !== "string" || !/^[a-fA-F0-9-]{36}$/.test(invitedBy)) {
            res.status(400).json({ message: "Invalid invitedBy format" });
            return;
        }

        const results: InviteResult[] = [];

        // Fetch name from either business profile or doctor profile
        const invitedByProfile = await ProfileData.findOne({ userId: invitedBy });
        const invitedByDoctor = await AddDoctors.findOne({ userId: invitedBy });
        // console.log("llllllllll",invitedByProfile,invitedByDoctor)
        let inviterName = "Unknown";
        if (invitedByProfile?.businessName) {
            inviterName = invitedByProfile.businessName;
        } else if (invitedByDoctor?.firstName || invitedByDoctor?.lastName) {
            inviterName = `${invitedByDoctor?.firstName || ""} ${invitedByDoctor?.lastName || ""}`.trim();
        }
        console.log(inviterName)
        for (const invite of data) {
            const { email, name, role, department } = invite;

            // Basic validation
            if (!email || !role || !department || !name || !invitedBy) {
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
                let businessId: string = invitedBy; // default fallback

                const inviterUser = await WebUser.findOne({ cognitoId: invitedBy }).lean();
                const rolesThatInheritBusiness = [
                    "Vet",
                    "Vet Technician",
                    "Nurse",
                    "Vet Assistant",
                    "Receptionist",
                ];

                if (inviterUser && rolesThatInheritBusiness.includes(inviterUser.role as string)) {
                    businessId = inviterUser.bussinessId || invitedBy;
                }
                const inviteCode = Math.random().toString(36).substring(2, 10);

                if (!isValidEmail(email)) {
                    throw new Error("Invalid email address.");
                }


                const existing = await inviteTeamsMembers.findOne({ email });

                if (existing) {
                    const result = await inviteTeamsMembers.deleteOne({ email });
                    if (result.deletedCount === 0) {
                        res.status(500).json({ message: "Failed to delete previous invite" });
                        return;
                    }
                }

                const newInvite = new inviteTeamsMembers({
                    bussinessId: businessId,
                    email,
                    role,
                    name,
                    department,
                    invitedBy,
                    inviteCode,
                });

                await newInvite.save();

                const baseUrl = "http://localhost:3000"; // Use ENV for prod
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
                      <h2>Hi <strong>${name}</strong>, You’re Invited to Join Our Team!</h2>
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


    inviteInfo: async (req: Request, res: Response):Promise<void> => {
        const { code } = req.query;

        console.log("Invite Code:", code);

      if (typeof code !== "string" || !/^[a-zA-Z0-9]{8}$/.test(code)) {
     res.status(400).json({ message: "Invalid or missing invite code." });
     return
  }

        const invite = await inviteTeamsMembers.findOne({ inviteCode: code });

        if (!invite) {
            res.status(404).json({ message: "Invalid or expired invite code." });
            return
        }

        // Use invitedAt instead of createdAt
        if (!invite.invitedAt) {
            res.status(400).json({ message: "Invite date is missing or invalid." });
            return
        }
        const invitedAt = new Date(invite.invitedAt);
        const now = new Date();
        const diffInMs = now.getTime() - invitedAt.getTime();
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        if (diffInDays > 3) {
            await inviteTeamsMembers.updateMany({ inviteCode: code }, { status: "expired" });
            res.status(410).json({ message: "This invite link has expired." });
            return
        }


        res.status(200).json({
            name: invite.name,
            email: invite.email,
            role: invite.role,
            department: invite.department,
            invitedBy: invite.invitedBy,
            inviteCode: invite.inviteCode,
        });
        return
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

            if (inviterUser && rolesThatInheritBusiness.includes(inviterUser.role as string)) {
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
    getInvites: async (req: Request, res: Response): Promise<void> => {
        const { userId, search = "", status = "", department = "" } = req.query as {
            userId: string;
            search?: string;
            status?: string;
            department?: string;
        };

        if (!/^[a-fA-F0-9-]{36}$/.test(userId)) {
            res.status(400).json({ message: "Invalid userId format" });
            return;
        }

        try {
            const matchStage: { $and: unknown[] } = {
                $and: [
                    {
                        $or: [
                            { bussinessId: userId },
                            { invitedBy: userId }
                        ]
                    }
                ]
            };

            // Apply filters
            if (status) {
                matchStage.$and.push({ status });
            }

            if (department) {
                matchStage.$and.push({ department });
            }

            if (search) {
                matchStage.$and.push({
                    $or: [
                        { name: { $regex: search, $options: "i" } },
                        { email: { $regex: search, $options: "i" } },
                        { role: { $regex: search, $options: "i" } }
                    ]
                });
            }


            const invites: InviteItem[] = await inviteTeamsMembers.aggregate<InviteItem>([
                { $match: matchStage as object },

                // Lookup in ProfileData (for businessName)
                {
                    $lookup: {
                        from: "profiledatas",
                        localField: "invitedBy",
                        foreignField: "userId",
                        as: "businessProfile"
                    }
                },

                // Convert string department to ObjectId
                {
                    $addFields: {
                        departmentObjectId: { $toObjectId: "$department" }
                    }
                },

                // Lookup in Departments to get department name
                {
                    $lookup: {
                        from: "departments",
                        localField: "departmentObjectId",
                        foreignField: "_id",
                        as: "departmentInfo"
                    }
                },

                // Lookup in AddDoctors (for invitedBy full name)
                {
                    $lookup: {
                        from: "adddoctors",
                        localField: "invitedBy",
                        foreignField: "userId",
                        as: "doctorProfile"
                    }
                },

                // Add custom fields like invitedByName, formatted date, department name/id
                {
                    $addFields: {
                        invitedByName: {
                            $cond: [
                                { $gt: [{ $size: "$businessProfile" }, 0] },
                                { $arrayElemAt: ["$businessProfile.businessName", 0] },
                                {
                                    $cond: [
                                        { $gt: [{ $size: "$doctorProfile" }, 0] },
                                        {
                                            $concat: [
                                                { $arrayElemAt: ["$doctorProfile.firstName", 0] },
                                                " ",
                                                { $arrayElemAt: ["$doctorProfile.lastName", 0] }
                                            ]
                                        },
                                        "Unknown"
                                    ]
                                }
                            ]
                        },
                        invitedAtFormatted: {
                            $dateToString: {
                                format: "%b %d, %Y",
                                date: "$invitedAt"
                            }
                        },
                        departmentId: "$department",
                        department: {
                            $cond: [
                                { $gt: [{ $size: "$departmentInfo" }, 0] },
                                { $arrayElemAt: ["$departmentInfo.departmentName", 0] },
                                "Unknown"
                            ]
                        },
                    }
                },

                {
                    $project: {
                        businessProfile: 0,
                        doctorProfile: 0,
                        departmentInfo: 0,
                        departmentObjectId: 0
                    }
                }
            ]);


            if (!invites.length) {
                res.status(404).json({ message: "No invites found." });
                return;
            }
            console.log("invites", invites)
            const invitesFHIR = toFHIRInviteList(invites);

            res.status(200).json({
                message: "Invites fetched successfully",
                invite: invitesFHIR as object,
            });
        } catch (error) {
            console.error("Error fetching invites:", error);
            res.status(500).json({ message: "Internal Server Error." });
        }
    },

    removeInvites: async (req: Request, res: Response): Promise<void> => {
        try {
            const { email } = req.query;

            if (!email || typeof email !== "string") {
                res.status(400).json({ message: "Email is required and must be a string." });
                return;
            }

            const result = await inviteTeamsMembers.deleteOne({ email });

            if (result.deletedCount === 0) {
                res.status(404).json({ message: "No invite found with the provided email." });
            } else {
                res.status(200).json({ message: "Invite deleted successfully." });
            }
        } catch (error) {
            console.error("Error deleting invite:", error);
            res.status(500).json({ message: "Internal server error." });
        }
    },
    practiceTeamOverView: async (req: Request, res: Response) => {
        try {
            const { userId } = req.query as { userId: string };

            if (!/^[a-fA-F0-9-]{36}$/.test(userId)) {
                res.status(400).json({ message: "Invalid userId format" });
                return;
            }


            const [result = {
                totalWebUsers: 0,
                onDutyCount: 0,
                invitedCount: 0,
                departmentCount: 0
            }] = await WebUser.aggregate<TeamOverview>([
                {
                    $match: {
                        bussinessId: userId,
                    },
                },
                {
                    $lookup: {
                        from: "adddoctors",
                        localField: "cognitoId",
                        foreignField: "userId",
                        as: "doctorProfile",
                    },
                },

                {
                    $unwind: {
                        path: "$doctorProfile",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalWebUsers: { $sum: 1 },
                        onDutyCount: {
                            $sum: {
                                $cond: [{ $eq: ["$doctorProfile.status", "On-Duty"] }, 1, 0],
                            },
                        },
                    },
                },
                {
                    $lookup: {
                        from: "inviteteamsmembers",
                        let: { invitedById: userId },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ["$bussinessId", "$$invitedById"],
                                    },
                                },
                            },
                            {
                                $count: "invitedCount",
                            },
                        ],
                        as: "invited",
                    },
                }, {
                    $lookup: {
                        from: "departments",
                        let: { bId: userId },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$bussinessId", "$$bId"] },
                                },
                            },
                            {
                                $count: "count",
                            },
                        ],
                        as: "departmentCount",
                    }
                },
                {
                    $addFields: {
                        invitedCount: {
                            $ifNull: [{ $arrayElemAt: ["$invited.invitedCount", 0] }, 0],
                        },
                        departmentCount: {
                            $ifNull: [{ $arrayElemAt: ["$departmentCount.count", 0] }, 0],
                        },
                    },
                },

                {
                    $project: {
                        _id: 0,
                        totalWebUsers: 1,
                        onDutyCount: 1,
                        invitedCount: 1,
                        departmentCount: 1,
                    },
                },
            ]);

            res.status(200).json({
                message: "Team overview fetched successfully",
                data: toFhirTeamOverview(
                    result || {
                        totalWebUsers: 0,
                        onDutyCount: 0,
                        invitedCount: 0,
                        departmentCount: 0
                    },
                )
            });
        } catch (error) {
            console.error("Error in practiceTeamOverView:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    },


    practiceTeamsList: async (req: Request, res: Response) => {
        try {
            const { userId } = req.query as { userId: string };

            if (!/^[a-fA-F0-9-]{36}$/.test(userId)) {
                res.status(400).json({ message: "Invalid userId format" });
                return;
            }

            const rawData = await WebUser.aggregate([
                { $match: { bussinessId: userId } },
                {
                    $lookup: {
                        from: "adddoctors",
                        localField: "cognitoId",
                        foreignField: "userId",
                        as: "doctorsInfo"
                    }
                }
            ]);
            // Flatten and add S3 URLs
            const result = rawData.map((user: WebUserWithDoctorInfo) => {
                const doctor: DoctorType | undefined = user.doctorsInfo?.[0];

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { doctorsInfo, ...userWithoutDoctorsInfo } = user;

                const merged = {
                    ...userWithoutDoctorsInfo,
                    ...(doctor || {}),
                    image: doctor?.image ? `${process.env.CLOUD_FRONT_URI}/${doctor.image}` : undefined,
                    documents: doctor?.documents?.map(doc => ({
                        ...doc,
                        name: `${process.env.CLOUD_FRONT_URI}/${doc.name}`
                    })) ?? []
                };

                return merged;
            });


            const response = convertToFhirTeamMembers(result as []);;
            res.status(200).json({ message: "Fetched Successfully", response });
        } catch (error) {
            console.error("Error fetching practice team list:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },

    getDepartmentForInvite: async (req: Request, res: Response) => {
        try {
            const { userId } = req.query as { userId: string };

            if (!/^[a-fA-F0-9-]{36}$/.test(userId)) {
                res.status(400).json({ message: "Invalid userId format" });
                return;
            }

            const departments: DepartmentsForInvite[] = await Department.find(
                { bussinessId: userId },
                { _id: 1, departmentName: 1 }
            );


            if (!departments.length) {
                res.status(404).json({ message: "No departments found." });
                return;
            }
            const data = convertToFhirDepartment(departments)
            res.status(200).json({
                message: "Departments fetched successfully",
                data: data as object,
            });
        } catch (error) {
            console.error("Error fetching departments:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
}
function getSecretHash(email: string,) {
    const clientId = process.env.COGNITO_CLIENT_ID_WEB;
    const clientSecret: string = process.env.COGNITO_CLIENT_SECRET_WEB as string
    return crypto
        .createHmac("SHA256", clientSecret)
        .update(email + clientId)
        .digest("base64");
}
function isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

export type WebUserWithDoctorInfo = WebUserType & {
    doctorsInfo?: DoctorType[];
};
