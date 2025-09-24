import { Request, Response } from 'express';
import { toFhirUser } from '@yosemite-crew/fhir';
import { IUser } from '@yosemite-crew/types';
import helpers from '../../utils/helper'
import AppUser from '../../models/appUser';

const petParentController = {
    getProfileDetail: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId: string = req.params.cognitoId
      if (!userId) {
        res.status(200).json({ status: 0, message: 'User ID is missing.' })
        return
      }

      const profielDetail = await AppUser.findOne({ cognitoId: userId }).lean();
      if (!profielDetail) {
        res.status(200).json({ status: 0, message: 'No profile found with this details' })
        return;
      }
      const entry: unknown = toFhirUser(profielDetail)
      res.status(200).json({ status: 1, message: 'Profle Details fetched successfully!', data: entry });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(200).json({ message: 0, error: message });
    }
  },

  updateProfileDetail: async (req: Request, res: Response): Promise<void> => {
    try {

      const userId: string = req.params.cognitoId
      if (!userId) {
        res.status(200).json({ status: 0, message: 'User ID is missing.' });
        return;
      }

      // File upload handling
      const files = Array.isArray(req?.files?.files)
        ? req?.files?.files
        : req?.files?.files
          ? [req?.files?.files]
          : [];

      let imageUrls;
      if (files.length) {
        imageUrls = await helpers.uploadFiles(files);
      }

      // Same payload as signup
      const {
        email,
        firstName,
        lastName,
        mobilePhone,
        countryCode,
        addressLine1,
        state,
        area,
        city,
        zipcode,
        country,
        dateOfBirth,
      } = JSON.parse(req.body.data) as {
        email: string;
        firstName: string;
        lastName: string;
        mobilePhone: string;
        countryCode: string;
        addressLine1: string;
        state?: string;
        area?: string;
        city?: string;
        zipcode?: string;
        country?: string;
        dateOfBirth?: string; // DD/MM/YYYY
      };

      // Convert DOB (if provided)
      let dob: Date | undefined;
      if (dateOfBirth) {
        const [day, month, year] = dateOfBirth.split('/');
        dob = new Date(`${year}-${month}-${day}`);
      }

      // Build update object
      const updateData: Partial<IUser> = {
        email: email?.trim().toLowerCase(),
        firstName,
        lastName,
        mobilePhone,
        countryCode,
        address: addressLine1,
        state,
        area,
        city,
        zipcode,
        country,
        dateOfBirth: dob,
      };

      // if(updateData.email){
      //   res.status(200).json({message:'Email cannot be update', status:0})
      //   return
      // }
      delete updateData.email;
      // Remove undefined fields
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      // Attach uploaded image(s)
      if (imageUrls && imageUrls.length) {
        updateData.profileImage = imageUrls;
      }

      const profileDetail = await AppUser.findOneAndUpdate(
        { cognitoId: userId },
        { $set: updateData },
        { new: true }
      );

      if (!profileDetail) {
        res.status(200).json({ status: 0, message: 'User not found' });
        return;
      }

      res.status(200).json({
        status: 1,
        message: 'Profile detail updated successfully',
        data: profileDetail,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An error occurred';
      res.status(200).json({ status: 0, message });
    }
  }
}