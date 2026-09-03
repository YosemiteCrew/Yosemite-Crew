import Foundation

/// The offline answer sheet the app writes and App Intents read.
///
/// App Intents declared in the app target run in the app's own process, which
/// iOS may launch in the background with no React Native bridge attached. The
/// JavaScript side therefore keeps a small, current copy of the few facts an
/// intent can state out loud, and the intents read only this.
///
/// It deliberately holds no tokens, addresses or clinical notes: an intent
/// that needs more than this should hand off to the app instead.
struct AssistantSnapshot: Codable {
  struct Pet: Codable {
    let id: String
    let name: String
    let species: String
  }

  struct Entry: Codable {
    let petId: String
    let petName: String
    let title: String
    /// ISO-8601. Formatted for display at read time, in the device locale.
    let at: String
    let subtitle: String?
  }

  let version: Int
  let generatedAt: String
  let pets: [Pet]
  let appointments: [Entry]
  let tasks: [Entry]
  let vaccinationsDue: [Entry]

  static let empty = AssistantSnapshot(
    version: 1,
    generatedAt: "",
    pets: [],
    appointments: [],
    tasks: [],
    vaccinationsDue: []
  )
}

/// Reads and writes the snapshot.
///
/// `UserDefaults.standard` is the store rather than an App Group, because the
/// intents live in the app target and share its container. Adding an app group
/// would mean a provisioning change for no behavioural gain today.
enum AssistantSnapshotStore {
  private static let key = "yc.assistant.snapshot.v1"

  static func write(_ json: String) -> Bool {
    guard let data = json.data(using: .utf8),
          (try? JSONDecoder().decode(AssistantSnapshot.self, from: data)) != nil
    else {
      // A malformed payload is dropped rather than stored: a half-written
      // snapshot would make Siri state something wrong with confidence.
      return false
    }
    UserDefaults.standard.set(json, forKey: key)
    return true
  }

  static func clear() {
    UserDefaults.standard.removeObject(forKey: key)
  }

  static func read() -> AssistantSnapshot {
    guard let json = UserDefaults.standard.string(forKey: key),
          let data = json.data(using: .utf8),
          let snapshot = try? JSONDecoder().decode(AssistantSnapshot.self, from: data)
    else {
      return .empty
    }
    return snapshot
  }

  // MARK: - Queries shared by the intents

  /// Resolves a spoken pet name against the snapshot.
  ///
  /// Falls back to the only pet when the owner has exactly one, so "when is
  /// the next appointment" works without naming anybody.
  static func pet(named name: String?, in snapshot: AssistantSnapshot) -> AssistantSnapshot.Pet? {
    if let name, !name.isEmpty {
      let wanted = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
      if let match = snapshot.pets.first(where: {
        $0.name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current) == wanted
      }) {
        return match
      }
      return nil
    }
    return snapshot.pets.count == 1 ? snapshot.pets.first : nil
  }

  static func parseDate(_ iso: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: iso) {
      return date
    }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: iso)
  }

  /// A short, spoken-friendly rendering: "Tuesday 4 March at 09:30".
  static func speakableDate(_ iso: String) -> String {
    guard let date = parseDate(iso) else {
      return iso
    }
    let formatter = DateFormatter()
    formatter.locale = Locale.current
    formatter.dateStyle = .full
    formatter.timeStyle = .short
    return formatter.string(from: date)
  }
}
