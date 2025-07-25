import { Request, Response } from 'express';
import DiscountCode from '../models/DiscountCode';

export const createDiscount = async (req: Request, res: Response) => {
  try {
    const { formData } = req.body;

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({ success: false, message: "Invalid formData" });
    }

    const {
      discountCodeName,
      discountCode,
      couponType,
      couponTypeValue,
      minOrderValue,
      validTill,
      description,
    } = formData;

    if (!discountCodeName || discountCodeName.trim().length < 3) {
      return res.status(400).json({ success: false, message: "Discount code name is required and should be at least 3 characters." });
    }

    if (!discountCode || discountCode.trim().length < 3) {
      return res.status(400).json({ success: false, message: "Discount code is required and should be at least 3 characters." });
    }

    if (!['fixed', 'percentage'].includes(couponType)) {
      return res.status(400).json({ success: false, message: "Coupon type must be either 'fixed' or 'percentage'." });
    }

    if (isNaN(couponTypeValue) || couponTypeValue <= 0) {
      return res.status(400).json({ success: false, message: "Coupon type value must be a positive number." });
    }

    if (isNaN(minOrderValue) || minOrderValue < 0) {
      return res.status(400).json({ success: false, message: "Minimum order value must be a non-negative number." });
    }

    if (!validTill || isNaN(Date.parse(validTill))) {
      return res.status(400).json({ success: false, message: "Valid till date must be a valid date string." });
    }

    const discount = new DiscountCode({
      codeName: discountCodeName,
      code: discountCode,
      couponType,
      value: couponTypeValue,
      minOrderValue,
      validTill,
      description,
      createdOn: new Date(),
      isActive: true,
    });

    await discount.save();
    res.status(201).json({ success: true, data: discount });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getAllDiscounts = async (_req: Request, res: Response) => {
  try {
    const discounts = await DiscountCode.find().sort({ createdOn: -1 });
    res.json({ success: true, data: discounts });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updateDiscount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid discount ID" });
    }

    const updated = await DiscountCode.findByIdAndUpdate(id, isActive, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Discount not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const toggleDiscountStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid discount ID' });
    }

    const discount = await DiscountCode.findById(id);
    if (!discount) return res.status(404).json({ message: 'Discount not found' });

    discount.isActive = !discount.isActive;
    await discount.save();

    return res.json({ success: true, data: discount });
  } catch (error) {
    return res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const deleteDiscount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid discount ID" });
    }

    const deleted = await DiscountCode.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Discount not found" });
    }

    res.json({ success: true, message: 'Discount deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
