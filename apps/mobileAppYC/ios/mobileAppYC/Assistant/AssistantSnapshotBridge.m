#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (AssistantSnapshotBridge, NSObject)

RCT_EXTERN_METHOD(writeSnapshot
                  : (NSString *)json resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearSnapshot
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(consumePendingLink
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

@end
