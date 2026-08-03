export const OVERALL_DISCOUNT_ERROR_ID = 'overall-discount-cap-error';

export const overallDiscountCapMessage = (maxPercent: number): string =>
  `Overall discount can't go above your organisation's ${maxPercent}% cap. Ask an admin to change the cap in Finance > Discounts.`;
