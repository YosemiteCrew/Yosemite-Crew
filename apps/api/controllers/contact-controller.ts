import { ContactUsBody, TypedRequestBody } from '@yosemite-crew/types';
import { Response } from 'express';
import AWS from 'aws-sdk';

const contactController = {
 contactUs: async (req: TypedRequestBody<ContactUsBody>, res: Response): Promise<void> => {
  try {
 
    const { querytype, requests, message, subject } = req.body;

    if (!message) {
      res.status(400).json({ status: 0, message: 'Message is required' });
      return;
    }

    if (querytype === 'Data Subject Access Request') {
      let requestDetails: string;

      if (Array.isArray(requests) && requests.length > 0) {
        requestDetails = requests.map((r) => `${r.question}: ${r.answer}`).join('\n');
      } else {
        requestDetails = 'No request details provided.';
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
              Data: `${message}\n\nRequest Details:\n${requestDetails}`,
            },
          },
        },
      };
      const ses = new AWS.SES({ region: process.env.AWS_REGION }); // e.g., 'us-east-1'
      await ses.sendEmail(mailparams).promise();

      res.status(200).json({ status: 1, message: 'Email sent successfully.' });

    } else if (querytype === 'General Enquiry' || querytype === 'Feature Request') {
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

      
      const ses = new AWS.SES({ region: process.env.AWS_REGION }); // e.g., 'us-east-1'
      await ses.sendEmail(params).promise();

      res.status(200).json({ status: 1, message: 'Email sent successfully.' });
    } else {
      res.status(400).json({ status: 0, message: 'Invalid query type' });
    }

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ status: 0, error: 'Failed to send email.' });
  }
}
}
export default contactController;
