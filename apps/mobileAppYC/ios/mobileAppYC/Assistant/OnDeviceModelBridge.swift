import Foundation
import React

#if canImport(FoundationModels)
import FoundationModels
#endif

/// Apple's on-device language model, exposed to React Native.
///
/// The framework arrived in iOS 26 and only runs on Apple Intelligence
/// hardware, so both the import and the calls are guarded. Every failure path
/// resolves with `available: false` rather than rejecting: the assistant is
/// designed to work without a model, and a rejected promise would turn a
/// normal "this phone has no model" into an error the user sees.
@objc(OnDeviceModelBridge)
final class OnDeviceModelBridge: NSObject {

  private static let providerLabel = "Apple Intelligence"

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(isAvailable:rejecter:)
  func isAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      let model = SystemLanguageModel.default
      switch model.availability {
      case .available:
        resolve([
          "available": true,
          "providerLabel": Self.providerLabel,
        ])
      case .unavailable(let reason):
        resolve([
          "available": false,
          "reason": Self.reasonCode(for: reason),
          "providerLabel": Self.providerLabel,
        ])
      @unknown default:
        resolve([
          "available": false,
          "reason": "unknown",
          "providerLabel": Self.providerLabel,
        ])
      }
      return
    }
    #endif

    resolve([
      "available": false,
      "reason": "unsupportedOS",
      "providerLabel": Self.providerLabel,
    ])
  }

  @objc(generate:maxTokens:resolver:rejecter:)
  func generate(
    _ prompt: String,
    maxTokens: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      Task {
        do {
          let session = LanguageModelSession()
          var options = GenerationOptions()
          options.maximumResponseTokens = maxTokens.intValue
          let response = try await session.respond(to: prompt, options: options)
          resolve(response.content)
        } catch {
          // The caller treats a rejection as "no model help this turn" and
          // falls back to the rule-based reply.
          reject("on_device_model_failed", error.localizedDescription, error)
        }
      }
      return
    }
    #endif

    reject("on_device_model_unavailable", "No on-device model on this device", nil)
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func reasonCode(
    for reason: SystemLanguageModel.Availability.UnavailableReason
  ) -> String {
    switch reason {
    case .deviceNotEligible:
      return "unsupportedDevice"
    case .appleIntelligenceNotEnabled:
      return "notEnabled"
    case .modelNotReady:
      return "modelNotReady"
    @unknown default:
      return "unknown"
    }
  }
  #endif
}
