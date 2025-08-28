import { ContactUsBody, IWebUser, TypedRequestBody } from '@yosemite-crew/types';
import { Response } from 'express';
import AWS from 'aws-sdk';
import { getCognitoUserId } from '../middlewares/authMiddleware';
import { WebUser } from '../models/WebUser';
import mongoose from 'mongoose';
import AppUser from '../models/appuser-model';

const contactController = {
  contactUs: async (req: TypedRequestBody<ContactUsBody>, res: Response): Promise<void> => {
    try {

      const { querytype, requests, message, subject } = req.body;

      if (!message) {
        res.status(200).json({ status: 0, message: 'Message is required' });
        return;
      }

      if (querytype === 'Data Subject Access Request') {
        let requestDetails: string;

        if (Array.isArray(requests) && requests.length > 0) {
          requestDetails = requests.map((r) => `${r.question}: ${r.answer}`).join('\n');
        } else {
          requestDetails = 'No request details provided.';
        }
        const userId = getCognitoUserId(req);
        if (!userId) {
          res.status(200).json({ status: 0, message: 'User ID is missing' })
          return;
        }
        const userDetails: { email: string, firstName: string, lastName: string } | null = await AppUser.findOne({ cognitoId: userId })
        if (!userDetails) {
          res.status(200).json({ message: 'user detail not found.' })
          return
        }
        const mailparams = {
          Source: process.env.MAIL_DRIVER!,
          Destination: {
            ToAddresses: [process.env.MAIL_DRIVER!],
          },
          Message: {
            Subject: { Data: querytype },
            Body: {
              Text: {
                Data: `${message}\n\nRequest Details:\n${requestDetails}\n\nFull Name`,
              },
            },
          },
        };
        //fulname, email, category, message need to save in DB

        const ContactUs = mongoose.connection.db?.collection('supporttickets');
        if (!ContactUs) {
          res.status(200).json({ message: 'No Contact us form founded' })
          return
        }
        await ContactUs.insertOne({
          fullName: `${userDetails?.firstName} ${userDetails?.lastName}`,
          emailAddress: userDetails?.email,
          userType: "Registered",
          createdBy: "User",
          userStatus: "Active",
          platform: "Phone",
          status:"New Ticket",
          category:querytype,
          priority: "Low",
          createdAt: new Date()
        });
        const ses = new AWS.SES({ region: process.env.AWS_REGION }); // e.g., 'us-east-1'
        await ses.sendEmail(mailparams).promise();

        res.status(200).json({ status: 1, message: 'Email sent successfully.' });

      } else if (querytype === 'General Enquiry' || querytype === 'Feature Request' || querytype === 'Complaint') {
        const userId = getCognitoUserId(req);
        if (!userId) {
          res.status(200).json({ status: 0, message: 'User ID is missing' })
          return;
        }
        const userDetails: { email: string, firstName: string, lastName: string } | null = await AppUser.findOne({ cognitoId: userId })
        if (!userDetails) {
          res.status(200).json({ message: 'user detail not found.' })
          return
        }


        const params = {
          Source: process.env.MAIL_DRIVER!,
          Destination: {
            ToAddresses: [process.env.MAIL_DRIVER!],
          },
          Message: {
            Subject: { Data: subject },
            Body: {
              Text: {
                Data: message,
              },
            },
          },
        };

        const ContactUs = mongoose.connection.db?.collection('supporttickets');
        if (!ContactUs) {
          res.status(200).json({ message: 'No Contact us form founded' })
          return
        }
        await ContactUs.insertOne({
          fullName: `${userDetails?.firstName} ${userDetails?.lastName}`,
          email: userDetails?.email,
          userType: "Registered",
          createdBy: "User",
          userStatus: "Active",
          platform: "Phone",
          status:"New Ticket",
          category:querytype,
          priority: "Low",
          createdAt: new Date()
        });
        const ses = new AWS.SES({ region: process.env.AWS_REGION }); // e.g., 'us-east-1'
        await ses.sendEmail(params).promise();

        res.status(200).json({ status: 1, message: 'Email sent successfully.' });
      } else {
        res.status(200).json({ status: 0, message: 'Invalid query type' });
      }

    } catch (error) {
      console.error('Error sending email:', error);
      res.status(200).json({ status: 0, error: 'Failed to send email.' });
    }
  }
}
export default contactController;
