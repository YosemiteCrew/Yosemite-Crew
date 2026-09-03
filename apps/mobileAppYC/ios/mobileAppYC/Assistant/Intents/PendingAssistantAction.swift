import Foundation

/// A handoff parked for the app to pick up on launch.
///
/// Booking, adding a task and logging an expense all need confirmation, live
/// availability or payment. Rather than commit them from a background intent,
/// the intent stores the deep link here, opens the app, and JavaScript reads
/// it once and routes to the prefilled screen.
enum PendingAssistantAction {
  private static let key = "yc.assistant.pendingLink.v1"

  static func set(_ link: String) {
    UserDefaults.standard.set(link, forKey: key)
  }

  /// Reads and clears in one step, so a link is never handled twice.
  static func consume() -> String? {
    let link = UserDefaults.standard.string(forKey: key)
    UserDefaults.standard.removeObject(forKey: key)
    return link
  }
}
