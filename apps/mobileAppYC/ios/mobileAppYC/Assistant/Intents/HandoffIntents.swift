import AppIntents
import Foundation

/// Intents that deliberately do not finish the job.
///
/// Adding a medication reminder, logging money and booking a clinic slot all
/// deserve a human confirming them, and booking additionally needs live
/// availability and payment. Each one parks a deep link and opens the app on
/// the right screen with what Siri heard already filled in.
@available(iOS 16.0, *)
struct AddCareTaskIntent: AppIntent {
  static var title: LocalizedStringResource = "Add a care task"
  static var description = IntentDescription(
    "Opens a new care task or medication reminder, ready to confirm."
  )
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Pet")
  var pet: PetEntity?

  @Parameter(title: "Task")
  var taskTitle: String?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    var items: [URLQueryItem] = []
    if let pet {
      items.append(URLQueryItem(name: "companionId", value: pet.id))
    }
    if let taskTitle, !taskTitle.isEmpty {
      items.append(URLQueryItem(name: "title", value: taskTitle))
    }
    PendingAssistantAction.set(AssistantLink.build(path: "/tasks/new", items: items))

    return .result(
      dialog: IntentDialog(
        stringLiteral: "Opening a new task for you to confirm."
      )
    )
  }
}

@available(iOS 16.0, *)
struct BookAppointmentIntent: AppIntent {
  static var title: LocalizedStringResource = "Book an appointment"
  static var description = IntentDescription(
    "Opens clinic search to book a vet or grooming appointment."
  )
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Pet")
  var pet: PetEntity?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    var items: [URLQueryItem] = []
    if let pet {
      items.append(URLQueryItem(name: "companionId", value: pet.id))
    }
    PendingAssistantAction.set(
      AssistantLink.build(path: "/appointments/book", items: items)
    )

    return .result(
      dialog: IntentDialog(
        stringLiteral: "Booking needs a time and payment, so I am opening clinic search."
      )
    )
  }
}

@available(iOS 16.0, *)
struct LogExpenseIntent: AppIntent {
  static var title: LocalizedStringResource = "Log an expense"
  static var description = IntentDescription(
    "Opens a new expense record for a pet, ready to confirm."
  )
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Pet")
  var pet: PetEntity?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    var items: [URLQueryItem] = []
    if let pet {
      items.append(URLQueryItem(name: "companionId", value: pet.id))
    }
    PendingAssistantAction.set(
      AssistantLink.build(path: "/expenses/new", items: items)
    )

    return .result(
      dialog: IntentDialog(stringLiteral: "Opening a new expense for you to confirm.")
    )
  }
}

/// Builds the `yc://app/...` links the JavaScript router already understands.
enum AssistantLink {
  static func build(path: String, items: [URLQueryItem]) -> String {
    var components = URLComponents()
    components.scheme = "yc"
    components.host = "app"
    components.path = path
    components.queryItems = items.isEmpty ? nil : items
    return components.string ?? "yc://app\(path)"
  }
}
