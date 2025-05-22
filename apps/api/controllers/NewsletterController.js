const {
  UpdateEndpointCommand,
  UpdateEndpointsBatchCommand,
} = require("@aws-sdk/client-pinpoint");
const { parse } = require("csv-parse/sync");
const { pinClient } = require("../config/pinpointClient");
const Subscriber = require("../models/Subscriber");
const validator = require("validator");
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;

function isValidEmail(email) {
  return validator.isEmail(email);
}

const checkEmail = async (req, res) => {
  const { email } = req.query;
  if (!email || !isValidEmail(email))
    return res.status(400).json({ error: "Enter a valid Email" });
  try {
    const subscriber = await Subscriber.findOne({ email: { $eq: email } });
    if (subscriber && subscriber.subscribed) {
      return res.status(200).json({ message: "Email subscribed" });
    }
    res.status(200).json({ message: "Email not subscribed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkEmailAuth = async (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email))
    return res.status(400).json({ error: "Enter a valid Email" });
  try {
    const subscriber = await Subscriber.findOne({ email: { $eq: email } });
    if (subscriber) {
      return res.status(200).json({ subscriber });
    }
    res.status(200).json({ message: "Email not subscribed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const subscribe = async (req, res) => {
  const { email, name, countryCode, userType, userId } = req.body;
  const allowedUserTypes = ["Pet Owner", "Business", "Developer"];
  if (!name) return res.status(400).json({ error: "Enter a valid Name" });
  if (!email || !isValidEmail(email))
    return res.status(400).json({ error: "Enter a valid Email" });
  if (!userType || !allowedUserTypes.includes(userType))
    return res.status(400).json({ error: "Enter a valid userType" });
  if (!countryCode || !validator.isISO31661Alpha2(countryCode))
    return res.status(400).json({ error: "Enter a valid CountryCode" });

  try {
    const subscriber = await Subscriber.findOne({ email: { $eq: email } });
    if (subscriber) {
      if (subscriber.subscribed) {
        return res.status(400).json({ error: "Email already subscribed" });
      } else {
        await Subscriber.updateOne(
          { email: { $eq: email } },
          { subscribed: true }
        );
        const params = {
          ApplicationId: process.env.PINPOINT_APPLICATION_ID,
          EndpointId: subscriber._id.toString(),
          EndpointRequest: {
            OptOut: "ALL",
            User: {
              UserAttributes: {
                Subscribed: ["false"],
              },
            },
          },
        };
        const command = new UpdateEndpointCommand(params);
        const response = await pinClient.send(command);
        if (response.$metadata.httpStatusCode !== 200) {
          return res.status(500).json({ error: "Failed to unsubscribe" });
        }
        res.status(200).json({ message: "Subscription successful!" });
      }
    }
    const subscriberData = {
      email,
      subscribed: true,
      countryCode,
      userType,
      name,
    };
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      subscriberData.user = userId;
    }
    const newSubscriber = await Subscriber.create(subscriberData);
    const newId = newSubscriber._id.toString();
    const params = {
      ApplicationId: process.env.PINPOINT_APPLICATION_ID,
      EndpointId: newId,
      EndpointRequest: {
        ChannelType: "EMAIL",
        Address: email,
        OptOut: "NONE",
        Location: {
          Country: countryCode | "",
        },
        EffectiveDate: new Date().toISOString(),
        User: {
          UserId: newId,
          UserAttributes: {
            Name: [name || ""],
            Email: [email],
            CountryCode: [countryCode || ""],
            UserType: [userType || ""],
            Subscribed: ["true"],
          },
        },
      },
    };
    const command = new UpdateEndpointCommand(params);
    const response = await pinClient.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ error: "Failed to subscribe" });
    }
    // Send a welcome email
    res.status(200).json({ message: "Subscription successful!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const unsubscribe = async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.status(400).json({ error: "UUID is required" });
  try {
    const subscriber = await Subscriber.findOne({ _id: { $eq: uuid } });
    if (!subscriber) return res.status(400).json({ error: "Email not found" });
    if (!subscriber.subscribed)
      return res.status(400).json({ error: "Email already unsubscribed" });
    await Subscriber.updateOne(
      { email: subscriber.email },
      { subscribed: false }
    );
    const params = {
      ApplicationId: process.env.PINPOINT_APPLICATION_ID,
      EndpointId: uuid,
      EndpointRequest: {
        OptOut: "ALL",
        User: {
          UserAttributes: {
            Subscribed: ["false"],
          },
        },
      },
    };
    const command = new UpdateEndpointCommand(params);
    const response = await pinClient.send(command);
    console.log("Pinpoint response:", response);
    if (response.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ error: "Failed to unsubscribe" });
    }
    // Send an unsubscribe email
    res.status(200).json({ message: "Unsubscription successful!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const batchUpload = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "CSV file is required" });
    const content = req.file.buffer.toString("utf-8");
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      skip_records_with_empty_values: true,
    });
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "Invalid or empty CSV" });
    }

    const requiredCols = ["Address", "CountryCode", "UserType", "Name"];
    const missingCols = requiredCols.filter((c) => !(c in records[0]));
    if (missingCols.length > 0) {
      return res
        .status(400)
        .json({ error: `Missing required columns: ${missingCols.join(", ")}` });
    }
    const invalidEmails = records.filter((r) => !isValidEmail(r.Address));
    if (invalidEmails.length > 0) {
      return res
        .status(400)
        .json({
          error: `Invalid email addresses: ${invalidEmails.map((r) => r.Address).join(", ")}`,
        });
    }
    const invalidCountryCodes = records.filter(
      (r) => !validator.isISO31661Alpha2(r.CountryCode || "")
    );
    if (invalidCountryCodes.length > 0) {
      return res
        .status(400)
        .json({
          error: `Invalid country codes: ${invalidCountryCodes.map((r) => r.CountryCode).join(", ")}`,
        });
    }
    const allowedUserTypes = ["Pet Owner", "Business", "Developer"];
    const invalidUserTypes = records.filter(
      (r) => !allowedUserTypes.includes(r.UserType)
    );
    if (invalidUserTypes.length > 0) {
      return res
        .status(400)
        .json({
          error: `Invalid user types: ${invalidUserTypes.map((r) => r.UserType).join(", ")}`,
        });
    }

    records = records.map((r) => ({
      ...r,
      _id: new ObjectId(),
    }));

    const operations = records.map((r) => ({
      updateOne: {
        filter: { email: r.Address },
        update: {
          $set: {
            _id: r._id,
            subscribed: true,
            countryCode: r.CountryCode,
            userType: r.UserType,
            name: r.Name,
          },
        },
        upsert: true,
      },
    }));
    await Subscriber.bulkWrite(operations);

    const params = {
      ApplicationId: process.env.PINPOINT_APPLICATION_ID,
      EndpointBatchRequest: {
        Item: records.map((r) => {
          const newId = r._id.toString();
          return {
            Id: newId,
            ChannelType: "EMAIL",
            Address: r.Address,
            OptOut: "NONE",
            Location: {
              Country: r.CountryCode | "",
            },
            EffectiveDate: new Date().toISOString(),
            User: {
              UserId: newId,
              UserAttributes: {
                Name: [r.Name || ""],
                Email: [r.Address],
                CountryCode: [r.CountryCode || ""],
                UserType: [r.UserType || ""],
                Subscribed: ["true"],
              },
            },
          };
        }),
      },
    };
    const command = new UpdateEndpointsBatchCommand(params);
    const response = await pinClient.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ error: "Failed to upload" });
    }
    res.status(200).json({ message: "Endpoints creation successful!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error processing CSV" });
  }
};

module.exports = {
  checkEmail,
  checkEmailAuth,
  subscribe,
  unsubscribe,
  batchUpload
};
