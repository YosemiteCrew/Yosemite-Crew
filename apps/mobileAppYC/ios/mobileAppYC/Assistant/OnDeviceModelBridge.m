#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (OnDeviceModelBridge, NSObject)

RCT_EXTERN_METHOD(isAvailable
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(generate
                  : (NSString *)prompt maxTokens
                  : (nonnull NSNumber *)maxTokens resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

@end
