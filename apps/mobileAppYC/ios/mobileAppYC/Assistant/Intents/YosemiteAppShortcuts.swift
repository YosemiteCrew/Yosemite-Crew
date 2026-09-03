import AppIntents

/// The phrases Siri accepts without the user setting anything up.
///
/// Every phrase has to contain the app name, which is why each one reads
/// "... in Yosemite Crew". Apple allows at most ten shortcuts per app, so this
/// is the five highest-traffic actions rather than the whole catalogue; the
/// rest remain available in the Shortcuts app and to Spotlight.
@available(iOS 16.0, *)
struct YosemiteAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: NextAppointmentIntent(),
      phrases: [
        "Next appointment in \(.applicationName)",
        "When is my next appointment in \(.applicationName)",
      ],
      shortTitle: "Next appointment",
      systemImageName: "calendar"
    )
    AppShortcut(
      intent: VaccinationStatusIntent(),
      phrases: [
        "Vaccination status in \(.applicationName)",
        "Check vaccinations in \(.applicationName)",
      ],
      shortTitle: "Vaccination status",
      systemImageName: "syringe"
    )
    AppShortcut(
      intent: UpcomingTasksIntent(),
      phrases: [
        "What is due in \(.applicationName)",
        "Pet care tasks in \(.applicationName)",
      ],
      shortTitle: "What is due",
      systemImageName: "checklist"
    )
    AppShortcut(
      intent: AddCareTaskIntent(),
      phrases: [
        "Add a care task in \(.applicationName)",
        "New pet reminder in \(.applicationName)",
      ],
      shortTitle: "Add a care task",
      systemImageName: "plus.circle"
    )
    AppShortcut(
      intent: BookAppointmentIntent(),
      phrases: [
        "Book an appointment in \(.applicationName)",
        "Book a vet visit in \(.applicationName)",
      ],
      shortTitle: "Book an appointment",
      systemImageName: "stethoscope"
    )
  }
}
