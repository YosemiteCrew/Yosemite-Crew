#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (VisitVoice, NSObject)

RCT_EXTERN_METHOD(isAvailable
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(recognize
                  : (NSString *)locale resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(speak
                  : (NSString *)text locale
                  : (NSString *)locale resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopSpeaking
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

@end
