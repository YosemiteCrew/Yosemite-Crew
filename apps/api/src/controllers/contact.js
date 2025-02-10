const contactUs = require('../models/contact');
const jwt = require('jsonwebtoken');
const AWS = require("aws-sdk");
const SES = new AWS.SES();


async function handleContactUs(req, res) {
    try {
        const token = req.headers.authorization.split(' ')[1]; // Extract token
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
        const cognitoUserId = decoded.username; // Get user ID from token
        const body = req.body;
        const type = body.type;
        const requests = body.requests;
        const message = body.message;
        const subject = body.subject;
        if (!message) {
            return res.status(200).json({ status: 0, message: "message is required" });
          }
         if(type == 'Data Subject Access Request'){
        let requestDetails;
        if (requests.length > 0) {
            const rest = JSON.parse(requests);
            requestDetails = rest.map(r => `${r.question}: ${r.answer}`).join('\n');
        } else {
            requestDetails = 'No request details provided.';
        }

        const mailparams = {
            Source: process.env.MAIL_DRIVER,
            Destination: {
                ToAddresses: [process.env.MAIL_DRIVER],
            },
            Message: {
                Subject: { Data: type },
                Body: {
                    Text: { // Corrected this part
                        Data: `${req.body.message}\n\nRequest Details:\n${requestDetails}`
                    }
                }
            }
        };
        const emailSent = await SES.sendEmail(mailparams).promise();
        res.status(200).json({status: 1, message: 'Email sent successfully.' });

        }else if(type == 'General Enquiry' || type == 'Feature Request'){
            const params = {
                Source: process.env.MAIL_DRIVER,
                Destination: {
                    ToAddresses: [process.env.MAIL_DRIVER],
                },
                Message: {
                    Subject: { Data: subject },
                    Body: {
                        Text: { 
                            Data: `${req.body.message}`
                        }
                    }
                }
            };
            const emailSent = await SES.sendEmail(params).promise();
            res.status(200).json({status: 1, message: 'Email sent successfully.' });
         }
            
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(200).json({ status: 0, error: 'Failed to send email.' });
    }
}


module.exports = {
    handleContactUs,
}