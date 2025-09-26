import { ContactUsBody,  TypedRequestBody } from '@yosemite-crew/types';
import logger from '../utils/logger';
import { Response } from 'express';
import AWS from 'aws-sdk';
import { getCognitoUserId } from '../middlewares/authMiddleware';
import AppUser from '../models/appuser-model';
import SupportTicket from '../models/SupportTicket';

const contactController = {
  contactUs: async (req: TypedRequestBody<ContactUsBody & {type:string,website?:string}>, res: Response): Promise<void> => {
    try {

      const { type , requests, message, subject, website } = JSON.parse(req.body?.data as string) as  ContactUsBody & {type:string,website?:string}
      const querytype = type;

      if (!message) {
        res.status(200).json({ status: 0, message: 'Message is required' });
        return;
      }

      if (querytype === 'DSAR') {
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

 
       const newTicket = new SupportTicket({
          fullName: `${userDetails?.firstName} ${userDetails?.lastName}`,
          emailAddress: userDetails?.email,
          message:message,
          userType: "Registered",
          createdBy: "User",
          userStatus: "Active",
          platform: "Phone",
          status:"New Ticket",
          category:querytype,
          priority: "Low",
          createdAt: new Date()
        });
        await newTicket.save();
        const ses = new AWS.SES({ region: process.env.AWS_REGION }); // e.g., 'us-east-1'
        await ses.sendEmail(mailparams).promise();

        res.status(200).json({ status: 1, message: 'Email sent successfully.' });
        return
      } 
      if (querytype === 'General' || querytype === 'Feature Request') {
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

         const newTicket = new SupportTicket({
          fullName: `${userDetails?.firstName} ${userDetails?.lastName}`,
          emailAddress: userDetails?.email,
          message:message,
          userType: "Registered",
          createdBy: "User",
          userStatus: "Active",
          platform: "Phone",
          status:"New Ticket",
          category:'Complaint',
          priority: "Low",
          createdAt: new Date()
        });
        await newTicket.save();
        const ses = new AWS.SES({ region: process.env.AWS_REGION }); // e.g., 'us-east-1'
        await ses.sendEmail(params).promise();

        res.status(200).json({ status: 1, message: 'Email sent successfully.' });
        return
      }
      if(querytype === 'Complaint'){
        
        const reqs= JSON.parse(requests)
        
        const userId = getCognitoUserId(req);
       // logger.info(userId,'userId');
        if (!userId) {
          res.status(200).json({ status: 0, message: 'User ID is missing' })
          return;
        }
        // logger.info(reqs[0]?.question);
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
            Subject: { Data: querytype },
            Body: {
              Text: {
                Data: message,
              },
            },
          },
        };

         const newTicket = new SupportTicket({
          fullName: `${userDetails?.firstName} ${userDetails?.lastName}`,
          emailAddress: userDetails?.email,
          message:message as string,
          request:req,
          website:website as string,
          userType: "Registered",
          createdBy: "User",
          userStatus: "Active",
          platform: "Phone",
          status:"New Ticket",
          category:querytype as string,
          priority: "Low",
          createdAt: new Date()
        });
        await newTicket.save();
        const ses = new AWS.SES({ region: process.env.AWS_REGION }); // e.g., 'us-east-1'
        await ses.sendEmail(params).promise();

        res.status(200).json({ status: 1, message: 'Email sent successfully.' });
      }
      else{
        res.status(200).json({ status: 0, message: 'Invalid query type' });
      }

    } catch (error) {
      logger.error('Error sending email:', error);
      const message = error instanceof Error ? error.message :'Failed to send email'
      res.status(200).json({ status: 0, error:message});
    }
  }
}
export default contactController;
