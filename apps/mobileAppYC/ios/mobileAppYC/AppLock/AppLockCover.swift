import UIKit

/// The native side of app lock on iOS.
///
/// When the privacy flag is on, a cover built from BootSplash.storyboard goes
/// up in its own window as soon as the app resigns active, so the app switcher
/// snapshot shows only the cover.
///
/// How it comes down depends on where the app went:
/// - Back from the background: it stays up until JavaScript reports that its
///   own cover or lock screen has drawn, so there is never a frame of content
///   between the two.
/// - Back from inactive only (the Face ID sheet, Control Center, Notification
///   Center, a system alert or a call banner): it comes down as soon as the
///   app is active again. iOS took no snapshot and the app never left the
///   screen, so there is nothing for JavaScript to cover.
final class AppLockCover {
  static let shared = AppLockCover()

  private static let privacyKey = "appLock.privacyEnabled"

  /// Above everything the app draws, including React Native's own alert
  /// window, which sits at `.alert + 1`.
  private static let coverLevel = UIWindow.Level.alert + 2

  private var coverWindow: UIWindow?

  /// Whether the app has reached the background since the cover went up.
  private var backgroundedSinceShown = false

  private init() {}

  var isPrivacyEnabled: Bool {
    UserDefaults.standard.bool(forKey: Self.privacyKey)
  }

  func setPrivacyEnabled(_ enabled: Bool) {
    UserDefaults.standard.set(enabled, forKey: Self.privacyKey)
    if !enabled {
      hide()
    }
  }

  /// Called from `applicationWillResignActive`, before iOS takes its snapshot.
  func showIfEnabled() {
    guard isPrivacyEnabled, coverWindow == nil else {
      return
    }
    let window = makeWindow()
    window.windowLevel = Self.coverLevel
    window.rootViewController =
      UIStoryboard(name: "BootSplash", bundle: nil).instantiateInitialViewController()
      ?? UIViewController()
    // The cover is decoration. VoiceOver should reach the JS lock screen.
    window.accessibilityElementsHidden = true
    window.isHidden = false
    coverWindow = window
    backgroundedSinceShown = false
  }

  /// Called from `applicationDidEnterBackground`.
  func didEnterBackground() {
    backgroundedSinceShown = true
  }

  /// Called from `applicationDidBecomeActive`. After a trip to the background
  /// the cover waits for `coverRendered()`; otherwise it comes down now.
  func didBecomeActive() {
    if !backgroundedSinceShown {
      hide()
    }
  }

  /// Called once JavaScript has drawn its own cover or lock screen.
  func hide() {
    coverWindow?.isHidden = true
    coverWindow = nil
  }

  /// Closes UI that iOS or another SDK presented above the app: share sheets,
  /// the payment sheet, alerts and pickers. React Native modals and
  /// react-native-screens modals are left alone, because JavaScript owns them
  /// and hides its own modals while the app is locked.
  func dismissSystemSheets() {
    for window in allWindows() where window !== coverWindow {
      dismissForeignPresentation(above: window.rootViewController)
    }
  }

  private func dismissForeignPresentation(above root: UIViewController?) {
    var presenter = root
    while let current = presenter, let presented = current.presentedViewController {
      if Self.isOwnedByReactNative(presented) {
        presenter = presented
        continue
      }
      // Dismissing from the presenter also closes anything stacked above.
      current.dismiss(animated: false) {
        Self.releaseReactNativeAlertWindow(presented)
      }
      return
    }
  }

  private static func isOwnedByReactNative(_ controller: UIViewController) -> Bool {
    let name = NSStringFromClass(type(of: controller))
    return name.hasPrefix("RNS") || name.contains("ModalHostViewController")
  }

  /// React Native shows `Alert` in a window of its own and only hides that
  /// window from a button handler. Closing the alert without a button would
  /// leave an empty window catching every touch, so hide it here.
  private static func releaseReactNativeAlertWindow(_ controller: UIViewController) {
    let hide = NSSelectorFromString("hide")
    guard NSStringFromClass(type(of: controller)) == "RCTAlertController",
          controller.responds(to: hide) else {
      return
    }
    _ = controller.perform(hide)
  }

  private func allWindows() -> [UIWindow] {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
  }

  private func makeWindow() -> UIWindow {
    if let scene = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .first {
      return UIWindow(windowScene: scene)
    }
    return UIWindow(frame: UIScreen.main.bounds)
  }
}
