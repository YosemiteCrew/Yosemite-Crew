import Foundation
import React

/// React Native access to app lock's native pieces.
///
/// Registered as a legacy bridge module, like AssistantSnapshotBridge. The
/// JavaScript wrapper is src/features/appLock/services/privacyScreen.ts.
@objc(AppLock)
final class AppLockBridge: NSObject {

  /// Setup touches no UIKit. The UI methods below hop to the main queue.
  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  /// Milliseconds on CLOCK_MONOTONIC. On Darwin it keeps counting while the
  /// phone sleeps (unlike CLOCK_UPTIME_RAW), and Settings cannot change it.
  @objc(monotonicNow:rejecter:)
  func monotonicNow(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(Double(clock_gettime_nsec_np(CLOCK_MONOTONIC)) / 1_000_000)
  }

  /// iOS only needs the flag. The timeout matters on Android, where the app
  /// may not get to run its own check while another app's sheet is on top.
  @objc(setPrivacy:timeoutMs:resolver:rejecter:)
  func setPrivacy(
    _ enabled: Bool,
    timeoutMs _: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      AppLockCover.shared.setPrivacyEnabled(enabled)
      resolve(true)
    }
  }

  @objc(coverRendered:rejecter:)
  func coverRendered(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      AppLockCover.shared.hide()
      resolve(true)
    }
  }

  @objc(dismissSystemSheets:rejecter:)
  func dismissSystemSheets(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      AppLockCover.shared.dismissSystemSheets()
      resolve(true)
    }
  }
}
