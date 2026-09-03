import AppIntents
import Foundation

/// Shared phrasing for the read-only intents.
@available(iOS 16.0, *)
private enum AssistantSpeech {
  static func noPetMatch(_ name: String?) -> String {
    if let name, !name.isEmpty {
      return "I could not find a pet called \(name) in Yosemite Crew."
    }
    return "Open Yosemite Crew and add a pet first."
  }
}

/// "When is Bruno's next appointment?"
@available(iOS 16.0, *)
struct NextAppointmentIntent: AppIntent {
  static var title: LocalizedStringResource = "Next appointment"
  static var description = IntentDescription(
    "Says when the next vet or grooming appointment is."
  )
  /// Answered entirely from the snapshot, so Siri never has to open the app.
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Pet")
  var pet: PetEntity?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let snapshot = AssistantSnapshotStore.read()

    let scopeId: String?
    if let pet {
      scopeId = pet.id
    } else if snapshot.pets.count == 1 {
      scopeId = snapshot.pets.first?.id
    } else {
      scopeId = nil
    }

    let entries = snapshot.appointments.filter { entry in
      scopeId == nil || entry.petId == scopeId
    }

    guard let next = entries.first else {
      let name = pet?.name
      let dialog = scopeId == nil && snapshot.pets.isEmpty
        ? AssistantSpeech.noPetMatch(name)
        : "There are no upcoming appointments booked."
      return .result(dialog: IntentDialog(stringLiteral: dialog))
    }

    let when = AssistantSnapshotStore.speakableDate(next.at)
    let where_ = next.subtitle.map { " at \($0)" } ?? ""
    return .result(
      dialog: IntentDialog(
        stringLiteral: "\(next.petName) has \(next.title) on \(when)\(where_)."
      )
    )
  }
}

/// "Are Bruno's vaccinations up to date?"
@available(iOS 16.0, *)
struct VaccinationStatusIntent: AppIntent {
  static var title: LocalizedStringResource = "Vaccination status"
  static var description = IntentDescription(
    "Says whether a pet's vaccinations are up to date or due."
  )
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Pet")
  var pet: PetEntity?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let snapshot = AssistantSnapshotStore.read()

    guard let resolved = AssistantSnapshotStore.pet(named: pet?.name, in: snapshot)
    else {
      return .result(
        dialog: IntentDialog(stringLiteral: AssistantSpeech.noPetMatch(pet?.name))
      )
    }

    let due = snapshot.vaccinationsDue.filter { $0.petId == resolved.id }
    guard let soonest = due.first else {
      return .result(
        dialog: IntentDialog(
          stringLiteral: "\(resolved.name) has no vaccinations due in the next month."
        )
      )
    }

    let now = Date()
    let dueDate = AssistantSnapshotStore.parseDate(soonest.at)
    let overdue = dueDate.map { $0 < now } ?? false
    let when = AssistantSnapshotStore.speakableDate(soonest.at)

    let sentence = overdue
      ? "\(resolved.name) is overdue a \(soonest.title) vaccination, due \(when)."
      : "\(resolved.name) is due a \(soonest.title) vaccination on \(when)."
    return .result(dialog: IntentDialog(stringLiteral: sentence))
  }
}

/// "What is due for Bruno today?"
@available(iOS 16.0, *)
struct UpcomingTasksIntent: AppIntent {
  static var title: LocalizedStringResource = "What is due"
  static var description = IntentDescription(
    "Lists the care tasks due for a pet."
  )
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Pet")
  var pet: PetEntity?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let snapshot = AssistantSnapshotStore.read()

    let scopeId: String?
    if let pet {
      scopeId = pet.id
    } else if snapshot.pets.count == 1 {
      scopeId = snapshot.pets.first?.id
    } else {
      scopeId = nil
    }

    let entries = snapshot.tasks.filter { scopeId == nil || $0.petId == scopeId }

    guard let first = entries.first else {
      return .result(
        dialog: IntentDialog(stringLiteral: "Nothing is due right now.")
      )
    }

    if entries.count == 1 {
      return .result(
        dialog: IntentDialog(
          stringLiteral: "\(first.petName) has one task due: \(first.title), on \(AssistantSnapshotStore.speakableDate(first.at))."
        )
      )
    }

    return .result(
      dialog: IntentDialog(
        stringLiteral: "There are \(entries.count) tasks due. The next is \(first.title) for \(first.petName) on \(AssistantSnapshotStore.speakableDate(first.at))."
      )
    )
  }
}
