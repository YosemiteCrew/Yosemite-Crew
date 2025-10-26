import {DOCUMENT_CATEGORIES, VISIT_TYPES} from '@/constants/documents.constants';

const CATEGORY_LABEL_MAP = DOCUMENT_CATEGORIES.reduce<Record<string, string>>(
  (accumulator, category) => {
    accumulator[category.id] = category.label;
    return accumulator;
  },
  {},
);

const SUBCATEGORY_LABEL_MAP = DOCUMENT_CATEGORIES.reduce<
  Record<string, Record<string, string>>
>((accumulator, category) => {
  const map = category.subcategories.reduce<Record<string, string>>(
    (subAccumulator, subcategory) => {
      subAccumulator[subcategory.id] = subcategory.label;
      return subAccumulator;
    },
    {},
  );
  accumulator[category.id] = map;
  return accumulator;
}, {});

const VISIT_TYPE_MAP = VISIT_TYPES.reduce<Record<string, string>>(
  (accumulator, visitType) => {
    accumulator[visitType.label] = visitType.label;
    accumulator[visitType.id] = visitType.label;
    return accumulator;
  },
  {},
);

export const resolveCategoryLabel = (categoryId: string): string =>
  CATEGORY_LABEL_MAP[categoryId] ?? categoryId;

export const resolveSubcategoryLabel = (
  categoryId: string,
  subcategoryId: string,
): string => {
  return SUBCATEGORY_LABEL_MAP[categoryId]?.[subcategoryId] ?? subcategoryId;
};

export const resolveVisitTypeLabel = (visitTypeId: string): string =>
  VISIT_TYPE_MAP[visitTypeId] ?? visitTypeId;
