export { AppError, type AppErrorOptions } from './errors/app-error.js';
export { HttpError } from './errors/http-error.js';
export { APPOINTMENT_KINDS, PACKAGE_ITEM_PRICING_MODES, PRODUCT_KINDS } from './catalog.js';
export type {
  AppointmentKind,
  CatalogPricePolicy,
  PackageItemPricingMode,
  ProductKind,
  ResolvedCatalogItem,
  ResolvedCatalogSelection,
} from './catalog.js';
export type { JsonObject, JsonPrimitive, JsonValue, Nullable, Optional } from './types/common.js';
export { addCachedPromise, type CachedPromise } from './utils/cached-promise-cache.js';
export { mapAxiosError, type ExternalHttpError } from './utils/external-error.js';
export { buildGeoPoint, type GeoPoint } from './utils/geojson.js';
export {
  resolvePaymentCollectionMethod,
  type PaymentCollectionMethodValue,
} from './utils/payment.js';
export { toSafeErrorLog } from './utils/safe-error-log.js';
export { assertEmail, assertSafeString, sanitizeInput } from './utils/sanitize.js';
export * from './pdf/index.js';
