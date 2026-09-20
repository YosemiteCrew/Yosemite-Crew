#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (AppLock, NSObject)

RCT_EXTERN_METHOD(monotonicNow
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setPrivacy
                  : (BOOL)enabled timeoutMs
                  : (double)timeoutMs resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(coverRendered
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(dismissSystemSheets
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

@end
