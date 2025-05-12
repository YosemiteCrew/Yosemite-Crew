const express = require('express');
const { UpdateEndpointCommand, UpdateEndpointsBatchCommand } = require('@aws-sdk/client-pinpoint')
const { v4: uuid4 } = require('uuid')
const multer = require('multer')
const { parse } = require('csv-parse/sync');
const { pinClient } = require('../config/pinpointClient');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') cb(null, true);
    else cb(new Error('Only CSV files are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
});

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

router.post('/subscribe', async (req, res) => {
  const { email, name, countryCode, userType } = req.body;
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Email is required' });
  // Check if country & UserType are valid

  try {
    // Check if the email is already subscribed in MongoDb
    const newId = uuid4();
    const params = {
      ApplicationId: process.env.PINPOINT_APPLICATION_ID,
      EndpointId: newId,
      EndpointRequest: {
        ChannelType: 'EMAIL',
        Address: email,
        OptOut: 'NONE',
        Location: {
          Country: countryCode | '',
        },
        EffectiveDate: new Date().toISOString(),
        User: {
          UserId: newId,
          UserAttributes: {
            Name: [name || ''],
            Email: [email],
            CountryCode: [countryCode || ''],
            UserType: [userType || ''],
            Subscribed: ['true'],
            UUID: [newId],
            CreatedAt: [new Date().toISOString()],
            UpdatedAt: [new Date().toISOString()],
          },
        }
      }
    };
    const command = new UpdateEndpointCommand(params);
    const response = await pinClient.send(command);
    console.log('Pinpoint response:', response);
    if (response.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ error: 'Failed to subscribe' });
    }
    // Send a welcome email
    res.status(200).json({ message: 'Subscription successful!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/unsubscribe', async (req, res) => {
  const { uuid } = req.body;
  if (!uuid) return res.status(400).json({ error: 'UUID is required' });
  try {
    // Check if the email exists in MongoDb
    const params = {
      ApplicationId: process.env.PINPOINT_APPLICATION_ID,
      EndpointId: uuid,
      EndpointRequest: {
        OptOut: 'ALL',
        User: {
          UserAttributes: {
            Subscribed: ['false'],
          },
        }
      }
    };
    const command = new UpdateEndpointCommand(params);
    const response = await pinClient.send(command);
    console.log('Pinpoint response:', response);
    if (response.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ error: 'Failed to unsubscribe' });
    }
    // Send an unsubscribe email
    res.status(200).json({ message: 'Unsubscription successful!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

router.post('/upload-batch', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('CSV file is required');
    const content = req.file.buffer.toString('utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      skip_records_with_empty_values: true
    });
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).send('Invalid or empty CSV');
    }

    const requiredCols = ['Address', 'CountryCode', 'UserType', 'Name'];
    const missingCols = requiredCols.filter(c => !(c in records[0]));
    if (missingCols.length > 0) {
      return res.status(400).send(`Missing required columns: ${missingCols.join(', ')}`);
    }
    const invalidEmails = records.filter(r => !isValidEmail(r.Address));
    if (invalidEmails.length > 0) {
      return res.status(400).send(`Invalid email addresses: ${invalidEmails.map(r => r.Address).join(', ')}`);
    }
    // Check countryCode and userTypes

    const params = {
      ApplicationId: process.env.PINPOINT_APPLICATION_ID,
      EndpointBatchRequest: {
        Item: records.map(r => {
          const newId = uuid4(4)
          return {
            Id: newId,
            ChannelType: 'EMAIL',
            Address: r.Address,
            OptOut: 'NONE',
            Location: {
              Country: r.CountryCode | '',
            },
            EffectiveDate: new Date().toISOString(),
            User: {
              UserId: newId,
              UserAttributes: {
                Name: [r.Name || ''],
                Email: [r.Address,],
                CountryCode: [r.CountryCode || ''],
                UserType: [r.UserType || ''],
                Subscribed: ['true'],
                UUID: [newId],
                CreatedAt: [new Date().toISOString()],
                UpdatedAt: [new Date().toISOString()],
              },
            }
          }
        }),
      },
    };
    const command = new UpdateEndpointsBatchCommand(params);
    const response = await pinClient.send(command);
    console.log('Pinpoint response:', response);
    if (response.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ error: 'Failed to upload' });
    }
    es.status(200).json({ message: 'Endpoints creation successful!' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error processing CSV');
  }
})

module.exports = router;