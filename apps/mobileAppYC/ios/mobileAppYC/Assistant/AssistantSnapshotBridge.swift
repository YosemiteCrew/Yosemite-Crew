import Foundation
import React

/// React Native access to the snapshot store.
///
/// Registered as a legacy bridge module. Under the New Architecture RN routes
/// these through its interop layer, which is enough for two string methods and
/// avoids adding a codegen spec for them.
@objc(AssistantSnapshotBridge)
final class AssistantSnapshotBridge: NSObject {

  /// Nothing here touches UIKit, so the bridge does not need the main queue.
  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(writeSnapshot:resolver:rejecter:)
  func writeSnapshot(
    _ json: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(AssistantSnapshotStore.write(json))
  }

  /// Hands the app any deep link parked by a handoff intent, once.
  ///
  /// Returns an empty string rather than null when there is nothing pending,
  /// so the JavaScript side has one shape to handle.
  @objc(consumePendingLink:rejecter:)
  func consumePendingLink(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(PendingAssistantAction.consume() ?? "")
  }

  @objc(clearSnapshot:rejecter:)
  func clearSnapshot(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    AssistantSnapshotStore.clear()
    resolve(true)
  }
}
