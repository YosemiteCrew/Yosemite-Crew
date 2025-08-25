import {
  ChannelType,
  UpdateEndpointCommand,
  UpdateEndpointsBatchCommand,
} from "@aws-sdk/client-pinpoint";
import { parse } from "csv-parse/sync";
import pinClient from "../config/pinpointClient";
import Subscriber from "../models/Subscriber";
import validator from "validator";
import mongoose ,{Types}from "mongoose";
import { Request, Response } from "express";

import type { SubscriberData } from "@yosemite-crew/types";

const { ObjectId } = mongoose.Types;

type CSVRecord ={
  _id:Types.ObjectId
  Name:string,
  UserType:string,
  Address:string,
  CountryCode:string
}
function isValidEmail(email: string) {
  return validator.isEmail(email);
}

const checkEmail = async (req: Request, res: Response): Promise<void> => {
  const email = req.query.email as string;
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Enter a valid Email" });
    return;
  }
  try {
    const subscriber = await Subscriber.findOne({ email: { $eq: email } });
    if (subscriber && subscriber.subscribed) {
      res.status(200).json({ message: "Email subscribed" });
      return;
    }
    res.status(200).json({ message: "Email not subscribed" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message:'Internal server error'
    res.status(500).json({ error: message });
  }
};

const checkEmailAuth = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email:string };
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Enter a valid Email" });
    return;
  }
  try {
    const subscriber = await Subscriber.findOne({ email: { $eq: email } });
    if (subscriber) {
      res.status(200).json({ subscriber });
      return;
    }
    res.status(200).json({ message: "Email not subscribed" });
  } catch (error: unknown) {
     const message = error instanceof Error ? error.message:'Internal server error'
    res.status(500).json({ error: message });
  }
};

const subscribe = async (req: Request, res: Response): Promise<void> => {
  const { email, name, countryCode, userType, userId } = req.body as {email:string, name:string, countryCode:string, userType:string, userId:Types.ObjectId}
  const allowedUserTypes = ["Pet Owner", "Business", "Developer"];
  if (!name) {
    res.status(400).json({ error: "Enter a valid Name" });
    return;
  }
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Enter a valid Email" });
    return;
  }
  if (!userType || !allowedUserTypes.includes(userType)) {
    res.status(400).json({ error: "Enter a valid userType" });
    return;
  }
  if (!countryCode || !validator.isISO31661Alpha2(countryCode)) {
    res.status(400).json({ error: "Enter a valid CountryCode" });
    return;
  }
  try {
    const subscriber = await Subscriber.findOne({ email: { $eq: email } });
    if (subscriber) {
      if (subscriber.subscribed) {
        res.status(400).json({ error: "Email already subscribed" });
        return;
      } else {
        await Subscriber.updateOne(
          { email: { $eq: email } },
          { subscribed: true }
        );
        const params = {
          ApplicationId: process.env.PINPOINT_APPLICATION_ID,
          EndpointId: (subscriber._id as mongoose.Types.ObjectId).toString(),
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
          res.status(500).json({ error: "Failed to unsubscribe" });
          return;
        }
        res.status(200).json({ message: "Subscription successful!" });
      }
    }
    const subscriberData: SubscriberData = {
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
    const newId = (newSubscriber._id as mongoose.Types.ObjectId).toString();
    const params = {
      ApplicationId: process.env.PINPOINT_APPLICATION_ID,
      EndpointId: newId,
      EndpointRequest: {
        ChannelType: ChannelType.EMAIL,
        Address: email,
        OptOut: "NONE",
        Location: {
          Country: countryCode || "",
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
      res.status(500).json({ error: "Failed to subscribe" });
      return;
    }
    // Send a welcome email
    res.status(200).json({ message: "Subscription successful!" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message :'Internal server error'
    res.status(500).json({ error: message });
  }
};

const unsubscribe = async (req: Request, res: Response): Promise<void> => {
  const { uuid } = req.query;
  if (!uuid) {
    res.status(400).json({ error: "UUID is required" });
    return;
  }

if (typeof uuid !== "string") {
  res.status(400).json({ error: "Invalid UUID" });
  return;
}
  try {
    const subscriber = await Subscriber.findOne({ _id: { $eq: uuid } });
    if (!subscriber) {
      res.status(400).json({ error: "Email not found" });
      return;
    }
    if (!subscriber.subscribed) {
      res.status(400).json({ error: "Email already unsubscribed" });
      return;
    }
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
      res.status(500).json({ error: "Failed to unsubscribe" });
      return;
    }
    // Send an unsubscribe email
    res.status(200).json({ message: "Unsubscription successful!" });
  } catch (error: unknown) {
    const message  = error instanceof Error ? error.message :'Internal server error'
    res.status(500).json({ error: message });
  }
};

const batchUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file as Express.Multer.File;
    if (!file) {
      res.status(400).json({ error: "CSV file is required" });
      return;
    }
    const content = file.buffer.toString("utf-8");
    let records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      skip_records_with_empty_values: true,
    }) as CSVRecord[]
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "Invalid or empty CSV" });
      return;
    }

    const requiredCols = ["Address", "CountryCode", "UserType", "Name"];
    const missingCols = requiredCols.filter((c) => !(c in records[0]));
    if (missingCols.length > 0) {
      res
        .status(400)
        .json({ error: `Missing required columns: ${missingCols.join(", ")}` });
      return;
    }
    const invalidEmails = records.filter((r) => !isValidEmail(r.Address));
    if (invalidEmails.length > 0) {
      res.status(400).json({
        error: `Invalid email addresses: ${invalidEmails.map((r) => r.Address).join(", ")}`,
      });
      return;
    }
    const invalidCountryCodes = records.filter(
      (r) => !validator.isISO31661Alpha2(r.CountryCode || "")
    );
    if (invalidCountryCodes.length > 0) {
      res.status(400).json({
        error: `Invalid country codes: ${invalidCountryCodes.map((r) => r.CountryCode).join(", ")}`,
      });
      return;
    }
    const allowedUserTypes = ["Pet Owner", "Business", "Developer"];
    const invalidUserTypes = records.filter(
      (r) => !allowedUserTypes.includes(r.UserType)
    );
    if (invalidUserTypes.length > 0) {
      res.status(400).json({
        error: `Invalid user types: ${invalidUserTypes.map((r) => r.UserType).join(", ")}`,
      });
      return;
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
            ChannelType: "EMAIL"  as ChannelType,
            Address: r.Address,
            OptOut: "NONE",
            Location: {
              Country: r.CountryCode || "",
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
      res.status(500).json({ error: "Failed to upload" });
      return;
    }
    res.status(200).json({ message: "Endpoints creation successful!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error processing CSV" });
  }
};

const NewsletterController = {
  checkEmail,
  checkEmailAuth,
  subscribe,
  unsubscribe,
  batchUpload,
};

export default NewsletterController;
